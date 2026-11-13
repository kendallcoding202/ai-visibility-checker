import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { BlobNotFoundError, BlobPreconditionFailedError, BlobStoreNotFoundError } from '@vercel/blob';
import { POST as checkPost } from '../app/api/check/route.js';
import { POST as lookupPost } from '../app/api/lookup/route.js';
import { getJSON, resetStoreForTests, setBlobClientForTests, setReadRetryForTests } from './store.js';
import { reserveTrackingBudget } from './trackingCron.js';
import { hashKey } from './hash.js';
import { LIMIT_GLOBAL, LIMIT_MONTH, LIMIT_UNAVAILABLE, ipLimitMessage } from './limits.js';

const DAY = new Date().toISOString().slice(0, 10);
const MONTH = DAY.slice(0, 7);
const TOKEN = 'test-blob-token-not-a-secret';
const OPENAI_KEY = 'test-openai-key-not-real-000000';
const IP = '203.0.113.10';

const ENV_KEYS = [
  'PER_IP_DAILY', 'GLOBAL_DAILY', 'LAUNCH_DAILY', 'LAUNCH_DAYS',
  'MONTHLY_BUDGET_USD', 'LAUNCH_MONTHLY_BUDGET_USD', 'LAUNCH_MONTH',
  'EST_COST_PER_CHECK', 'EST_COST_PER_LOOKUP', 'TRACKING_MONTHLY_BUDGET_USD',
  'OPENAI_API_KEY', 'BLOB_READ_WRITE_TOKEN', 'NODE_ENV', 'VERCEL_ENV', 'HASH_SALT', 'SHOW_COST',
];

function searchBody(text) {
  return {
    output: [
      { type: 'web_search_call' },
      { type: 'message', content: [{ type: 'output_text', text, annotations: [] }] },
    ],
    usage: { input_tokens: 1000, output_tokens: 200 },
  };
}

function jsonBody(data) {
  return {
    output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(data) }] }],
    usage: { input_tokens: 100, output_tokens: 40 },
  };
}

function checkRequest(ip, n) {
  return new Request('https://checker.example/api/check', {
    method: 'POST',
    headers: {
      origin: 'https://checker.example',
      host: 'checker.example',
      'content-type': 'application/json',
      'x-forwarded-for': ip,
    },
    body: JSON.stringify({
      brand: `Brand ${n}`,
      category: `batchcheck ${String(n).padStart(2, '0')} tools`,
      elapsed: 2000,
    }),
  });
}

function lookupRequest(ip, n) {
  return new Request('https://checker.example/api/lookup', {
    method: 'POST',
    headers: {
      origin: 'https://checker.example',
      host: 'checker.example',
      'content-type': 'application/json',
      'x-forwarded-for': ip,
    },
    body: JSON.stringify({
      market: `batchlook ${String(n).padStart(2, '0')} local shops`,
      elapsed: 2000,
    }),
  });
}

function isCounter(pathname) {
  return pathname.startsWith('kv/ip/')
    || pathname.startsWith('kv/day/')
    || pathname.startsWith('kv/month/')
    || pathname.startsWith('kv/tracking-spend/');
}

