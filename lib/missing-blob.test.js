import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BlobError,
  BlobNotFoundError,
  BlobServiceNotAvailable,
  BlobStoreNotFoundError,
  BlobUnknownError,
} from '@vercel/blob';
import { POST as checkPOST } from '../app/api/check/route.js';
import { POST as lookupPOST } from '../app/api/lookup/route.js';
import { hashKey } from './hash.js';
import { isMissingBlob, resetStoreForTests, setBlobForTests } from './store.js';

const DAY = new Date().toISOString().slice(0, 10);
const MONTH = DAY.slice(0, 7);
const TOKEN = 'test-blob-token';
const OPENAI_KEY = 'test-openai-key-not-real-000000';
const NOT_FOUND_MESSAGE = 'Vercel Blob: The requested blob does not exist';

// The installed class already reports name "Error" and has no status.
// Rename the constructor as well, the way a minified bundle would.
function productionNotFound() {
  const error = new BlobNotFoundError();
  Object.defineProperty(error, 'name', { configurable: true, value: 'Error' });
  Object.defineProperty(error, 'constructor', { configurable: true, value: function t() {} });
  return error;
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
    body: JSON.stringify({
      brand: 'PathProof',
      category: 'website monitoring',
      competitors: '',
      website: '',
      elapsed: 2000,
    }),
  });
}

function lookupRequest(ip, market = 'pocket abacus repair') {
  return new Request('https://checker.example/api/lookup', {
    method: 'POST',
    headers: {
      origin: 'https://checker.example',
      host: 'checker.example',
      'content-type': 'application/json',
      'x-forwarded-for': ip,
    },
    body: JSON.stringify({ market, website: '', elapsed: 2000 }),
  });
}

function openaiResponse(bodyText) {
  const body = JSON.parse(bodyText);
  if (body?.text?.format?.name === 'market_brands') {
    return Response.json({
      output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify({ brands: ['HubSpot', 'Salesforce'] }) }] }],
      usage: { input_tokens: 80, output_tokens: 20 },
    });
  }
  if (body?.text?.format) {
    return Response.json({
      output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify({
        answers: [
          { brands: ['PathProof'], sentiment: 'positive' },
          { brands: ['PathProof'], sentiment: 'neutral' },
          { brands: ['PathProof'], sentiment: 'positive' },
        ],
      }) }] }],
      usage: { input_tokens: 80, output_tokens: 30 },
    });
  }
  return Response.json({
    output: [
      { type: 'web_search_call' },
      { type: 'message', content: [{ type: 'output_text', text: 'PathProof is often recommended for website monitoring.', annotations: [] }] },
    ],
    usage: { input_tokens: 200, output_tokens: 40 },
  });
}

