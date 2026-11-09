import { test } from 'node:test';
import assert from 'node:assert/strict';
import { POST } from '../app/api/check/route.js';

const ENV_KEYS = ['HASH_SALT', 'NODE_ENV', 'VERCEL_ENV'];

async function withEnv(overrides, fn) {
  const prev = new Map(ENV_KEYS.map((key) => [key, process.env[key]]));
  for (const key of ENV_KEYS) {
    if (!Object.hasOwn(overrides, key) || overrides[key] == null) delete process.env[key];
    else process.env[key] = overrides[key];
  }
  try {
    return await fn();
  } finally {
    for (const key of ENV_KEYS) {
      const value = prev.get(key);
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

function silenceConsole() {
  const calls = [];
  const prev = console.error;
  console.error = (...args) => { calls.push(args); };
  return {
    calls,
    restore() { console.error = prev; },
  };
}

test('POST returns 503 in production when HASH_SALT is missing and does not expose a salt', async () => {
  const spy = silenceConsole();
  try {
    await withEnv({ HASH_SALT: null, NODE_ENV: 'production', VERCEL_ENV: 'production' }, async () => {
      const res = await POST(new Request('https://checker.example/api/check', { method: 'POST' }));
      assert.equal(res.status, 503);
      const body = await res.json();
      const serialized = JSON.stringify(body);
      assert.equal(body.error, 'The checker is temporarily unavailable. Please try again later.');
      assert.equal(serialized.includes('aivc'), false);
      assert.equal(serialized.includes('dev-only'), false);
      assert.equal(serialized.includes('HASH_SALT'), false);
    });
  } finally {
    spy.restore();
  }
  assert.deepEqual(spy.calls, [['HASH_SALT is required']]);
  assert.equal(JSON.stringify(spy.calls).includes('aivc'), false);
});

test('POST returns 503 on preview when HASH_SALT is blank', async () => {
  const spy = silenceConsole();
  try {
    await withEnv({ HASH_SALT: '  ', NODE_ENV: 'production', VERCEL_ENV: 'preview' }, async () => {
      const res = await POST(new Request('https://checker.example/api/check', { method: 'POST' }));
      assert.equal(res.status, 503);
    });
  } finally {
    spy.restore();
  }
  assert.deepEqual(spy.calls, [['HASH_SALT is required']]);
});

test('POST in local dev does not require HASH_SALT and does not log a salt', async () => {
  const spy = silenceConsole();
  try {
    await withEnv({ HASH_SALT: null, NODE_ENV: 'development', VERCEL_ENV: null }, async () => {
      const res = await POST(new Request('https://checker.example/api/check', {
        method: 'POST',
        headers: { origin: 'https://evil.example', host: 'checker.example' },
      }));
      assert.equal(res.status, 403);
    });
  } finally {
    spy.restore();
  }
  assert.deepEqual(spy.calls, []);
});

test('POST in production with HASH_SALT set does not log the salt', async () => {
  const secret = 'runtime-salt-not-for-logs';
  const spy = silenceConsole();
  try {
    await withEnv({ HASH_SALT: secret, NODE_ENV: 'production', VERCEL_ENV: 'production' }, async () => {
      const res = await POST(new Request('https://checker.example/api/check', { method: 'POST' }));
      assert.equal(res.status, 403);
      const body = await res.text();
      assert.equal(body.includes(secret), false);
    });
  } finally {
    spy.restore();
  }
  assert.equal(JSON.stringify(spy.calls).includes(secret), false);
});
