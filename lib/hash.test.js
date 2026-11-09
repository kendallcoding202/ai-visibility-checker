import { createHash } from 'node:crypto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEV_ONLY_HASH_SALT, HashSaltError, assertHashSalt, hashKey, hashSaltRequired } from './hash.js';

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

function digest(value, salt) {
  return createHash('sha256').update(value + salt).digest('hex').slice(0, 24);
}

function silenceConsole() {
  const calls = [];
  const methods = ['log', 'info', 'warn', 'error', 'debug'];
  const prev = new Map(methods.map((method) => [method, console[method]]));
  for (const method of methods) {
    console[method] = (...args) => { calls.push([method, args]); };
  }
  return {
    calls,
    restore() {
      for (const [method, fn] of prev) console[method] = fn;
    },
  };
}

test('dev-only fallback is not the old public default', () => {
  assert.notEqual(DEV_ONLY_HASH_SALT, 'aivc');
  assert.match(DEV_ONLY_HASH_SALT, /dev/i);
});

test('local dev and tests hash with the dev-only fallback', async () => {
  const value = '203.0.113.10';
  for (const env of [
    { NODE_ENV: 'development' },
    { NODE_ENV: 'test' },
    {},
    { VERCEL_ENV: 'development', NODE_ENV: 'development' },
  ]) {
    await withEnv({ HASH_SALT: null, ...env }, () => {
      assert.equal(hashSaltRequired(), false);
      assert.equal(hashKey(value), digest(value, DEV_ONLY_HASH_SALT));
      assert.notEqual(hashKey(value), digest(value, 'aivc'));
      assertHashSalt();
    });
  }
});

test('configured HASH_SALT keeps the existing key derivation', async () => {
  const salt = 'configured-test-salt';
  const value = '203.0.113.5';
  await withEnv({ HASH_SALT: salt, NODE_ENV: 'production', VERCEL_ENV: 'production' }, () => {
    const hashed = hashKey(value);
    assert.equal(hashed, digest(value, salt));
    assert.equal(hashed.length, 24);
    assert.match(hashed, /^[a-f0-9]{24}$/);
    assert.equal(hashed.includes(salt), false);
    assert.notEqual(hashed, digest(value, DEV_ONLY_HASH_SALT));
  });
});

test('different salts produce different keys', async () => {
  const value = 'brand|category|';
  const a = await withEnv({ HASH_SALT: 'salt-a', NODE_ENV: 'production', VERCEL_ENV: 'preview' }, () => hashKey(value));
  const b = await withEnv({ HASH_SALT: 'salt-b', NODE_ENV: 'production', VERCEL_ENV: 'preview' }, () => hashKey(value));
  assert.notEqual(a, b);
});

test('production and preview require HASH_SALT', async () => {
  const cases = [
    { NODE_ENV: 'production', VERCEL_ENV: 'production' },
    { NODE_ENV: 'production', VERCEL_ENV: 'preview' },
    { NODE_ENV: 'development', VERCEL_ENV: 'preview' },
    { NODE_ENV: 'production' },
  ];
  for (const env of cases) {
    await withEnv({ HASH_SALT: null, ...env }, () => {
      assert.equal(hashSaltRequired(), true);
      assert.throws(() => hashKey('ip'), (err) => {
        assert.ok(err instanceof HashSaltError);
        assert.equal(err.name, 'HashSaltError');
        assert.equal(err.message, 'HASH_SALT is required');
        assert.equal(JSON.stringify({ message: err.message, name: err.name }).includes('aivc'), false);
        assert.equal(err.message.includes(DEV_ONLY_HASH_SALT), false);
        return true;
      });
      assert.throws(() => assertHashSalt(), HashSaltError);
    });
  }
});

test('blank HASH_SALT is missing in production', async () => {
  for (const salt of ['', '   ', '\n']) {
    await withEnv({ HASH_SALT: salt, NODE_ENV: 'production', VERCEL_ENV: 'production' }, () => {
      assert.throws(() => hashKey('ip'), HashSaltError);
    });
  }
});

test('salt resolution never logs the salt', async () => {
  const secret = 'super-secret-salt-value';
  const spy = silenceConsole();
  try {
    await withEnv({ HASH_SALT: secret, NODE_ENV: 'production', VERCEL_ENV: 'production' }, () => {
      hashKey('ip');
    });
    await withEnv({ HASH_SALT: null, NODE_ENV: 'production', VERCEL_ENV: 'production' }, () => {
      assert.throws(() => hashKey('ip'), HashSaltError);
    });
    await withEnv({ HASH_SALT: null, NODE_ENV: 'development' }, () => {
      hashKey('ip');
    });
  } finally {
    spy.restore();
  }
  assert.equal(spy.calls.length, 0);
  assert.equal(JSON.stringify(spy.calls).includes(secret), false);
});
