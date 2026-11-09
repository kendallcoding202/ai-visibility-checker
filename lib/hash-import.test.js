import { test } from 'node:test';
import assert from 'node:assert/strict';

// Simulate a Vercel preview build: NODE_ENV=production, VERCEL_ENV=preview,
// and the sensitive HASH_SALT is not available at build time. Importing the
// route must not throw; a missing salt fails on the request instead.
delete process.env.HASH_SALT;
process.env.NODE_ENV = 'production';
process.env.VERCEL_ENV = 'preview';

test('missing HASH_SALT does not throw at import during a preview build', async () => {
  await assert.doesNotReject(() => import('../app/api/check/route.js'));
  const { HashSaltError, hashKey, hashSaltRequired } = await import('./hash.js');
  assert.equal(hashSaltRequired(), true);
  assert.throws(() => hashKey('203.0.113.8'), HashSaltError);
});