describe('missing blob keys', { concurrency: false }, () => {
  const prevFetch = globalThis.fetch;
  const prevLog = console.log;
  const prevErr = console.error;
  const envKeys = ['BLOB_READ_WRITE_TOKEN', 'OPENAI_API_KEY', 'NODE_ENV', 'VERCEL_ENV', 'HASH_SALT'];
  const prevEnv = new Map(envKeys.map((key) => [key, process.env[key]]));
  const logs = [];

  test.before(() => {
    process.env.BLOB_READ_WRITE_TOKEN = TOKEN;
    process.env.OPENAI_API_KEY = OPENAI_KEY;
    process.env.NODE_ENV = 'test';
    delete process.env.VERCEL_ENV;
    delete process.env.HASH_SALT;
    console.log = () => {};
    console.error = (...args) => { logs.push(args.map(String).join(' ')); };
  });

  test.after(() => {
    globalThis.fetch = prevFetch;
    console.log = prevLog;
    console.error = prevErr;
    resetStoreForTests();
    for (const key of envKeys) {
      const value = prevEnv.get(key);
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  test.beforeEach(() => {
    resetStoreForTests();
    logs.length = 0;
    process.env.BLOB_READ_WRITE_TOKEN = TOKEN;
  });

  test('the installed not-found error is a missing key, including a renamed class', () => {
    const error = new BlobNotFoundError();
    assert.equal(error.name, 'Error');
    assert.equal(error.message, NOT_FOUND_MESSAGE);
    assert.equal(error.status, undefined);
    assert.equal(isMissingBlob(error), true);
    const renamed = productionNotFound();
    assert.equal(renamed.name, 'Error');
    assert.equal(renamed.constructor.name, 't');
    assert.equal(renamed.status, undefined);
    assert.equal(renamed instanceof BlobNotFoundError, true);
    assert.equal(isMissingBlob(renamed), true);

    const detached = new Error(NOT_FOUND_MESSAGE);
    detached.name = 'Error';
    assert.equal(detached instanceof BlobNotFoundError, false);
    assert.equal(isMissingBlob(detached), true);
  });

  test('store outages and transport errors are not missing keys', () => {
    for (const error of [
      new BlobServiceNotAvailable(),
      new BlobStoreNotFoundError(),
      new BlobUnknownError(),
      new BlobError('Bad request'),
      Object.assign(new Error('fetch failed'), { name: 'TypeError' }),
      Object.assign(new Error('The operation was aborted'), { name: 'TimeoutError' }),
      Object.assign(new Error('blob down'), { status: 500 }),
      Object.assign(new Error('blob down'), { statusCode: 503 }),
    ]) {
      assert.equal(error.name === 'BlobNotFoundError', false);
      assert.equal(isMissingBlob(error), false, error.message);
    }
    assert.equal(isMissingBlob(Object.assign(new Error('gone'), { status: 404 })), true);
    assert.equal(isMissingBlob(null), false);
    assert.equal(isMissingBlob(undefined), false);
  });

  test('a new IP, day, and month can run a brand check and a market lookup', async () => {
    const blob = installBlob(productionNotFound);
    let modelCalls = 0;
    globalThis.fetch = (url, opts) => {
      const href = String(url);
      if (href.startsWith('https://blob.test/')) return blobResponse(blob, href);
      if (href.includes('api.openai.com')) {
        modelCalls += 1;
        return openaiResponse(opts.body);
      }
      return new Response('no', { status: 204 });
    };

    const checkIp = '203.0.113.41';
    const check = await checkPOST(checkRequest(checkIp));
    assert.equal(check.status, 200);
    const checkBody = await check.json();
    assert.equal(checkBody.cached, false);
    assert.equal(checkBody.brand, 'PathProof');
    assert.equal(modelCalls, 4);
    assert.equal(blob.heads >= 4, true);
    const checkIpKey = `ip/${DAY}/${hashKey(checkIp)}`;
    assert.equal(blob.read(checkIpKey).n, 1);
    assert.equal(blob.read(`day/${DAY}`).n, 1);
    const checkMonth = blob.read(`month/${MONTH}`);
    assert.equal(checkMonth.n, 1);
    assert.equal(checkMonth.cost > 0 && checkMonth.cost < 0.12, true);
    assert.equal(logs.some((line) => line.startsWith('blob read failed')), false);
    assert.equal(JSON.stringify(checkBody).includes(TOKEN), false);
    assert.equal(JSON.stringify(checkBody).includes(OPENAI_KEY), false);

    blob.reset();
    logs.length = 0;
    const callsAfterCheck = modelCalls;
    const lookupIp = '203.0.113.42';
    const lookup = await lookupPOST(lookupRequest(lookupIp));
    assert.equal(lookup.status, 200);
    const lookupBody = await lookup.json();
    assert.equal(lookupBody.cached, false);
    assert.equal(lookupBody.market, 'pocket abacus repair');
    assert.deepEqual(lookupBody.brands.map((b) => b.name), ['HubSpot', 'Salesforce']);
    assert.equal(modelCalls - callsAfterCheck, 2);
    assert.equal(blob.heads >= 4, true);
    const lookupIpKey = `ip/${DAY}/${hashKey(lookupIp)}`;
    assert.equal(blob.read(lookupIpKey).n, 1);
    assert.equal(blob.read(`day/${DAY}`).n, 1);
    const lookupMonth = blob.read(`month/${MONTH}`);
    assert.equal(lookupMonth.n, 1);
    assert.equal(lookupMonth.cost > 0 && lookupMonth.cost < 0.12, true);
    assert.equal(logs.some((line) => line.startsWith('blob read failed')), false);
    assert.equal(JSON.stringify(lookupBody).includes(TOKEN), false);
    assert.equal(JSON.stringify(lookupBody).includes(OPENAI_KEY), false);
  });

  test('a present counter is still enforced when other keys are missing', async () => {
    const blob = installBlob(productionNotFound);
    let modelCalls = 0;
    globalThis.fetch = (url) => {
      const href = String(url);
      if (href.startsWith('https://blob.test/')) return blobResponse(blob, href);
      if (href.includes('api.openai.com')) {
        modelCalls += 1;
        return new Response('should not spend', { status: 500 });
      }
      return new Response('no', { status: 204 });
    };

    blob.seed(`ip/${DAY}/${hashKey('203.0.113.43')}`, { n: 3 });
    const ipLimited = await lookupPOST(lookupRequest('203.0.113.43'));
    assert.equal(ipLimited.status, 429);
    assert.match(await ipLimited.text(), /free checks/i);
    assert.equal(modelCalls, 0);
    assert.equal(blob.puts.length, 0);

    blob.reset();
    blob.seed(`month/${MONTH}`, { cost: 19.95, n: 4 });
    const monthLimited = await checkPOST(checkRequest('203.0.113.44'));
    assert.equal(monthLimited.status, 429);
    assert.match(await monthLimited.text(), /monthly/i);
    assert.equal(modelCalls, 0);
    assert.equal(blob.puts.length, 0);
    assert.equal(blob.read(`month/${MONTH}`).cost, 19.95);
  });

  test('transport and store errors fail closed before any model call', async () => {
    for (const failure of [
      () => new BlobServiceNotAvailable(),
      () => Object.assign(new Error('fetch failed'), { name: 'TypeError' }),
      () => Object.assign(new Error('The operation was aborted'), { name: 'TimeoutError' }),
      () => new BlobStoreNotFoundError(),
    ]) {
      const blob = installBlob(productionNotFound, failure);
      let modelCalls = 0;
      globalThis.fetch = (url) => {
        const href = String(url);
        if (href.includes('api.openai.com')) {
          modelCalls += 1;
          return new Response('should not spend', { status: 500 });
        }
        return new Response('no', { status: 500 });
      };
      const check = await checkPOST(checkRequest('203.0.113.45'));
      assert.equal(check.status, 503, failure.name);
      assert.equal((await check.json()).error, 'The checker is temporarily unavailable. Please try again later.');
      const lookup = await lookupPOST(lookupRequest('203.0.113.46'));
      assert.equal(lookup.status, 503, failure.name);
      assert.equal((await lookup.json()).error, 'The checker is temporarily unavailable. Please try again later.');
      assert.equal(modelCalls, 0, failure.name);
      assert.equal(blob.puts.length, 0, failure.name);
      assert.equal(blob.heads > 0, true);
      const logged = logs.join('\n');
      assert.equal(logged.includes('blob read failed name='), true);
      assert.equal(logged.includes(TOKEN), false);
      assert.equal(logged.includes(OPENAI_KEY), false);
      assert.equal(logged.includes('PathProof'), false);
      assert.equal(logged.includes('pocket abacus'), false);
      logs.length = 0;
    }
  });
});

function installBlob(missing, failure) {
  const store = new Map();
  const state = { heads: 0, puts: [], store };
  setBlobForTests({
    async head(pathname) {
      state.heads += 1;
      if (failure) throw failure();
      if (!store.has(pathname)) throw missing();
      return { url: `https://blob.test/${encodeURIComponent(pathname)}` };
    },
    async put(pathname, body) {
      state.puts.push(pathname);
      store.set(pathname, typeof body === 'string' ? body : JSON.stringify(body));
    },
  });
  return {
    store,
    get heads() { return state.heads; },
    get puts() { return state.puts; },
    seed(key, value) { store.set(`kv/${key}.json`, JSON.stringify(value)); },
    read(key) {
      const raw = store.get(`kv/${key}.json`);
      return raw ? JSON.parse(raw) : null;
    },
    reset() {
      store.clear();
      state.heads = 0;
      state.puts.length = 0;
    },
  };
}

function blobResponse(blob, href) {
  const pathname = decodeURIComponent(new URL(href).pathname.slice(1));
  const raw = blob.store.get(pathname);
  if (raw == null) return new Response('missing', { status: 404 });
  return new Response(raw, { status: 200, headers: { 'content-type': 'application/json' } });
}
