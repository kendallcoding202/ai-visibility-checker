import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BlobNotFoundError, BlobStoreNotFoundError } from '@vercel/blob';
import { POST as lookupPost } from '../app/api/lookup/route.js';
import { POST as checkPost } from '../app/api/check/route.js';
import {
  getJSON, isTransientBlobError, loadPublicCache, readJSON, resetStoreForTests,
  setBlobClientForTests, setReadRetryForTests,
} from './store.js';
import { resetPrivateStoreForTests, setPrivateBlobClientForTests } from './privateStore.js';
import { hashKey } from './hash.js';
import { LIMIT_UNAVAILABLE } from './limits.js';
import { LOOKUP_UNAVAILABLE_ERROR, RESULT_UNAVAILABLE_ERROR } from './checkError.js';

const TOKEN = 'test-blob-token-not-a-secret';
const STORE_TOKEN = 'vercel_blob_rw_abc123_notasecret';
const OPENAI_KEY = 'test-openai-key-not-real-000000';

describe('blob read retries', { concurrency: false }, () => {
  const logs = [];
  const fetches = [];
  const prevFetch = globalThis.fetch;
  const prevErr = console.error;
  let objects = new Map();
  let headCalls = 0;
  let headImpl = () => { throw new Error('head unset'); };

  test.before(() => {
    console.error = (...args) => { logs.push(args.map(String).join(' ')); };
  });

  test.after(() => {
    globalThis.fetch = prevFetch;
    console.error = prevErr;
    resetStoreForTests();
    resetPrivateStoreForTests();
    delete process.env.BLOB_READ_WRITE_TOKEN;
    delete process.env.OPENAI_API_KEY;
  });

  test.beforeEach(() => {
    resetStoreForTests();
    resetPrivateStoreForTests();
    setReadRetryForTests([0, 0, 0]);
    objects = new Map();
    headCalls = 0;
    logs.length = 0;
    fetches.length = 0;
    process.env.BLOB_READ_WRITE_TOKEN = TOKEN;
    delete process.env.OPENAI_API_KEY;
    delete process.env.VERCEL_ENV;
    process.env.NODE_ENV = 'test';
    setBlobClientForTests({
      head: (pathname, options) => {
        headCalls += 1;
        return headImpl(pathname, options);
      },
      put: async (pathname, body) => {
        objects.set(pathname, String(body));
        return { url: `https://blob.test/${encodeURIComponent(pathname)}` };
      },
    });
    globalThis.fetch = async (url, init) => {
      const href = String(url);
      fetches.push({ href, init });
      const parsed = new URL(href);
      if (parsed.hostname === 'blob.test') {
        const pathname = decodeURIComponent(parsed.pathname.slice(1));
        const body = objects.get(pathname);
        if (body == null) return new Response('missing', { status: 404 });
        return new Response(body, { status: 200, headers: { 'content-type': 'application/json' } });
      }
      return new Response('unexpected', { status: 500 });
    };
  });

  test('a missing key is one attempt and is not an error', async () => {
    headImpl = () => { throw new BlobNotFoundError(); };
    const read = await readJSON('day/new');
    assert.deepEqual(read, { ok: true, value: null });
    assert.equal(headCalls, 1);
    assert.equal(fetches.length, 0);
    assert.equal(logs.some((line) => line.includes('blob read failed')), false);
    assert.equal(isTransientBlobError(new BlobNotFoundError()), false);
    assert.equal(isTransientBlobError(new BlobStoreNotFoundError()), false);
    assert.equal(isTransientBlobError(new Error('Vercel Blob: Cannot use private access on a public store.')), false);
    assert.equal(isTransientBlobError(new DOMException('The operation was aborted due to timeout', 'TimeoutError')), true);
  });

  test('a transient head error is retried and then returns the value', async () => {
    let hits = 0;
    objects.set('kv/day/ok.json', JSON.stringify({ n: 4 }));
    headImpl = (pathname) => {
      hits += 1;
      if (hits < 3) throw new DOMException('The operation was aborted due to timeout', 'TimeoutError');
      return { url: `https://blob.test/${encodeURIComponent(pathname)}`, size: Buffer.byteLength(objects.get(pathname)) };
    };
    const read = await readJSON('day/ok');
    assert.equal(read.ok, true);
    assert.equal(read.value.n, 4);
    assert.equal(hits, 3);
    assert.equal(logs.some((line) => line.includes('blob read failed')), false);
    assert.equal(logs.join('\n').includes(TOKEN), false);
  });

  test('a CDN 404 after head() is not an empty counter', async () => {
    headImpl = (pathname) => ({ url: `https://blob.test/${encodeURIComponent(pathname)}`, size: 12 });
    globalThis.fetch = async (url, init) => {
      fetches.push({ href: String(url), auth: init?.headers?.authorization ?? '' });
      return new Response('missing', { status: 404 });
    };
    const read = await readJSON('month/2026-11');
    assert.equal(read.ok, false);
    assert.equal(read.value, null);
    assert.equal(read.reason, 'status-404');
    assert.equal(fetches.length, 3);
    assert.equal(fetches.every((hit) => hit.auth === ''), true);
    assert.equal(await getJSON('month/2026-11'), null);
    assert.equal(fetches.length, 6);
    assert.equal(logs.some((line) => line === 'blob read failed status=404'), true);
    assert.equal(logs.join('\n').includes(TOKEN), false);
    const loaded = await loadPublicCache('cache/missing-body');
    assert.deepEqual(loaded, { ok: false, result: null });
  });

  test('the private host is preferred and a foreign head URL is never fetched', async () => {
    process.env.BLOB_READ_WRITE_TOKEN = STORE_TOKEN;
    const body = JSON.stringify({ n: 2 });
    headImpl = () => ({ url: 'https://evil.example/kv/day/x.json', size: Buffer.byteLength(body) });
    globalThis.fetch = async (url, init) => {
      fetches.push({ href: String(url), auth: init?.headers?.authorization ?? '' });
      const parsed = new URL(String(url));
      if (parsed.hostname === 'abc123.private.blob.vercel-storage.com') {
        assert.equal(parsed.searchParams.has('cache'), false);
        return new Response(body, { status: 200, headers: { 'content-type': 'application/json' } });
      }
      return new Response('no', { status: 500 });
    };
    const read = await readJSON('day/x');
    assert.equal(read.ok, true);
    assert.equal(read.value.n, 2);
    assert.equal(fetches.length, 1);
    assert.equal(fetches[0].href.startsWith('https://abc123.private.blob.vercel-storage.com/kv/day/x.json'), true);
    assert.equal(fetches[0].auth, `Bearer ${STORE_TOKEN}`);
    assert.equal(logs.join('\n').includes(STORE_TOKEN), false);
    assert.equal(JSON.stringify(read).includes(STORE_TOKEN), false);

    fetches.length = 0;
    logs.length = 0;
    process.env.BLOB_READ_WRITE_TOKEN = TOKEN;
    headImpl = () => ({ url: 'https://evil.example/steal' });
    const blocked = await readJSON('day/y');
    assert.equal(blocked.ok, false);
    assert.equal(fetches.length, 0);
    assert.equal(logs.some((line) => line === 'blob read failed name=HostError'), true);
    assert.equal(logs.join('\n').includes('evil.example'), false);
    assert.equal(logs.join('\n').includes(TOKEN), false);
  });

  test('an unreadable lookup cache is a miss and an unreadable counter still fails closed', async () => {
    process.env.OPENAI_API_KEY = OPENAI_KEY;
    let openai = 0;
    globalThis.fetch = async (url) => {
      const href = String(url);
      if (href.includes('api.openai.com')) {
        openai += 1;
        const body = openai === 1
          ? { output: [{ type: 'web_search_call' }, { type: 'message', content: [{ type: 'output_text', text: 'HubSpot is often named.', annotations: [] }] }], usage: { input_tokens: 20, output_tokens: 10 } }
          : { output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify({ brands: ['HubSpot'] }) }] }], usage: { input_tokens: 10, output_tokens: 5 } };
        return Response.json(body);
      }
      fetches.push({ href });
      const pathname = decodeURIComponent(new URL(href).pathname.slice(1));
      const stored = objects.get(pathname);
      if (stored == null) return new Response('missing', { status: 404 });
      return new Response(stored, { status: 200, headers: { 'content-type': 'application/json' } });
    };
    headImpl = (pathname) => {
      if (pathname.startsWith('kv/lookup/')) throw new DOMException('timed out', 'TimeoutError');
      if (!objects.has(pathname)) throw new BlobNotFoundError();
      return { url: `https://blob.test/${encodeURIComponent(pathname)}` };
    };
    const res = await lookupPost(new Request('https://checker.example/api/lookup', {
      method: 'POST',
      headers: { origin: 'https://checker.example', host: 'checker.example', 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.80' },
      body: JSON.stringify({ market: 'independent bookbinders in reykjavik', elapsed: 2000 }),
    }));
    const text = await res.text();
    assert.equal(res.status, 200, text);
    assert.equal(openai, 2);
    assert.equal(text.includes(TOKEN), false);
    assert.equal(text.includes(OPENAI_KEY), false);

    openai = 0;
    logs.length = 0;
    const before = new Set(objects.keys());
    headImpl = (pathname) => {
      if (pathname.startsWith('kv/month/')) return { url: `https://blob.test/${encodeURIComponent(pathname)}` };
      if (!objects.has(pathname)) throw new BlobNotFoundError();
      return { url: `https://blob.test/${encodeURIComponent(pathname)}` };
    };
    globalThis.fetch = async (url) => {
      const href = String(url);
      if (href.includes('api.openai.com')) {
        openai += 1;
        return Response.json({});
      }
      return new Response('missing', { status: 404 });
    };
    const denied = await checkPost(new Request('https://checker.example/api/check', {
      method: 'POST',
      headers: { origin: 'https://checker.example', host: 'checker.example', 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.81' },
      body: JSON.stringify({ brand: 'PathProof', category: 'website monitoring', elapsed: 2000 }),
    }));
    const deniedText = await denied.text();
    assert.equal(denied.status, 503, deniedText);
    assert.equal(JSON.parse(deniedText).error, LIMIT_UNAVAILABLE);
    assert.equal(openai, 0);
    assert.deepEqual([...objects.keys()].sort(), [...before].sort());
    assert.equal(logs.join('\n').includes(TOKEN), false);
    assert.equal(logs.join('\n').includes('PathProof'), false);
  });

  test('a failed shared cache is an error and a missing one is a miss', async () => {
    const id = 'ab'.repeat(12);
    headImpl = () => { throw new BlobStoreNotFoundError(); };
    const failed = await loadPublicCache(`cache/${id}`);
    assert.deepEqual(failed, { ok: false, result: null });
    assert.equal(logs.join('\n').includes(TOKEN), false);
    const resultPage = readFileSync(new URL('../app/r/[id]/page.js', import.meta.url), 'utf8');
    const lookupPage = readFileSync(new URL('../app/l/[id]/page.js', import.meta.url), 'utf8');
    assert.equal(resultPage.includes('RESULT_UNAVAILABLE_ERROR'), true);
    assert.equal(resultPage.includes('loadPublicCache'), true);
    assert.equal(lookupPage.includes('LOOKUP_UNAVAILABLE_ERROR'), true);
    assert.equal(lookupPage.includes('loadPublicCache'), true);
    assert.equal(RESULT_UNAVAILABLE_ERROR.includes('temporarily unavailable'), true);
    assert.equal(LOOKUP_UNAVAILABLE_ERROR.includes('temporarily unavailable'), true);

    logs.length = 0;
    headImpl = () => { throw new BlobNotFoundError(); };
    const missed = await loadPublicCache(`cache/${id}`);
    assert.deepEqual(missed, { ok: true, result: null });
    assert.equal(logs.some((line) => line.includes('blob read failed')), false);
  });
});
