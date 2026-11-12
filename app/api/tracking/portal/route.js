import { originForMail } from '../../../../lib/emailAddress.js';
import { assertHashSalt, hashKey, HashSaltError } from '../../../../lib/hash.js';
import { readJSON, setJSON } from '../../../../lib/store.js';
import { sameOrigin, clientIp } from '../../../../lib/sameOrigin.js';
import { subscriberByToken } from '../../../../lib/subscribers.js';
import { createTrackingPortal } from '../../../../lib/stripeApi.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TOKEN = /^[A-Za-z0-9_-]{43}$/;
const noStore = { 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' };
const bad = (msg, status = 400) => Response.json({ error: msg }, { status, headers: noStore });

async function limited(req, token) {
  const day = new Date().toISOString().slice(0, 10);
  const keys = [`portal-ip/${day}/${hashKey(clientIp(req))}`, `portal-token/${day}/${hashKey(token)}`];
  for (const key of keys) {
    const read = await readJSON(key);
    if (!read.ok) return false;
    if ((read.value?.n ?? 0) >= 30) return false;
    await setJSON(key, { n: (read.value?.n ?? 0) + 1 });
  }
  return true;
}

async function portalFor(req, token) {
  try {
    assertHashSalt();
  } catch (e) {
    if (e instanceof HashSaltError) return bad('The billing portal is temporarily unavailable.', 503);
    throw e;
  }
  if (!TOKEN.test(token)) return bad('This link is not valid.');
  if (!(await limited(req, token))) return bad('Too many billing requests. Try again tomorrow.', 429);
  const record = await subscriberByToken('manage', token);
  if (!record?.stripeCustomerId) return bad('There is no paid subscription for this address.');
  const origin = originForMail(req.headers.get('host'));
  if (!origin) return bad('The billing portal is not available from this host.', 400);
  const session = await createTrackingPortal({
    customerId: record.stripeCustomerId,
    returnUrl: `${origin}/tracking/manage?token=${encodeURIComponent(token)}`,
  });
  if (!session.ok) {
    const status = session.reason === 'unconfigured' ? 503 : 502;
    return bad(status === 503 ? 'The billing portal is temporarily unavailable.' : 'The billing portal could not be opened.', status);
  }
  return session.url;
}

export async function GET(req) {
  const token = new URL(req.url).searchParams.get('token') ?? '';
  const result = await portalFor(req, token);
  if (typeof result !== 'string') return result;
  return new Response(null, { status: 303, headers: { ...noStore, location: result } });
}

export async function POST(req) {
  if (!sameOrigin(req)) return bad('Forbidden', 403);
  let body;
  try { body = await req.json(); } catch { return bad('Bad request'); }
  const result = await portalFor(req, String(body.token ?? ''));
  if (typeof result !== 'string') return result;
  return Response.json({ url: result }, { headers: noStore });
}
