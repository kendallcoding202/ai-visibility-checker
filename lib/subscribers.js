// Email subscribers. The address is sealed. Lookup keys are salted hashes, not the address.
// Each save writes a new record at mail/v/<nonce> and does not overwrite that object.
// A token maps to that pathname: mail/<kind>/<hash(token)> holds the nonce.
// Unsubscribe deletes those objects and writes a new revocation key. It does not
// overwrite the token or the address with a tombstone the CDN can keep serving.
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { hashKey } from './hash.js';
import { openSeal, seal } from './seal.js';
import { delPrivateKey, getPrivateJSON, hasPrivateKey, putPrivateJSON } from './privateStore.js';

const TOKEN = /^[A-Za-z0-9_-]{43}$/;
const KINDS = ['confirm', 'unsub', 'manage'];

export function makeToken() {
  return randomBytes(32).toString('base64url');
}

function tokenKey(kind, token) {
  return `mail/${kind}/${hashKey(token)}`;
}

function versionKey(version) {
  return `mail/v/${version}`;
}

function addrKey(email) {
  return `mail/addr/${hashKey(email)}`;
}

function revokedKey(token) {
  return `mail/x/${hashKey(token)}`;
}

function tokenField(kind) {
  if (kind === 'confirm') return 'confirmToken';
  if (kind === 'unsub') return 'unsubToken';
  if (kind === 'manage') return 'manageToken';
  return '';
}

function sameToken(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

async function readVersion(version, retry) {
  if (!TOKEN.test(version || '')) return null;
  const record = openSeal(await getPrivateJSON(versionKey(version), { retry }));
  if (!record || record.deleted || !record.email) return null;
  return record;
}

async function readLegacy(email) {
  const stored = openSeal(await getPrivateJSON(addrKey(email), { retry: true }));
  if (!stored || stored.deleted) return null;
  if (stored.version) return readVersion(stored.version, true);
  if (!stored.email) return null;
  return stored;
}

export async function getSubscriber(email) {
  const pointer = openSeal(await getPrivateJSON(addrKey(email)));
  if (!pointer || pointer.deleted) return null;
  if (pointer.version) {
    const record = await readVersion(pointer.version, true);
    if (record) return record;
  }
  if (pointer.email && !pointer.version) return pointer;
  return null;
}

export async function saveSubscriber(record) {
  if (!record?.email) return;
  const previous = await getSubscriber(record.email);
  const version = makeToken();
  record.version = version;
  await putPrivateJSON(versionKey(version), seal(record), { once: true });
  const pointer = seal({ version });
  for (const kind of KINDS) {
    const token = record[tokenField(kind)];
    if (!TOKEN.test(token || '')) continue;
    await putPrivateJSON(tokenKey(kind, token), pointer);
  }
  // The address key stays stable so the tracking cron can find hashKey(email).
  // It stores the nonce, not the record. Token lookups do not read it.
  await putPrivateJSON(addrKey(record.email), seal({ version, email: record.email }));
  if (previous?.version && previous.version !== version) await delPrivateKey(versionKey(previous.version));
}

export async function subscriberByToken(kind, token) {
  if (kind !== 'confirm' && kind !== 'unsub' && kind !== 'manage') return null;
  if (!TOKEN.test(token)) return null;
  if (await hasPrivateKey(revokedKey(token))) return null;
  const index = openSeal(await getPrivateJSON(tokenKey(kind, token), { retry: true }));
  if (!index || index.deleted) return null;
  if (index.version) {
    const record = await readVersion(index.version, true);
    if (!record) return null;
    if (!sameToken(record[tokenField(kind)], token)) return null;
    return record;
  }
  if (!index.email) return null;
  const legacy = await readLegacy(index.email);
  if (!legacy) return null;
  if (legacy[tokenField(kind)] && !sameToken(legacy[tokenField(kind)], token)) return null;
  return legacy;
}

export async function markReportSent(emailOrRecord, at) {
  const record = typeof emailOrRecord === 'string' ? await getSubscriber(emailOrRecord) : emailOrRecord;
  if (!record?.email) return;
  record.status = 'confirmed';
  record.reportSentAt = at;
  record.confirmedAt = record.confirmedAt || at;
  await saveSubscriber(record);
}

async function retire(record, revoked) {
  if (!record) return;
  for (const kind of KINDS) {
    const token = record[tokenField(kind)];
    if (!TOKEN.test(token || '') || revoked.has(token)) continue;
    revoked.add(token);
    await putPrivateJSON(revokedKey(token), seal({ deleted: true }), { once: true });
    await delPrivateKey(tokenKey(kind, token));
  }
  if (TOKEN.test(record.version || '')) await delPrivateKey(versionKey(record.version));
}

export async function deleteSubscriber(emailOrRecord) {
  const passed = emailOrRecord && typeof emailOrRecord === 'object' ? emailOrRecord : null;
  const email = typeof emailOrRecord === 'string' ? emailOrRecord : passed?.email;
  if (!email || typeof email !== 'string') return;
  const current = await getSubscriber(email);
  const revoked = new Set();
  await retire(passed, revoked);
  if (!passed || current?.confirmToken !== passed.confirmToken || current?.version !== passed.version) {
    await retire(current, revoked);
  }
  await delPrivateKey(addrKey(email));
}
