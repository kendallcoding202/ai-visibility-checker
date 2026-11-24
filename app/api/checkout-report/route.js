import { normalizeBrand } from '../../../lib/analyze.js';
import { normalizeEmail, originForMail } from '../../../lib/emailAddress.js';
import { assertHashSalt, hashKey, HashSaltError } from '../../../lib/hash.js';
import { readJSON, setJSON } from '../../../lib/store.js';
import { sameOrigin, clientIp } from '../../../lib/sameOrigin.js';
import { createPaidReportCheckout } from '../../../lib/stripeApi.js';
import { paidReportEnabled } from '../../../lib/paidReport.js';
import { track } from '@vercel/analytics/server';
import { EVENTS, trackEvent } from '../../../lib/analyticsEvents.js';
import { readAnswerCookie, loadRawAnswers } from '../../../lib/rawAnswers.js';
import { newReportToken, saveReportAccess } from '../../../lib/paidReportAccess.js';

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
  if (!paidReportEnabled()) return bad('Not found', 404);
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

  const email = normalizeEmail(body.email);
  if (!email) return bad('Please enter a valid email address.');
  const brand = normalizeBrand(body.brand);
  if (!brand) return bad('Run a check first, then get the report.');
  const resultId = String(body.resultId ?? '');
  if (!/^[a-f0-9]{24}$/.test(resultId)) return bad('Run a check first, then get the report.');

  // Fetch and snapshot the check result before creating checkout
  const cached = await readJSON(`cache/${resultId}`);
  if (!cached.ok || !cached.value?.result) {
    return bad('That check is no longer available. Run it again.', 400);
  }

  const day = new Date().toISOString().slice(0, 10);
  const ipOk = await bump(`checkout-report-ip/${day}/${hashKey(clientIp(req))}`, 12);
  if (!ipOk) return bad('Too many checkout attempts. Try again tomorrow.', 429);
  const emailOk = await bump(`checkout-report-email/${day}/${hashKey(email)}`, 8);
  if (!emailOk) return bad('Too many checkout attempts. Try again tomorrow.', 429);

  const session = await createPaidReportCheckout({
    email,
    brand,
    resultId,
    successUrl: `${origin}/r/${resultId}?payment=success`,
    cancelUrl: `${origin}/r/${resultId}`,
  });
  if (!session.ok) {
    const status = session.reason === 'unconfigured' ? 503 : 502;
    return bad(status === 503 ? 'Checkout is temporarily unavailable.' : 'Checkout could not be started.', status);
  }

  // Fetch raw answers if available (from cookie)
  let answers = null;
  try {
    const cookie = readAnswerCookie(req.headers.get('cookie'));
    if (cookie && cookie.shareId === resultId) {
      const raw = await loadRawAnswers(cookie.token);
      if (raw?.shareId === resultId && Array.isArray(raw.answers)) {
        answers = raw.answers;
      }
    }
  } catch {
    // Raw answers optional
  }

  // Snapshot the result and answers durably for webhook delivery (survives cache expiry and re-checks).
  // The download token is not a Stripe field and is not logged.
  const snapshotKey = `paid-report-snapshot/${session.sessionId}`;
  let pdfToken = '';
  try {
    const token = newReportToken();
    const saved = await saveReportAccess({ token, sessionId: session.sessionId, resultId });
    if (saved) pdfToken = token;
  } catch {
    console.error(`paid report access failed sessionId=${session.sessionId}`);
  }
  try {
    await setJSON(snapshotKey, {
      resultId,
      result: cached.value.result,
      answers,
      snapshotAt: Date.now(),
      origin,
      ...(pdfToken ? { pdfToken } : {}),
    });
  } catch {
    console.error(`paid report snapshot failed sessionId=${session.sessionId}`);
    // Continue anyway - webhook will try cache first, then fail gracefully
  }

  try {
    await trackEvent(track, EVENTS.CHECKOUT_STARTED, { type: 'paid_report' });
  } catch { /* the count must not fail checkout */ }
  return Response.json({ url: session.url }, { headers: noStore });
}
