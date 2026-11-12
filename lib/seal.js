// AES-256-GCM for values that must not sit in plaintext, even in a private store.
// The key comes from HASH_SALT. Do not log plaintext or the salt.
import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'node:crypto';
import { assertHashSalt, DEV_ONLY_HASH_SALT } from './hash.js';

function key() {
  assertHashSalt();
  const raw = process.env.HASH_SALT;
  const salt = typeof raw === 'string' && raw.trim() ? raw : DEV_ONLY_HASH_SALT;
  return createHash('sha256').update(`seal-v1:${salt}`).digest();
}

export function seal(value) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return {
    v: 1,
    iv: iv.toString('base64url'),
    tag: cipher.getAuthTag().toString('base64url'),
    data: enc.toString('base64url'),
  };
}

export function openSeal(payload) {
  if (!payload || payload.v !== 1 || !payload.iv || !payload.tag || !payload.data) return null;
  try {
    const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(payload.iv, 'base64url'));
    decipher.setAuthTag(Buffer.from(payload.tag, 'base64url'));
    const plain = Buffer.concat([
      decipher.update(Buffer.from(payload.data, 'base64url')),
      decipher.final(),
    ]);
    return JSON.parse(plain.toString('utf8'));
  } catch {
    return null;
  }
}
