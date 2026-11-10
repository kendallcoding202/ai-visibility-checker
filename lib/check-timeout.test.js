import { test } from 'node:test';
import assert from 'node:assert/strict';
import { POST, maxDuration } from '../app/api/check/route.js';
import { getJSON } from './store.js';
import { hashKey } from './hash.js';
import { CHECK_TIMEOUT_ERROR } from './checkError.js';

const DAY = new Date().toISOString().slice(0, 10);
const MONTH = DAY.slice(0, 7);

function silence() {
  const prevErr = console.error;
  const prevLog = console.log;
  const errors = [];
  console.error = (...args) => { errors.push(args.map(String).join(' ')); };
  console.log = () => {};
  return {
    errors,
    restore() {
      console.error = prevErr;
      console.log = prevLog;
    },
  };
}

function request(ip) {
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

function hangUntilAbort(signal) {
  return new Promise((resolve, reject) => {
    if (!signal) {
      reject(new Error('missing abort signal'));
      return;
    }
    // AbortSignal.timeout does not keep the event loop alive by itself.
    const backup = setTimeout(() => reject(new Error('signal did not abort')), 1_000);
    const finish = () => {
      clearTimeout(backup);
      reject(signal.reason);
    };
    if (signal.aborted) finish();
    else signal.addEventListener('abort', finish, { once: true });
  });
}

test('slow OpenAI aborts inside the budget, refunds the reservation, and returns JSON', { timeout: 5_000 }, async () => {
  assert.equal(maxDuration, 120);
  const prevFetch = globalThis.fetch;
  const prev = {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    CHECK_BUDGET_MS: process.env.CHECK_BUDGET_MS,
    SEARCH_TIMEOUT_MS: process.env.SEARCH_TIMEOUT_MS,
    REFUND_RESERVE_MS: process.env.REFUND_RESERVE_MS,
    BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN,
    NODE_ENV: process.env.NODE_ENV,
    VERCEL_ENV: process.env.VERCEL_ENV,
  };
  const apiKey = 'test-openai-key-not-real-000000';
  process.env.OPENAI_API_KEY = apiKey;
  process.env.CHECK_BUDGET_MS = '400';
  process.env.SEARCH_TIMEOUT_MS = '80';
  process.env.REFUND_RESERVE_MS = '50';
  delete process.env.BLOB_READ_WRITE_TOKEN;
  process.env.NODE_ENV = 'test';
  delete process.env.VERCEL_ENV;

  const ip = '203.0.113.44';
  const ipKey = `ip/${DAY}/${hashKey(ip)}`;
  const spy = silence();
  globalThis.fetch = (url, opts) => {
    if (String(url).includes('api.openai.com')) return hangUntilAbort(opts?.signal);
    return prevFetch(url, opts);
  };
  try {
    const res = await POST(request(ip));
    assert.equal(res.status, 504);
    const body = await res.json();
    assert.equal(body.error, CHECK_TIMEOUT_ERROR);
    assert.equal(typeof body.error, 'string');
    assert.equal((await getJSON(ipKey))?.n ?? 0, 0);
    assert.equal((await getJSON(`day/${DAY}`))?.n ?? 0, 0);
    const month = await getJSON(`month/${MONTH}`);
    assert.equal(month?.cost ?? 0, 0);
    assert.equal(month?.n ?? 0, 0);
    const logged = spy.errors.join('\n');
    assert.equal(logged.includes('check failed'), true);
    assert.equal(logged.includes(apiKey), false);
    assert.equal(logged.includes('PathProof'), false);

    globalThis.fetch = () => Promise.resolve(new Response('nope', { status: 500 }));
    const again = await POST(request(ip));
    assert.equal(again.status, 502);
    const againBody = await again.json();
    assert.equal(againBody.error, 'The AI check failed. Please try again in a minute.');
    assert.equal((await getJSON(ipKey))?.n ?? 0, 0);
    assert.equal((await getJSON(`month/${MONTH}`))?.cost ?? 0, 0);
    assert.equal((await getJSON(`month/${MONTH}`))?.n ?? 0, 0);
  } finally {
    globalThis.fetch = prevFetch;
    spy.restore();
    for (const [key, value] of Object.entries(prev)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
