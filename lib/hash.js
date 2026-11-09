// Salted hashes for rate-limit keys and the 24h result cache.
// HASH_SALT is required on deployed production and preview runtimes.
// The value is resolved only when a key is hashed (request time), not at import,
// so `next build` still succeeds when the sensitive variable is runtime-only.
// Local `next dev` and node:test keep a dev-only fallback. Never log the salt.
import { createHash } from 'node:crypto';

/** Not a secret. Used only when hashSaltRequired() is false. */
export const DEV_ONLY_HASH_SALT = 'dev-only-hash-salt';

export class HashSaltError extends Error {
  constructor() {
    super('HASH_SALT is required');
    this.name = 'HashSaltError';
  }
}

// Production and preview deployments are production builds (NODE_ENV=production),
// including the preview build itself. VERCEL_ENV distinguishes those deployed
// targets from local dev, tests, and Vercel Development (which has no HASH_SALT).
// An unknown or unset VERCEL_ENV still fails closed when NODE_ENV is production
// (`next start`). This is not evaluated during `next build`.
export function hashSaltRequired() {
  const vercelEnv = process.env['VERCEL_ENV'];
  if (vercelEnv === 'production' || vercelEnv === 'preview') return true;
  if (vercelEnv === 'development') return false;
  return process.env.NODE_ENV === 'production';
}

function configuredHashSalt() {
  // Read at runtime. Do not list HASH_SALT in next.config env; that inlines it
  // at build time. Sensitive Vercel vars are available when the request runs.
  const raw = process.env['HASH_SALT'];
  if (typeof raw !== 'string' || raw.trim() === '') return '';
  return raw;
}

function resolveHashSalt() {
  const configured = configuredHashSalt();
  if (configured) return configured;
  if (hashSaltRequired()) throw new HashSaltError();
  return DEV_ONLY_HASH_SALT;
}

export function assertHashSalt() {
  resolveHashSalt();
}

export function hashKey(value) {
  return createHash('sha256').update(String(value) + resolveHashSalt()).digest('hex').slice(0, 24);
}
