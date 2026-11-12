import { clientIp, sameOrigin } from '../../../../lib/sameOrigin.js';
import { offerAllowed, recordTrackingMetric } from '../../../../lib/trackingMetrics.js';
import { trackingTierEnabled } from '../../../../lib/trackingTier.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const noStore = {
  'cache-control': 'no-store, private, max-age=0',
  'cdn-cache-control': 'no-store',
  pragma: 'no-cache',
};

const json = (body, status) => Response.json(body, { status, headers: noStore });
const empty = (status) => new Response(null, { status, headers: noStore });

const CLIENT_EVENTS = new Set(['impression', 'click']);

export async function POST(req) {
  if (!trackingTierEnabled()) return json({ error: 'Not found' }, 404);
  try {
    if (!sameOrigin(req)) return json({ error: 'Forbidden' }, 403);
    const type = (req.headers.get('content-type') ?? '').toLowerCase();
    if (!type.startsWith('application/json')) return json({ error: 'Bad request' }, 400);
    const declared = Number(req.headers.get('content-length') ?? 0);
    if (Number.isFinite(declared) && declared > 200) return json({ error: 'Bad request' }, 400);
    const raw = await req.text();
    if (raw.length > 200) return json({ error: 'Bad request' }, 400);
    let body;
    try { body = JSON.parse(raw); } catch { return json({ error: 'Bad request' }, 400); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ error: 'Bad request' }, 400);
    if (body.company) return json({ error: 'Forbidden' }, 403);
    const keys = Object.keys(body);
    if (keys.length !== 1 || keys[0] !== 'event') return json({ error: 'Bad request' }, 400);
    if (!CLIENT_EVENTS.has(body.event)) return json({ error: 'Bad request' }, 400);
    if (!offerAllowed(clientIp(req))) return empty(204);
    await recordTrackingMetric(body.event);
    return empty(204);
  } catch {
    // A counter failure must not surface on the result page.
    return empty(204);
  }
}