describe('atomic spend reservations', { concurrency: false }, () => {
  const blobs = new Map();
  const highs = { ip: 0, day: 0, cost: 0, tracking: 0 };
  const seen = new Set();
  const logs = [];
  let blind = 0;
  let seq = 0;
  let failWrites = false;
  let barrier = null;
  let modelGate = Promise.resolve();
  let finished = 0;
  const prevFetch = globalThis.fetch;
  const prevLog = console.log;
  const prevErr = console.error;
  const prevEnv = new Map(ENV_KEYS.map((key) => [key, process.env[key]]));

  function note(pathname, body) {
    if (!isCounter(pathname)) return;
    let value;
    try { value = JSON.parse(String(body)); } catch { return; }
    if (pathname.startsWith('kv/ip/') && Number.isFinite(value?.n)) highs.ip = Math.max(highs.ip, value.n);
    if (pathname.startsWith('kv/day/') && Number.isFinite(value?.n)) highs.day = Math.max(highs.day, value.n);
    if (pathname.startsWith('kv/month/') && Number.isFinite(value?.cost)) highs.cost = Math.max(highs.cost, value.cost);
    if (pathname.startsWith('kv/tracking-spend/') && Number.isFinite(value?.cost)) highs.tracking = Math.max(highs.tracking, value.cost);
  }

  function install() {
    setBlobClientForTests({
      head: async (pathname) => {
        if (barrier && pathname === barrier.path && !barrier.released) {
          barrier.waiting += 1;
          if (barrier.waiting >= barrier.limit) {
            barrier.released = true;
            barrier.release();
          }
          await barrier.gate;
        }
        await Promise.resolve();
        const row = blobs.get(pathname);
        if (!row) throw new BlobNotFoundError();
        return {
          url: `https://blob.test/${encodeURIComponent(pathname)}`,
          size: Buffer.byteLength(row.body),
          etag: row.etag,
        };
      },
      put: async (pathname, body, options) => {
        await Promise.resolve();
        if (failWrites && isCounter(pathname)) throw new BlobStoreNotFoundError();
        const text = String(body);
        const row = blobs.get(pathname);
        if (!row) {
          if (options?.ifMatch) throw new BlobPreconditionFailedError();
          const etag = `"${++seq}"`;
          blobs.set(pathname, { body: text, etag });
          note(pathname, text);
          return { url: `https://blob.test/${encodeURIComponent(pathname)}`, etag };
        }
        if (options?.ifMatch) {
          if (options.ifMatch !== row.etag) throw new BlobPreconditionFailedError();
          const etag = `"${++seq}"`;
          blobs.set(pathname, { body: text, etag });
          note(pathname, text);
          return { url: `https://blob.test/${encodeURIComponent(pathname)}`, etag };
        }
        // A create that lost the race uses allowOverwrite: false and must not commit.
        // An unconditional overwrite of a counter is the read-modify-write bug.
        if (isCounter(pathname) && options?.allowOverwrite !== false) blind += 1;
        if (options?.allowOverwrite === false) {
          throw new Error('Vercel Blob: This blob already exists');
        }
        const etag = `"${++seq}"`;
        blobs.set(pathname, { body: text, etag });
        note(pathname, text);
        return { url: `https://blob.test/${encodeURIComponent(pathname)}`, etag };
      },
    });
    globalThis.fetch = async (url, init) => {
      const href = String(url);
      if (href.includes('api.openai.com')) {
        const body = JSON.parse(init.body);
        const input = String(body.input ?? '');
        const match = input.match(/batch(?:check|look) \d+/);
        if (match) seen.add(match[0]);
        await modelGate;
        const schema = body?.text?.format?.name;
        if (schema === 'market_brands') return Response.json(jsonBody({ brands: ['HubSpot'] }));
        if (schema === 'brand_extraction') {
          return Response.json(jsonBody({
            answers: [
              { brands: ['Other'], sentiment: 'not_mentioned' },
              { brands: ['Other'], sentiment: 'not_mentioned' },
              { brands: ['Other'], sentiment: 'not_mentioned' },
            ],
          }));
        }
        return Response.json(searchBody('A shortlist of tools is available.'));
      }
      const parsed = new URL(href);
      if (parsed.hostname === 'blob.test' || parsed.hostname.endsWith('.blob.vercel-storage.com')) {
        const pathname = decodeURIComponent(parsed.pathname.slice(1));
        const row = blobs.get(pathname);
        if (!row) return new Response('missing', { status: 404 });
        return new Response(row.body, {
          status: 200,
          headers: { 'content-type': 'application/json', etag: row.etag },
        });
      }
      return new Response('unexpected', { status: 500 });
    };
  }

  function arm(path, limit) {
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    barrier = { path, limit, waiting: 0, released: false, release, gate };
  }

  async function waitUntil(pred, label) {
    const start = Date.now();
    while (!pred()) {
      if (Date.now() - start > 8_000) throw new Error(`timed out waiting for ${label}`);
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }

  async function burst(post, requests, gatePath) {
    arm(gatePath, requests.length);
    seen.clear();
    finished = 0;
    let release;
    modelGate = new Promise((resolve) => { release = resolve; });
    const pending = requests.map((req) => post(req).then(async (res) => {
      const text = await res.text();
      finished += 1;
      return { status: res.status, text };
    }));
    await waitUntil(() => finished + seen.size >= requests.length, 'reservations');
    const started = seen.size;
    release();
    const results = await Promise.all(pending);
    return { results, started };
  }

  function assertSafe(text) {
    assert.equal(text.includes(TOKEN), false);
    assert.equal(text.includes(OPENAI_KEY), false);
    assert.equal(text.includes('sk-'), false);
  }

  test.before(() => {
    console.log = (...args) => { logs.push(args.map(String).join(' ')); };
    console.error = (...args) => { logs.push(args.map(String).join(' ')); };
  });

  test.after(() => {
    globalThis.fetch = prevFetch;
    console.log = prevLog;
    console.error = prevErr;
    resetStoreForTests();
    for (const key of ENV_KEYS) {
      const value = prevEnv.get(key);
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  test.beforeEach(() => {
    resetStoreForTests();
    setReadRetryForTests([0, 0, 0]);
    blobs.clear();
    highs.ip = 0;
    highs.day = 0;
    highs.cost = 0;
    highs.tracking = 0;
    seen.clear();
    logs.length = 0;
    blind = 0;
    seq = 0;
    failWrites = false;
    barrier = null;
    finished = 0;
    modelGate = Promise.resolve();
    process.env.BLOB_READ_WRITE_TOKEN = TOKEN;
    process.env.OPENAI_API_KEY = OPENAI_KEY;
    process.env.NODE_ENV = 'test';
    delete process.env.VERCEL_ENV;
    delete process.env.HASH_SALT;
    delete process.env.SHOW_COST;
    process.env.PER_IP_DAILY = '3';
    process.env.GLOBAL_DAILY = '25';
    process.env.LAUNCH_DAYS = '1999-01-01';
    process.env.MONTHLY_BUDGET_USD = '50';
    process.env.LAUNCH_MONTHLY_BUDGET_USD = '50';
    process.env.LAUNCH_MONTH = MONTH;
    process.env.EST_COST_PER_CHECK = '0.12';
    process.env.EST_COST_PER_LOOKUP = '0.12';
    process.env.TRACKING_MONTHLY_BUDGET_USD = '10';
    install();
  });

  test('parallel checks from one IP cannot pass the daily limit', async () => {
    const total = 12;
    const allowed = 3;
    const requests = Array.from({ length: total }, (_, n) => checkRequest(IP, n));
    const { results, started } = await burst(checkPost, requests, `kv/ip/${DAY}/${hashKey(IP)}.json`);
    const ok = results.filter((result) => result.status === 200);
    const denied = results.filter((result) => result.status === 429);
    assert.equal(started, allowed);
    assert.equal(ok.length, allowed);
    assert.equal(denied.length, total - allowed);
    assert.equal(JSON.parse(denied[0].text).error, ipLimitMessage(allowed));
    assert.equal(blind, 0);
    assert.equal(highs.ip <= allowed, true);
    assert.equal(highs.cost <= 50, true);
    assert.equal((await getJSON(`ip/${DAY}/${hashKey(IP)}`)).n, allowed);
    assert.equal((await getJSON(`month/${MONTH}`)).n, allowed);
    for (const result of results) assertSafe(result.text);
    assert.equal(logs.join('\n').includes(TOKEN), false);
    assert.equal(logs.join('\n').includes(OPENAI_KEY), false);
  });

  test('parallel lookups from one IP share that same limit', async () => {
    const total = 10;
    const allowed = 3;
    const requests = Array.from({ length: total }, (_, n) => lookupRequest(IP, n));
    const { results, started } = await burst(lookupPost, requests, `kv/ip/${DAY}/${hashKey(IP)}.json`);
    const ok = results.filter((result) => result.status === 200);
    assert.equal(started, allowed);
    assert.equal(ok.length, allowed);
    assert.equal(blind, 0);
    assert.equal(highs.ip <= allowed, true);
    assert.equal((await getJSON(`ip/${DAY}/${hashKey(IP)}`)).n, allowed);
    for (const result of results) assertSafe(result.text);
  });

  test('checks and lookups together cannot pass the per-IP limit', async () => {
    const checks = Array.from({ length: 6 }, (_, n) => checkRequest(IP, n));
    const lookups = Array.from({ length: 6 }, (_, n) => lookupRequest(IP, n + 20));
    const requests = [...checks, ...lookups];
    const posts = requests.map((req, n) => (n < checks.length ? checkPost : lookupPost));
    arm(`kv/ip/${DAY}/${hashKey(IP)}.json`, requests.length);
    seen.clear();
    finished = 0;
    let release;
    modelGate = new Promise((resolve) => { release = resolve; });
    const pending = requests.map((req, n) => posts[n](req).then(async (res) => {
      const text = await res.text();
      finished += 1;
      return { status: res.status, text };
    }));
    await waitUntil(() => finished + seen.size >= requests.length, 'mixed reservations');
    const started = seen.size;
    release();
    const results = await Promise.all(pending);
    assert.equal(started, 3);
    assert.equal(results.filter((result) => result.status === 200).length, 3);
    assert.equal(blind, 0);
    assert.equal(highs.ip <= 3, true);
    assert.equal((await getJSON(`ip/${DAY}/${hashKey(IP)}`)).n, 3);
    for (const result of results) assertSafe(result.text);
  });

  test('parallel checks cannot pass the monthly budget', async () => {
    process.env.MONTHLY_BUDGET_USD = '0.36';
    process.env.LAUNCH_MONTHLY_BUDGET_USD = '0.36';
    const total = 8;
    const allowed = 3;
    const requests = Array.from({ length: total }, (_, n) => checkRequest(`203.0.113.${20 + n}`, n));
    const { results, started } = await burst(checkPost, requests, `kv/month/${MONTH}.json`);
    const ok = results.filter((result) => result.status === 200);
    const denied = results.filter((result) => result.status === 429);
    assert.equal(started, allowed);
    assert.equal(ok.length, allowed);
    assert.equal(denied.length, total - allowed);
    assert.equal(JSON.parse(denied[0].text).error, LIMIT_MONTH);
    assert.equal(blind, 0);
    assert.equal(highs.cost <= 0.36, true);
    assert.equal(highs.ip <= 3, true);
    assert.equal(highs.day <= 25, true);
    const month = await getJSON(`month/${MONTH}`);
    assert.equal(month.n, allowed);
    assert.equal(month.cost > 0 && month.cost <= 0.36, true);
    for (const result of results) assertSafe(result.text);
    assert.equal(logs.join('\n').includes(OPENAI_KEY), false);
  });

  test('parallel lookups cannot pass the monthly budget either', async () => {
    process.env.MONTHLY_BUDGET_USD = '0.24';
    process.env.LAUNCH_MONTHLY_BUDGET_USD = '0.24';
    const total = 8;
    const allowed = 2;
    const requests = Array.from({ length: total }, (_, n) => lookupRequest(`203.0.113.${40 + n}`, n));
    const { results, started } = await burst(lookupPost, requests, `kv/month/${MONTH}.json`);
    assert.equal(started, allowed);
    assert.equal(results.filter((result) => result.status === 200).length, allowed);
    assert.equal(blind, 0);
    assert.equal(highs.cost <= 0.24, true);
    const month = await getJSON(`month/${MONTH}`);
    assert.equal(month.n, allowed);
    assert.equal(month.cost > 0 && month.cost <= 0.24, true);
    assert.equal(results.some((result) => result.status === 429 && JSON.parse(result.text).error === LIMIT_MONTH), true);
  });

  test('parallel checks cannot pass the global daily cap', async () => {
    process.env.GLOBAL_DAILY = '2';
    const total = 8;
    const requests = Array.from({ length: total }, (_, n) => checkRequest(`203.0.113.${60 + n}`, n));
    const { results, started } = await burst(checkPost, requests, `kv/day/${DAY}.json`);
    const denied = results.filter((result) => result.status === 429);
    assert.equal(started, 2);
    assert.equal(results.filter((result) => result.status === 200).length, 2);
    assert.equal(JSON.parse(denied[0].text).error, LIMIT_GLOBAL);
    assert.equal(blind, 0);
    assert.equal(highs.day <= 2, true);
    assert.equal((await getJSON(`day/${DAY}`)).n, 2);
  });

  test('a counter that cannot be written is denied before any model call', async () => {
    failWrites = true;
    const res = await checkPost(checkRequest(IP, 1));
    const text = await res.text();
    assert.equal(res.status, 503);
    assert.equal(JSON.parse(text).error, LIMIT_UNAVAILABLE);
    assert.equal(seen.size, 0);
    assert.equal(blind, 0);
    assertSafe(text);
    assert.equal(logs.join('\n').includes(TOKEN), false);
    assert.equal(logs.join('\n').includes(OPENAI_KEY), false);
  });

  test('parallel tracking reserves cannot pass TRACKING_MONTHLY_BUDGET_USD', async () => {
    process.env.TRACKING_MONTHLY_BUDGET_USD = '0.10';
    arm('kv/tracking-spend/2026-11.json', 8);
    const results = await Promise.all(Array.from({ length: 8 }, () => reserveTrackingBudget('2026-11')));
    const ok = results.filter((result) => result.ok);
    assert.equal(ok.length, 1);
    assert.equal(results.filter((result) => result.deny === 'budget').length, 7);
    assert.equal(blind, 0);
    assert.equal(highs.tracking <= 0.1, true);
    const stored = await getJSON('tracking-spend/2026-11');
    assert.equal(stored.cost, 0.1);
    assert.equal(stored.n, 1);
  });
});
