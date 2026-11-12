import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { POST as subscribe, confirmPost } from '../app/api/subscribe/route.js';
import { POST as unsubscribe } from '../app/api/unsubscribe/route.js';
import { resetMailerForTests, setMailerForTests } from './mailer.js';
import {
  resetPrivateStoreForTests, setPrivateBlobClientForTests, setPrivateReadDelaysForTests,
} from './privateStore.js';
import { resetStoreForTests, setBlobClientForTests, setJSON } from './store.js';

const host = 'aivisibilitychecker.app';
const email = 'owner@example.com';
const BLOB_TOKEN = 'vercel_blob_rw_teststore_notasecret';
const headers = {
  origin: `https://${host}`,
  host,
  'content-type': 'application/json',
};

function req(path, body) {
  return new Request(`https://${host}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

function missing() {
  const error = new Error('Vercel Blob: The requested blob does not exist');
  error.name = 'BlobNotFoundError';
  return error;
}

function tokenFrom(message, kind) {
  const url = message.text.match(new RegExp(`https://aivisibilitychecker\\.app/email/${kind}\\?token=\\S+`))[0];
  return new URL(url).searchParams.get('token');
}

describe('sealed subscriber reads', { concurrency: false }, () => {
  const origin = new Map();
  const cdn = new Map();
  const kv = new Map();
  const headWait = new Map();
  const bodyWait = new Map();
  const puts = [];
  const fetches = [];
  const prevFetch = globalThis.fetch;
  const prevToken = process.env.BLOB_READ_WRITE_TOKEN;

  function install() {
    setBlobClientForTests({
      head: (pathname) => {
        if (!kv.has(pathname)) throw missing();
        return { url: `https://blob.test/${encodeURIComponent(pathname)}`, size: Buffer.byteLength(kv.get(pathname)) };
      },
      put: async (pathname, body) => {
        kv.set(pathname, String(body));
        return { url: `https://blob.test/${encodeURIComponent(pathname)}` };
      },
    });
    setPrivateBlobClientForTests({
      head: (pathname) => {
        const wait = headWait.get(pathname) ?? 0;
        if (wait > 0) {
          headWait.set(pathname, wait - 1);
          throw missing();
        }
        if (!origin.has(pathname)) throw missing();
        const text = origin.get(pathname);
        return {
          pathname,
          size: Buffer.byteLength(text),
          etag: '"origin"',
          url: `https://teststore.public.blob.vercel-storage.com/${pathname}`,
        };
      },
      put: async (pathname, body, options) => {
        const text = String(body);
        puts.push({ pathname, options });
        if (origin.has(pathname) && options?.allowOverwrite === false) {
          throw new Error('Vercel Blob: This blob already exists');
        }
        if (!cdn.has(pathname)) cdn.set(pathname, origin.has(pathname) ? origin.get(pathname) : null);
        else if (origin.has(pathname) && cdn.get(pathname) == null) cdn.set(pathname, origin.get(pathname));
        origin.set(pathname, text);
        headWait.set(pathname, 1);
        bodyWait.set(pathname, 1);
      },
      del: async (pathname) => {
        if (origin.has(pathname)) cdn.set(pathname, origin.get(pathname));
        origin.delete(pathname);
        headWait.delete(pathname);
        bodyWait.delete(pathname);
      },
    });
    setPrivateReadDelaysForTests([0, 0, 0, 0]);
    globalThis.fetch = async (url, init) => {
      const href = url instanceof URL ? url.href : String(url);
      fetches.push({ href, init });
      const parsed = new URL(href);
      if (parsed.hostname === 'blob.test') {
        const pathname = decodeURIComponent(parsed.pathname.slice(1));
        const body = kv.get(pathname);
        if (body == null) return new Response('missing', { status: 404 });
        return new Response(body, { status: 200, headers: { 'content-type': 'application/json' } });
      }
      if (parsed.hostname === 'teststore.private.blob.vercel-storage.com') {
        if (parsed.searchParams.get('cache') === '0') {
          return new Response('cache=0 is only available for private stores', { status: 400 });
        }
        const pathname = decodeURIComponent(parsed.pathname.slice(1));
        const wait = bodyWait.get(pathname) ?? 0;
        if (wait > 0) {
          bodyWait.set(pathname, wait - 1);
          return new Response('missing', { status: 404 });
        }
        if (!origin.has(pathname)) return new Response('missing', { status: 404 });
        return new Response(origin.get(pathname), {
          status: 200,
          headers: { 'content-type': 'application/json', etag: '"origin"' },
        });
      }
      if (parsed.hostname.endsWith('.public.blob.vercel-storage.com')) {
        const pathname = decodeURIComponent(parsed.pathname.slice(1));
        const body = cdn.get(pathname);
        if (body == null) return new Response('stale-missing', { status: 404, headers: { etag: '"cdn"' } });
        return new Response(body, { status: 200, headers: { 'content-type': 'application/json', etag: '"cdn"' } });
      }
      return new Response('unexpected', { status: 500 });
    };
  }

  test.after(() => {
    globalThis.fetch = prevFetch;
    if (prevToken === undefined) delete process.env.BLOB_READ_WRITE_TOKEN;
    else process.env.BLOB_READ_WRITE_TOKEN = prevToken;
    resetPrivateStoreForTests();
    resetStoreForTests();
    resetMailerForTests();
  });

  test('confirm works on the first click, and resubscribe tokens work while the CDN still serves the deleted blob', async () => {
    process.env.BLOB_READ_WRITE_TOKEN = BLOB_TOKEN;
    resetStoreForTests();
    resetPrivateStoreForTests();
    install();
    const sent = [];
    setMailerForTests(async (message) => { sent.push(message); return { ok: true }; });
    const id = 'ab'.repeat(12);
    await setJSON(`cache/${id}`, {
      at: Date.now(),
      result: {
        brand: 'Notion', category: '', mentionedIn: 1, total: 3, score: 40, runs: 1,
        rows: [{ prompt: 'What are alternatives to Notion?', mentioned: true, rank: 1, brands: ['Notion'] }],
        topBrands: [], topSources: [], checkedAt: '2026-11-12T00:00:00.000Z',
      },
    });

    const first = await subscribe(req('/api/subscribe', { email, consent: true, id, elapsed: 1500, company: '' }));
    assert.equal(first.status, 200);
    const confirmMessage = sent[0];
    const confirmToken = tokenFrom(confirmMessage, 'confirm');
    const unsubToken = tokenFrom(confirmMessage, 'unsubscribe');
    assert.equal(confirmToken.length, 43);
    assert.equal(unsubToken.length, 43);
    assert.equal(/^[A-Za-z0-9_-]+$/.test(confirmToken), true);

    const confirmed = await confirmPost(req('/api/subscribe/confirm', { token: confirmToken }));
    const confirmedBody = await confirmed.json();
    assert.equal(confirmed.status, 200, confirmedBody.error || '');
    assert.equal(confirmedBody.message.includes('blob'), false);

    const removed = await unsubscribe(req('/api/unsubscribe', { token: unsubToken }));
    assert.equal(removed.status, 200);
    const oldConfirm = await confirmPost(req('/api/subscribe/confirm', { token: confirmToken }));
    assert.equal(oldConfirm.status, 400);
    const oldUnsub = await unsubscribe(req('/api/unsubscribe', { token: unsubToken }));
    assert.equal(oldUnsub.status, 400);

    const second = await subscribe(req('/api/subscribe', { email, consent: true, id, elapsed: 1500, company: '' }));
    assert.equal(second.status, 200);
    const again = sent.at(-1);
    const confirmToken2 = tokenFrom(again, 'confirm');
    const unsubToken2 = tokenFrom(again, 'unsubscribe');
    assert.notEqual(confirmToken2, confirmToken);
    assert.notEqual(unsubToken2, unsubToken);

    const confirmed2 = await confirmPost(req('/api/subscribe/confirm', { token: confirmToken2 }));
    const confirmed2Body = await confirmed2.json();
    assert.equal(confirmed2.status, 200, confirmed2Body.error || '');
    const removed2 = await unsubscribe(req('/api/unsubscribe', { token: unsubToken2 }));
    const removed2Body = await removed2.json();
    assert.equal(removed2.status, 200, removed2Body.error || '');
    const removed2Again = await unsubscribe(req('/api/unsubscribe', { token: unsubToken2 }));
    assert.equal(removed2Again.status, 400);

    const versions = puts.filter((put) => put.pathname.startsWith('sealed/mail/v/'));
    assert.equal(versions.length >= 2, true);
    assert.equal(new Set(versions.map((put) => put.pathname)).size, versions.length);
    assert.equal(versions.every((put) => put.options.allowOverwrite === false), true);
    assert.equal(versions.every((put) => put.options.addRandomSuffix === false), true);
    assert.equal(puts.some((put) => put.pathname.includes(email) || put.pathname.includes('@')), false);

    const privateReads = fetches.filter((call) => call.href.includes('.private.blob.vercel-storage.com'));
    const publicReads = fetches.filter((call) => call.href.includes('.public.blob.vercel-storage.com'));
    assert.equal(privateReads.length > 0, true);
    assert.equal(privateReads.every((call) => new URL(call.href).searchParams.has('cache') === false), true);
    assert.equal(privateReads.every((call) => call.init?.cache === 'no-store'), true);
    assert.equal(privateReads.every((call) => call.href.includes(BLOB_TOKEN)), false);
    assert.equal(publicReads.every((call) => new URL(call.href).searchParams.get('cache') !== '0'), true);
    assert.equal(JSON.stringify(confirmed2Body).includes('blob.vercel-storage'), false);
    assert.equal(JSON.stringify(removed2Body).includes(email), false);
  });
});
