// Email subscribers. The address is sealed. Lookup keys are salted hashes, not the address.
import { randomBytes } from 'node:crypto';
import { hashKey } from './hash.js';
import { openSeal, seal } from './seal.js';
import { getPrivateJSON, putPrivateJSON } from './privateStore.js';

const TOKEN = /^[A-Za-z0-9_-]{43}$/;

export function makeToken() {
  return randomBytes(32).toString('base64url');
}

async function readRecord(email) {
  const record = openSeal(await getPrivateJSON(`mail/addr/${hashKey(email)}`));
  if (!record || record.deleted) return null;
  return record;
}

async function writeRecord(email, record) {
  await putPrivateJSON(`mail/addr/${hashKey(email)}`, seal(record));
}

export async function getSubscriber(email) {
  return readRecord(email);
}

export async function saveSubscriber(record) {
  await writeRecord(record.email, record);
  await putPrivateJSON(`mail/confirm/${hashKey(record.confirmToken)}`, seal({ email: record.email }));
  await putPrivateJSON(`mail/unsub/${hashKey(record.unsubToken)}`, seal({ email: record.email }));
}

export async function subscriberByToken(kind, token) {
  if (kind !== 'confirm' && kind !== 'unsub') return null;
  if (!TOKEN.test(token)) return null;
  const index = openSeal(await getPrivateJSON(`mail/${kind}/${hashKey(token)}`));
  if (!index?.email || index.deleted) return null;
  return readRecord(index.email);
}

export async function markReportSent(email, at) {
  const record = await readRecord(email);
  if (!record) return;
  record.status = 'confirmed';
  record.reportSentAt = at;
  record.confirmedAt = record.confirmedAt || at;
  await writeRecord(email, record);
}

export async function deleteSubscriber(email) {
  const record = await readRecord(email);
  await putPrivateJSON(`mail/addr/${hashKey(email)}`, seal({ deleted: true }));
  if (record?.confirmToken) await putPrivateJSON(`mail/confirm/${hashKey(record.confirmToken)}`, seal({ deleted: true }));
  if (record?.unsubToken) await putPrivateJSON(`mail/unsub/${hashKey(record.unsubToken)}`, seal({ deleted: true }));
}
