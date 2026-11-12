// Active-subscriber index and Stripe id bindings. Values are sealed.
// The free-checker month counter is never written here.
import { hashKey } from './hash.js';
import { openSeal, seal } from './seal.js';
import { delPrivateKey, getPrivateJSON, putPrivateJSON } from './privateStore.js';
import { getSubscriber, makeToken, saveSubscriber } from './subscribers.js';
import { validCustomerId, validSubscriptionId } from './stripeApi.js';

const HASH_ID = /^[a-f0-9]{24}$/;
const EVENT_ID = /^evt_[A-Za-z0-9_]{1,80}$/;
const ACTIVE_KEY = 'tracking/active';

function stripeKey(kind, id) {
  return `stripe/${kind}/${id}`;
}

async function readActiveIds() {
  const opened = openSeal(await getPrivateJSON(ACTIVE_KEY));
  if (!Array.isArray(opened?.ids)) return [];
  return opened.ids.filter((id) => HASH_ID.test(id));
}

async function writeActiveIds(ids) {
  const unique = [];
  for (const id of ids) {
    if (HASH_ID.test(id) && !unique.includes(id)) unique.push(id);
  }
  // One stable key so the cron can find the list without list(). Reads go
  // through the origin path in privateStore, not the public blob URL.
  await putPrivateJSON(ACTIVE_KEY, seal({ ids: unique.slice(0, 500) }));
}

export async function listTrackingIds() {
  return readActiveIds();
}

export async function rememberTrackingId(id) {
  if (!HASH_ID.test(id)) return;
  const ids = await readActiveIds();
  if (!ids.includes(id)) ids.push(id);
  await writeActiveIds(ids);
}

export async function forgetTrackingId(id) {
  if (!HASH_ID.test(id)) return;
  const ids = await readActiveIds();
  await writeActiveIds(ids.filter((item) => item !== id));
}

async function bindStripeId(kind, id, email) {
  const valid = kind === 'cus' ? validCustomerId(id) : validSubscriptionId(id);
  if (!valid) return;
  await putPrivateJSON(stripeKey(kind, id), seal({ email }));
}

export async function subscriberByStripeId(kind, id) {
  const valid = kind === 'cus' ? validCustomerId(id) : validSubscriptionId(id);
  if (!valid) return null;
  const index = openSeal(await getPrivateJSON(stripeKey(kind, id)));
  if (!index?.email || index.deleted) return null;
  return getSubscriber(index.email);
}

export async function activateTracking(email, { customerId, subscriptionId, brand, category }) {
  const record = await getSubscriber(email);
  if (!record || record.status !== 'confirmed') return null;
  record.trackingActive = true;
  if (!record.manageToken) record.manageToken = makeToken();
  record.stripeCustomerId = validCustomerId(customerId) ? customerId : record.stripeCustomerId || '';
  record.stripeSubscriptionId = validSubscriptionId(subscriptionId) ? subscriptionId : record.stripeSubscriptionId || '';
  record.trackingBrand = brand || record.snapshot?.brand || '';
  record.trackingCategory = category ?? record.snapshot?.category ?? '';
  record.billingEventCount = (record.billingEventCount ?? 0) + 1;
  record.trackingUpdatedAt = new Date().toISOString();
  await saveSubscriber(record);
  const id = hashKey(email);
  await rememberTrackingId(id);
  if (record.stripeCustomerId) await bindStripeId('cus', record.stripeCustomerId, email);
  if (record.stripeSubscriptionId) await bindStripeId('sub', record.stripeSubscriptionId, email);
  return record;
}

export async function deactivateTracking(email) {
  const record = await getSubscriber(email);
  if (!record) return null;
  record.trackingActive = false;
  record.billingEventCount = (record.billingEventCount ?? 0) + 1;
  record.trackingUpdatedAt = new Date().toISOString();
  await saveSubscriber(record);
  await forgetTrackingId(hashKey(email));
  return record;
}

export async function forgetTrackingBindings(record) {
  if (!record?.email) return;
  await forgetTrackingId(hashKey(record.email));
  // Remove the binding. Overwriting it with a tombstone leaves the old object
  // on the CDN at the same pathname.
  if (validCustomerId(record.stripeCustomerId)) await delPrivateKey(stripeKey('cus', record.stripeCustomerId));
  if (validSubscriptionId(record.stripeSubscriptionId)) await delPrivateKey(stripeKey('sub', record.stripeSubscriptionId));
}

export async function eventAlreadyDone(id) {
  if (!EVENT_ID.test(id)) return false;
  const existing = openSeal(await getPrivateJSON(`stripe/event/${id}`));
  return Boolean(existing?.done);
}

export async function markEventDone(id) {
  if (!EVENT_ID.test(id)) return;
  await putPrivateJSON(`stripe/event/${id}`, seal({ done: true }));
}

export function validEventId(id) {
  return EVENT_ID.test(String(id ?? ''));
}
