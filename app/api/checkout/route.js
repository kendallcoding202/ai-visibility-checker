import { normalizeBrand } from '../../../lib/analyze.js';
import { normalizeEmail, originForMail } from '../../../lib/emailAddress.js';
import { assertHashSalt, hashKey, HashSaltError } from '../../../lib/hash.js';
import { readJSON, setJSON } from '../../../lib/store.js';
import { sameOrigin, clientIp } from '../../../lib/sameOrigin.js';
import { getSubscriber } from '../../../lib/subscribers.js';
import { createTrackingCheckout } from '../../../lib/stripeApi.js';
import { trackingTierEnabled } from '../../../lib/trackingTier.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const noStore = { 'cache-control': 'no-store' };
const bad = (msg, status = 400) => Response.json({ error: msg }, { status, headers: noStore });

async function bump(key, limit) {
  const read = await readJSON(key);
  if (!read.ok) return false;
  const n = read.value?.n ?? 0;
  if (n >= limit) return false;
  await setJSON(key, { n: n + 1 });
  return true;
}

export async function POST(req) {
  if (!trackingTierEnabled()) return bad('Not found', 404);
  try {
    assertHashSalt();
  } catch (e) {
    if (e instanceof HashSaltError) return bad('Checkout is temporarily unavailable.', 503);
    throw e;
  }
  if (!sameOrigin(req)) return bad('Forbidden', 403);
  const origin = originForMail(req.headers.get('host'));
  if (!origin) return bad('Checkout is not available from this host.', 400);

  let body;
  try { body = await req.json(); } catch { return bad('Bad request'); }
  if (body.company) return bad('Forbidden', 403);
  if (!(Number(body.elapsed) >= 1000)) return bad('Please try again.');

  const email = normalizeEmail(body.email);
  if (!email) return bad('Enter the confirmed email address.');
  const brand = normalizeBrand(body.brand);
  if (!brand) return bad('Run a check first, then subscribe.');

  const day = new Date().toISOString().slice(0, 10);
  const ipOk = await bump(`checkout-ip/${day}/${hashKey(clientIp(req))}`, 12);
  if (!ipOk) return bad('Too many checkout attempts. Try again tomorrow.', 429);
  const emailOk = await bump(`checkout-email/${day}/${hashKey(email)}`, 8);
  if (!emailOk) return bad('Too many checkout attempts. Try again tomorrow.', 429);

  const record = await getSubscriber(email);
  if (!record || record.status !== 'confirmed') return bad('Confirm the email for this brand before subscribing.');
  const saved = normalizeBrand(record.snapshot?.brand);
  if (!saved || saved !== brand) return bad('Confirm the email for this brand before subscribing.');
  if (record.trackingActive && record.stripeSubscriptionId) {
    return bad('This address already has monthly tracking. Use the manage link in the tracking email.');
  }

  const session = await createTrackingCheckout({
    email,
    brand: record.snapshot.brand,
    customerId: record.stripeCustomerId,
    successUrl: `${origin}/tracking/success?session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${origin}/tracking/canceled`,
  });
  if (!session.ok) {
    const status = session.reason === 'unconfigured' ? 503 : 502;
    return bad(status === 503 ? 'Checkout is temporarily unavailable.' : 'Checkout could not be started.', status);
  }
  return Response.json({ url: session.url }, { headers: noStore });
}
