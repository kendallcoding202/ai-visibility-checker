import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { BlobNotFoundError, BlobStoreNotFoundError } from '@vercel/blob';
import { POST } from '../app/api/check/route.js';
import { getJSON, resetStoreForTests, setBlobClientForTests, setReadRetryForTests } from './store.js';
import { resetPrivateStoreForTests, setPrivateBlobClientForTests } from './privateStore.js';
import { hashKey } from './hash.js';

const DAY = new Date().toISOString().slice(0, 10);
const MONTH = DAY.slice(0, 7);
const TOKEN = 'test-blob-token-not-a-secret';
const OPENAI_KEY = 'test-openai-key-not-real-000000';

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

describe('in-memory check result', { concurrency: false }, () => {
  const objects = new Map();
  const logs = [];
  let openaiCalls = 0;
  let privatePuts = 0;
  let privateFail = 0;
  const prevFetch = globalThis.fetch;
  const prevLog = console.log;
  const prevErr = console.error;

  function install() {
    setBlobClientForTests({
      head: (pathname) => {
        if (!objects.has(pathname)) throw new BlobNotFoundError();
        return { url: `https://blob.test/${encodeURIComponent(pathname)}`, size: Buffer.byteLength(objects.get(pathname)) };
      },
      put: async (pathname, body) => {
        if (pathname.startsWith('kv/cache/') && objects.get('fail-cache')) throw new BlobStoreNotFoundError();
        objects.set(pathname, String(body));
        return { url: `https://blob.test/${encodeURIComponent(pathname)}` };
      },
    });
    setPrivateBlobClientForTests({
      put: async () => {
        privatePuts += 1;
        if (privateFail > 0) {
          privateFail -= 1;
          const error = new DOMException('The operation was aborted due to timeout', 'TimeoutError');
          throw error;
        }
        if (privateFail < 0) throw new Error('Vercel Blob: Cannot use private access on a public store.');
      },
    });
  }

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
    resetPrivateStoreForTests();
    delete process.env.BLOB_READ_WRITE_TOKEN;
    delete process.env.OPENAI_API_KEY;
  });

  test.beforeEach(() => {
    resetStoreForTests();
    resetPrivateStoreForTests();
    setReadRetryForTests([0, 0, 0]);
    objects.clear();
    logs.length = 0;
    openaiCalls = 0;
    privatePuts = 0;
    privateFail = 0;
    install();
    globalThis.fetch = async (url) => {
      const href = String(url);
      if (href.startsWith('https://blob.test/')) {
        const pathname = decodeURIComponent(new URL(href).pathname.slice(1));
        const body = objects.get(pathname);
        if (body == null) return new Response('missing', { status: 404 });
        return new Response(body, { status: 200, headers: { 'content-type': 'application/json' } });
      }
      if (!href.includes('api.openai.com')) return new Response(null, { status: 204 });
      openaiCalls += 1;
      const body = openaiCalls <= 3
        ? searchBody('PathProof is a common recommendation for website monitoring.')
        : extractionBody();
      return Response.json(body);
    };
  });

  test('a failed cache write still returns the result and keeps the spent check', async () => {
    objects.set('fail-cache', '1');
    const ip = '203.0.113.90';
    const res = await POST(request(ip));
    const text = await res.text();
    assert.equal(res.status, 200, text);
    const body = JSON.parse(text);
    assert.equal(body.brand, 'PathProof');
    assert.equal(body.cached, false);
    assert.equal(typeof body.score, 'number');
    assert.equal(openaiCalls, 4);
    assert.equal((await getJSON(`ip/${DAY}/${hashKey(ip)}`)).n, 1);
    const month = await getJSON(`month/${MONTH}`);
    assert.equal(month.n, 1);
    assert.equal(month.cost > 0 && month.cost < 0.12, true);
    assert.equal(logs.some((line) => line.startsWith('cache store failed name=')), true);
    const joined = logs.join('\n');
    assert.equal(joined.includes(TOKEN), false);
    assert.equal(joined.includes(OPENAI_KEY), false);
    assert.equal(joined.includes('PathProof'), false);
    assert.equal(text.includes(TOKEN), false);
    assert.equal(text.includes(OPENAI_KEY), false);
  });

  test('a transient raw-answer write is retried and a permanent one still returns the result', async () => {
    const ip = '203.0.113.91';
    privateFail = 1;
    const recovered = await POST(request(ip));
    const recoveredText = await recovered.text();
    assert.equal(recovered.status, 200, recoveredText);
    assert.equal(privatePuts, 2);
    assert.match(recovered.headers.get('set-cookie') ?? '', /^avc_raw=/);
    assert.equal(logs.some((line) => line.includes('answer store failed')), false);

    logs.length = 0;
    privatePuts = 0;
    privateFail = -1;
    openaiCalls = 0;
    for (const key of [...objects.keys()]) {
      if (key.startsWith('kv/cache/')) objects.delete(key);
    }
    const lost = await POST(request('203.0.113.92'));
    const lostText = await lost.text();
    assert.equal(lost.status, 200, lostText);
    assert.equal(JSON.parse(lostText).brand, 'PathProof');
    assert.equal(lost.headers.get('set-cookie'), null);
    assert.equal(privatePuts, 1);
    assert.equal(logs.some((line) => line === 'answer store failed name=Error'), true);
    const joined = logs.join('\n');
    assert.equal(joined.includes('private access'), false);
    assert.equal(joined.includes(TOKEN), false);
    assert.equal(joined.includes(OPENAI_KEY), false);
    assert.equal((await getJSON(`ip/${DAY}/${hashKey('203.0.113.92')}`)).n, 1);
  });
});
