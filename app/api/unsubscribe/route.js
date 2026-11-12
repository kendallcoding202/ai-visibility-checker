import { assertHashSalt, HashSaltError } from '../../../lib/hash.js';
import { hashKey } from '../../../lib/hash.js';
import { readJSON, setJSON } from '../../../lib/store.js';
import { sameOrigin } from '../../../lib/sameOrigin.js';
import { clientIp } from '../../../lib/sameOrigin.js';
import { deleteSubscriber, subscriberByToken } from '../../../lib/subscribers.js';
import { cancelStripeSubscription } from '../../../lib/stripeApi.js';
import { forgetTrackingBindings } from '../../../lib/trackingRecords.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const noStore = { 'cache-control': 'no-store' };
const bad = (msg, status = 400) => Response.json({ error: msg }, { status, headers: noStore });

async function tokenFrom(req) {
  const fromQuery = new URL(req.url).searchParams.get('token') ?? '';
  const type = req.headers.get('content-type') ?? '';
  if (!type.includes('application/json')) return fromQuery;
  try {
    const body = await req.json();
    return body?.token ? String(body.token) : fromQuery;
  } catch {
    return fromQuery;
  }
}

export async function POST(req) {
  try {
    assertHashSalt();
  } catch (e) {
    if (e instanceof HashSaltError) return bad('Email is temporarily unavailable. Please try again later.', 503);
    throw e;
  }
  const type = req.headers.get('content-type') ?? '';
  const oneClick = type.includes('application/x-www-form-urlencoded');
  if (!oneClick && !sameOrigin(req)) return bad('Forbidden', 403);

  const day = new Date().toISOString().slice(0, 10);
  const ipKey = `unsub-ip/${day}/${hashKey(clientIp(req))}`;
  const read = await readJSON(ipKey);
  if (!read.ok) return bad('Email is temporarily unavailable. Please try again later.', 503);
  if ((read.value?.n ?? 0) >= 30) return bad('Too many email requests. Try again tomorrow.', 429);
  await setJSON(ipKey, { n: (read.value?.n ?? 0) + 1 });

  const record = await subscriberByToken('unsub', await tokenFrom(req));
  if (!record) return bad('This unsubscribe link is not valid.');
  if (record.stripeSubscriptionId) {
    const canceled = await cancelStripeSubscription(record.stripeSubscriptionId);
    if (!canceled.ok) {
      const status = canceled.reason === 'unconfigured' ? 503 : 502;
      const message = status === 503
        ? 'Billing cancellation is temporarily unavailable. Open the billing portal from the tracking email and cancel there.'
        : 'The subscription could not be canceled. Open the billing portal from the tracking email and cancel there.';
      return bad(message, status);
    }
  }
  await forgetTrackingBindings(record);
  await deleteSubscriber(record.email);
  const message = record.stripeSubscriptionId || record.trackingActive
    ? 'The subscription is canceled and this address is deleted.'
    : 'This address is unsubscribed and deleted.';
  return Response.json({ ok: true, message }, { headers: noStore });
}
