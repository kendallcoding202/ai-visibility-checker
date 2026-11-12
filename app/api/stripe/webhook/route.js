import { assertHashSalt, HashSaltError } from '../../../../lib/hash.js';
import { constructStripeEvent } from '../../../../lib/stripeApi.js';
import { applyStripeEvent } from '../../../../lib/trackingEvents.js';
import { eventAlreadyDone, markEventDone, validEventId } from '../../../../lib/trackingRecords.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const noStore = { 'cache-control': 'no-store' };

function reject(status) {
  return Response.json({ error: 'Invalid signature' }, { status, headers: noStore });
}

export async function POST(req) {
  try {
    assertHashSalt();
  } catch (e) {
    if (e instanceof HashSaltError) return Response.json({ error: 'Webhook is temporarily unavailable.' }, { status: 503, headers: noStore });
    throw e;
  }
  const secret = String(process.env.STRIPE_WEBHOOK_SECRET ?? '').trim();
  if (secret.length < 8) return Response.json({ error: 'Webhook is not configured' }, { status: 503, headers: noStore });
  const signature = req.headers.get('stripe-signature');
  if (!signature) return reject(400);
  const payload = await req.text();
  let event;
  try {
    event = constructStripeEvent(payload, signature, secret);
  } catch {
    return reject(400);
  }
  if (!validEventId(event?.id)) return reject(400);
  if (await eventAlreadyDone(event.id)) {
    return Response.json({ received: true, duplicate: true }, { headers: noStore });
  }
  try {
    const result = await applyStripeEvent(event);
    if (!result.ok && result.retry) {
      return Response.json({ error: 'Webhook handling failed' }, { status: 500, headers: noStore });
    }
    await markEventDone(event.id);
    return Response.json({ received: true }, { headers: noStore });
  } catch (error) {
    console.error(`stripe webhook failed name=${error?.name || 'Error'}`);
    return Response.json({ error: 'Webhook handling failed' }, { status: 500, headers: noStore });
  }
}
