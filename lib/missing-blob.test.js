import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { BlobNotFoundError, BlobStoreNotFoundError, BlobUnknownError } from '@vercel/blob';
import { POST as checkPost } from '../app/api/check/route.js';
import { POST as lookupPost } from '../app/api/lookup/route.js';
import { hashKey } from './hash.js';
import { LIMIT_UNAVAILABLE } from './limits.js';
import { getJSON, isMissingBlob, readJSON, resetStoreForTests, setBlobClientForTests, setReadRetryForTests } from './store.js';
import { resetPrivateStoreForTests, setPrivateBlobClientForTests } from './privateStore.js';

// The predicate that shipped in PR #12. It misses the error @vercel/blob@2.8.2 throws.
function legacyIsMissingBlob(error) {
  if (!error || typeof error !== 'object') return false;
  if (error.name === 'BlobNotFoundError') return true;
  const status = error.status ?? error.statusCode;
  return status === 404;
}

// Real BlobNotFoundError, with the class name renamed the way a production bundle does.
// error.name stays "Error" because BlobError never assigns this.name.
function productionMissingError() {
  const error = new BlobNotFoundError();
  const minified = class E extends BlobNotFoundError {};
  Object.defineProperty(error, 'constructor', { configurable: true, value: minified });
  return error;
}

const DAY = new Date().toISOString().slice(0, 10);
const MONTH = DAY.slice(0, 7);
const BLOB_TOKEN = 'test-blob-token-not-a-secret';
const OPENAI_KEY = 'test-openai-key-not-real-000000';
const ENV_KEYS = ['BLOB_READ_WRITE_TOKEN', 'OPENAI_API_KEY', 'NODE_ENV', 'VERCEL_ENV', 'HASH_SALT'];

function searchBody(text) {
  return {
    output: [
      { type: 'web_search_call' },
      { type: 'message', content: [{ type: 'output_text', text, annotations: [] }] },
    ],
    usage: { input_tokens: 1000, output_tokens: 200 },
  };
}

function extractionBody() {
  const answers = [
    { brands: ['PathProof'], sentiment: 'positive' },
    { brands: ['PathProof'], sentiment: 'neutral' },
    { brands: ['PathProof'], sentiment: 'positive' },
  ];
  return {
    output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify({ answers }) }] }],
    usage: { input_tokens: 100, output_tokens: 40 },
  };
}

function lookupBody() {
  return {
    output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify({ brands: ['HubSpot', 'Salesforce'] }) }] }],
    usage: { input_tokens: 80, output_tokens: 20 },
  };
}

function checkRequest(ip) {
  return new Request('https://checker.example/api/check', {
    method: 'POST',
    headers: {
      origin: 'https://checker.example',
      host: 'checker.example',
      'content-type': 'application/json',
      'x-forwarded-for': ip,
    },
    body: JSON.stringify({ brand: 'PathProof', category: 'website monitoring', elapsed: 2000 }),
  });
}

function lookupRequest(ip, market) {
  return new Request('https://checker.example/api/lookup', {
    method: 'POST',
    headers: {
      origin: 'https://checker.example',
      host: 'checker.example',
      'content-type': 'application/json',
      'x-forwarded-for': ip,
    },
    body: JSON.stringify({ market, elapsed: 2000 }),
  });
}

describe('missing blob keys', { concurrency: false }, () => {
  const objects = new Map();
  const misses = [];
  const logs = [];
  let openaiCalls = 0;
  let putCalls = 0;
  let blobFetches = 0;
  let headImpl = null;
  const prevFetch = globalThis.fetch;
  const prevLog = console.log;
  const prevErr = console.error;
  const prevEnv = new Map(ENV_KEYS.map((key) => [key, process.env[key]]));

  function installClient() {
    setBlobClientForTests({
      head: (pathname, options) => headImpl(pathname, options),
      put: async (pathname, body) => {
        putCalls += 1;
        objects.set(pathname, String(body));
        return { url: `https://blob.test/${encodeURIComponent(pathname)}` };
      },
    });
  }

  test.before(() => {
    process.env.BLOB_READ_WRITE_TOKEN = BLOB_TOKEN;
    process.env.OPENAI_API_KEY = OPENAI_KEY;
    process.env.NODE_ENV = 'test';
    delete process.env.VERCEL_ENV;
    delete process.env.HASH_SALT;
    console.log = (...args) => { logs.push(args.map(String).join(' ')); };
    console.error = (...args) => { logs.push(args.map(String).join(' ')); };
  });

  test.after(() => {
    globalThis.fetch = prevFetch;
    console.log = prevLog;
    console.error = prevErr;
    resetStoreForTests();
    resetPrivateStoreForTests();
    for (const key of ENV_KEYS) {
      const value = prevEnv.get(key);
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  test.beforeEach(() => {
    resetStoreForTests();
    resetPrivateStoreForTests();
    setReadRetryForTests([0, 0, 0]);
    setPrivateBlobClientForTests({ put: async () => {} });
    objects.clear();
    misses.length = 0;
    logs.length = 0;
    openaiCalls = 0;
    putCalls = 0;
    blobFetches = 0;
    headImpl = (pathname) => {
      if (!objects.has(pathname)) {
        const error = productionMissingError();
        misses.push({ pathname, error });
        throw error;
      }
      return { url: `https://blob.test/${encodeURIComponent(pathname)}` };
    };
    installClient();
    globalThis.fetch = async (url) => {
      const href = String(url);
      if (href.startsWith('https://blob.test/')) {
        blobFetches += 1;
        const pathname = decodeURIComponent(new URL(href).pathname.slice(1));
        const body = objects.get(pathname);
        if (body == null) return new Response('missing', { status: 404 });
        return new Response(body, { status: 200, headers: { 'content-type': 'application/json' } });
      }
      if (href.includes('api.openai.com')) {
        openaiCalls += 1;
        const body = openaiCalls % 2 === 1 ? searchBody('PathProof is a common recommendation.') : lookupBody();
        return Response.json(body);
      }
      return new Response(null, { status: 204 });
    };
  });

  test('the installed BlobNotFoundError is a missing key even when its name is renamed', () => {
    const error = productionMissingError();
    assert.equal(error instanceof BlobNotFoundError, true);
    assert.equal(error.name, 'Error');
    assert.equal(error.constructor.name, 'E');
    assert.equal(error.message, 'Vercel Blob: The requested blob does not exist');
    assert.equal(error.status, undefined);
    assert.equal(error.statusCode, undefined);
    assert.equal(error.code, undefined);
    assert.equal(legacyIsMissingBlob(error), false);
    assert.equal(isMissingBlob(error), true);

    const detached = new Error(error.message);
    Object.defineProperty(detached, 'name', { value: 'E' });
    assert.equal(detached instanceof BlobNotFoundError, false);
    assert.equal(legacyIsMissingBlob(detached), false);
    assert.equal(isMissingBlob(detached), true);

    assert.equal(isMissingBlob(new BlobUnknownError()), false);
    assert.equal(isMissingBlob(new BlobStoreNotFoundError()), false);
    assert.equal(isMissingBlob(new TypeError('fetch failed')), false);
    assert.equal(isMissingBlob(new DOMException('The operation was aborted due to timeout', 'TimeoutError')), false);
    assert.equal(isMissingBlob(new Error('Vercel Blob: This store does not exist.')), false);
    assert.equal(isMissingBlob({ name: 'BlobNotFoundError' }), true);
    assert.equal(isMissingBlob({ status: 404 }), true);
    assert.equal(isMissingBlob({ statusCode: 500 }), false);
  });

  test('readJSON treats a renamed not-found head() as empty and fails closed on real store errors', async () => {
    const missing = await readJSON(`ip/${DAY}/brand-new`);
    assert.deepEqual(missing, { ok: true, value: null });
    assert.equal(blobFetches, 0);
    assert.equal(logs.some((line) => line.includes('blob read failed')), false);
    assert.equal(misses.length, 1);
    assert.equal(misses[0].error.name, 'Error');
    assert.equal(misses[0].error.constructor.name, 'E');

    headImpl = () => {
      const detached = new Error('Vercel Blob: The requested blob does not exist');
      Object.defineProperty(detached, 'name', { value: 'E' });
      throw detached;
    };
    const detached = await readJSON('day/brand-new');
    assert.deepEqual(detached, { ok: true, value: null });

    for (const error of [
      new BlobUnknownError(),
      new BlobStoreNotFoundError(),
      new TypeError('fetch failed'),
      new DOMException('The operation was aborted due to timeout', 'TimeoutError'),
    ]) {
      logs.length = 0;
      headImpl = () => { throw error; };
      const read = await readJSON(`month/${MONTH}`);
      assert.equal(read.ok, false, error.name);
      assert.equal(read.value, null);
      assert.equal(logs.some((line) => line.startsWith('blob read failed name=')), true);
      assert.equal(logs.join('\n').includes(BLOB_TOKEN), false);
      assert.equal(logs.join('\n').includes(OPENAI_KEY), false);
    }

    headImpl = () => ({ url: 'https://blob.test/kv%2Fmonth%2Fbroken.json' });
    globalThis.fetch = async () => new Response('nope', { status: 500 });
    const down = await readJSON(`month/${MONTH}`);
    assert.equal(down.ok, false);
    assert.equal(down.reason, 'status-500');
  });

  test('a brand check for a new IP, day, and month proceeds when head() throws the production not-found error', async () => {
    const ip = '203.0.113.51';
    globalThis.fetch = async (url) => {
      const href = String(url);
      if (href.startsWith('https://blob.test/')) {
        blobFetches += 1;
        const pathname = decodeURIComponent(new URL(href).pathname.slice(1));
        const body = objects.get(pathname);
        if (body == null) return new Response('missing', { status: 404 });
        return new Response(body, { headers: { 'content-type': 'application/json' } });
      }
      if (!href.includes('api.openai.com')) return new Response(null, { status: 204 });
      openaiCalls += 1;
      const body = openaiCalls <= 3
        ? searchBody('PathProof is a common recommendation for website monitoring.')
        : extractionBody();
      return Response.json(body);
    };

    const res = await checkPost(checkRequest(ip));
    const text = await res.text();
    assert.equal(res.status, 200, text);
    const body = JSON.parse(text);
    assert.equal(body.cached, false);
    assert.equal(body.brand, 'PathProof');
    assert.equal(/^[a-f0-9]{24}$/.test(body.id), true);
    assert.equal(openaiCalls, 4);
    assert.equal(text.includes(BLOB_TOKEN), false);
    assert.equal(text.includes(OPENAI_KEY), false);

    const missed = misses.map((entry) => entry.pathname);
    assert.equal(missed.includes(`kv/ip/${DAY}/${hashKey(ip)}.json`), true);
    assert.equal(missed.includes(`kv/day/${DAY}.json`), true);
    assert.equal(missed.includes(`kv/month/${MONTH}.json`), true);
    for (const entry of misses) {
      assert.equal(entry.error instanceof BlobNotFoundError, true);
      assert.equal(entry.error.name, 'Error');
      assert.equal(entry.error.constructor.name, 'E');
      assert.equal(legacyIsMissingBlob(entry.error), false);
    }
    assert.equal(logs.some((line) => line.includes('blob read failed')), false);
    assert.equal(logs.join('\n').includes(BLOB_TOKEN), false);
    assert.equal((await getJSON(`ip/${DAY}/${hashKey(ip)}`)).n, 1);
    assert.equal((await getJSON(`day/${DAY}`)).n, 1);
    const month = await getJSON(`month/${MONTH}`);
    assert.equal(month.n, 1);
    assert.equal(month.cost > 0 && month.cost < 0.12, true);
  });

  test('a market lookup for a new IP, day, and month proceeds when head() throws the production not-found error', async () => {
    const ip = '203.0.113.52';
    let lookupCalls = 0;
    globalThis.fetch = async (url) => {
      const href = String(url);
      if (href.startsWith('https://blob.test/')) {
        const pathname = decodeURIComponent(new URL(href).pathname.slice(1));
        const body = objects.get(pathname);
        if (body == null) return new Response('missing', { status: 404 });
        return new Response(body, { headers: { 'content-type': 'application/json' } });
      }
      if (!href.includes('api.openai.com')) return new Response(null, { status: 204 });
      lookupCalls += 1;
      openaiCalls += 1;
      const body = lookupCalls === 1 ? searchBody('HubSpot and Salesforce are common choices.') : lookupBody();
      return Response.json(body);
    };

    const res = await lookupPost(lookupRequest(ip, 'independent bookbinders in Reykjavik'));
    const text = await res.text();
    assert.equal(res.status, 200, text);
    const body = JSON.parse(text);
    assert.equal(body.cached, false);
    assert.equal(body.market, 'independent bookbinders in reykjavik');
    assert.deepEqual(body.brands.map((brand) => brand.name), ['HubSpot', 'Salesforce']);
    assert.equal(lookupCalls, 2);
    assert.equal(text.includes(BLOB_TOKEN), false);
    assert.equal(text.includes(OPENAI_KEY), false);

    const missed = misses.map((entry) => entry.pathname);
    assert.equal(missed.includes(`kv/ip/${DAY}/${hashKey(ip)}.json`), true);
    assert.equal(missed.includes(`kv/day/${DAY}.json`), true);
    assert.equal(missed.includes(`kv/month/${MONTH}.json`), true);
    for (const entry of misses) {
      assert.equal(entry.error.name, 'Error');
      assert.equal(entry.error.constructor.name, 'E');
      assert.equal(entry.error.status, undefined);
      assert.equal(legacyIsMissingBlob(entry.error), false);
    }
    assert.equal(logs.some((line) => line.includes('blob read failed')), false);
    assert.equal((await getJSON(`ip/${DAY}/${hashKey(ip)}`)).n, 1);
    assert.equal((await getJSON(`day/${DAY}`)).n, 1);
    const month = await getJSON(`month/${MONTH}`);
    assert.equal(month.n, 1);
    assert.equal(month.cost > 0 && month.cost < 0.12, true);
  });

  test('a real store error still fails the brand check closed before any spend', async () => {
    headImpl = () => { throw new BlobUnknownError(); };
    const res = await checkPost(checkRequest('203.0.113.53'));
    assert.equal(res.status, 503);
    const body = await res.json();
    assert.equal(body.error, LIMIT_UNAVAILABLE);
    assert.equal(openaiCalls, 0);
    assert.equal(putCalls, 0);
    assert.equal(logs.some((line) => line.includes('blob read failed name=Error')), true);
    assert.equal(logs.join('\n').includes(BLOB_TOKEN), false);
    assert.equal(logs.join('\n').includes(OPENAI_KEY), false);
    assert.equal(logs.join('\n').includes('PathProof'), false);
  });

  test('a store-not-found error still fails the market lookup closed before any spend', async () => {
    headImpl = () => { throw new BlobStoreNotFoundError(); };
    const res = await lookupPost(lookupRequest('203.0.113.54', 'dentist in Denver'));
    assert.equal(res.status, 503);
    const body = await res.json();
    assert.equal(body.error, LIMIT_UNAVAILABLE);
    assert.equal(openaiCalls, 0);
    assert.equal(putCalls, 0);
    assert.equal(logs.join('\n').includes(BLOB_TOKEN), false);
    assert.equal(logs.join('\n').includes('dentist'), false);
  });
});
