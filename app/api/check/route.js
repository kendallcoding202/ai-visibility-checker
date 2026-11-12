import { getJSON, readJSON, setJSON } from '../../../lib/store.js';
import { assertHashSalt, hashKey, HashSaltError } from '../../../lib/hash.js';
import { CHECK_TIMEOUT_ERROR, isCheckTimeout } from '../../../lib/checkError.js';
import { dailyCap, estCostPerCheck, ipLimitMessage, LIMIT_GLOBAL, LIMIT_MONTH, LIMIT_UNAVAILABLE, money, monthBudget, perIpDaily } from '../../../lib/limits.js';
import { track } from '@vercel/analytics/server';
import { EVENTS, errorTypeFromStatus, limitReason, trackEvent } from '../../../lib/analyticsEvents.js';
import { parseCheckInput } from '../../../lib/checkInput.js';
import { publicResult } from '../../../lib/publicResult.js';
import { sameOrigin } from '../../../lib/sameOrigin.js';
import { answerCookie, newAnswerToken, saveRawAnswers } from '../../../lib/rawAnswers.js';
import { runVisibilityCheck } from '../../../lib/runCheck.js';

export const runtime = 'nodejs';
// Pro plan. The work itself stops around 100s so the catch can refund before this kill.
export const maxDuration = 120;

function envMs(name, fallback, max) {
  const n = Number(process.env[name]);
  const ms = Number.isFinite(n) && n > 0 ? n : fallback;
  return Math.min(ms, max);
}
const checkBudgetMs = () => envMs('CHECK_BUDGET_MS', 100_000, 100_000);
const searchTimeoutMs = () => envMs('SEARCH_TIMEOUT_MS', 40_000, 40_000);
const refundReserveMs = () => envMs('REFUND_RESERVE_MS', 12_000, 15_000);

// Launch-day boost and the November 2026 $50 ceiling live in lib/limits.js.
const CACHE_MS = 24 * 3600 * 1000;

const bad = (msg, status = 400) => Response.json({ error: msg }, { status });
const fail = (msg, status = 400) => {
  const reason = limitReason(status, msg);
  if (reason) void trackEvent(track, EVENTS.CHECK_LIMITED, { reason, engine: 'chatgpt' });
  else void trackEvent(track, EVENTS.CHECK_ERROR, { type: errorTypeFromStatus(status), engine: 'chatgpt' });
  return bad(msg, status);
};

export async function POST(req) {
  try {
    assertHashSalt();
  } catch (e) {
    if (e instanceof HashSaltError) {
      console.error('HASH_SALT is required');
      return fail('The checker is temporarily unavailable. Please try again later.', 503);
    }
    throw e;
  }

  // Basic bot protection: same-origin, JSON only, honeypot, minimum fill time.
  if (!sameOrigin(req)) return fail('Forbidden', 403);
  let body;
  try { body = await req.json(); } catch { return fail('Bad request'); }
  if (body.website) return fail('Forbidden', 403);
  if (!(Number(body.elapsed) >= 1500)) return fail('Please try again.', 400);

  const parsed = parseCheckInput(body);
  if (parsed.error) return fail(parsed.error);
  const { brand, category, competitors } = parsed;

  if ((process.env.OPENAI_API_KEY ?? '').length < 20) return fail('The checker is warming up. Please try again later.', 503);
  const day = new Date().toISOString().slice(0, 10);
  const month = day.slice(0, 7);
  const shareId = hashKey(`${brand}|${category}|${competitors.join(',')}`.toLowerCase());
  const cacheKey = `cache/${shareId}`;
  const cached = await getJSON(cacheKey);
  if (cached && Date.now() - cached.at < CACHE_MS) return Response.json(publicResult(cached.result, { id: shareId, cached: true }));

  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown';
  const ipKey = `ip/${day}/${hashKey(ip)}`;
  const perIp = perIpDaily();
  const reserve = estCostPerCheck();
  const cap = dailyCap(day);
  const budget = monthBudget(month);
  const [ipRead, dayRead, monthRead] = await Promise.all([readJSON(ipKey), readJSON(`day/${day}`), readJSON(`month/${month}`)]);
  // A failed counter read must not look like a zero balance.
  if (!ipRead.ok || !dayRead.ok || !monthRead.ok) return fail(LIMIT_UNAVAILABLE, 503);
  const ipCount = ipRead.value;
  const dayStats = dayRead.value;
  const monthStats = monthRead.value;
  const spent = Number(monthStats?.cost ?? 0);
  if (!Number.isFinite(spent) || !Number.isFinite(budget) || !Number.isFinite(reserve)) return fail(LIMIT_UNAVAILABLE, 503);
  if ((ipCount?.n ?? 0) >= perIp) return fail(ipLimitMessage(perIp), 429);
  if ((dayStats?.n ?? 0) >= cap) return fail(LIMIT_GLOBAL, 429);
  if (money(money(spent) + money(reserve)) > money(budget)) return fail(LIMIT_MONTH, 429);

  // Reserve the slot before spending money. A timeout here still refunds: the write may have landed.
  let cost = 0;
  let reserved = false;
  try {
    reserved = true;
    await Promise.all([
      setJSON(ipKey, { n: (ipCount?.n ?? 0) + 1 }),
      setJSON(`day/${day}`, { n: (dayStats?.n ?? 0) + 1 }),
      setJSON(`month/${month}`, { cost: money(spent + reserve), n: (monthStats?.n ?? 0) + 1 }),
    ]);

    const checked = await runVisibilityCheck({
      brand,
      category,
      competitors,
      deadline: Date.now() + checkBudgetMs(),
      searchTimeoutMs: searchTimeoutMs(),
      refundReserveMs: refundReserveMs(),
    });
    cost = checked.cost;
    const { result, rawAnswers } = checked;
    await setJSON(cacheKey, { at: Date.now(), result });
    let cookie = '';
    try {
      const answerToken = newAnswerToken();
      await saveRawAnswers(answerToken, {
        shareId,
        runs: 1,
        answers: rawAnswers,
      });
      cookie = answerCookie(shareId, answerToken);
    } catch (error) {
      console.error(`answer store failed name=${error?.name || 'Error'}`);
    }
    // Replace the reservation with the measured cost. If the counter cannot be re-read, keep the reserve.
    const m = await readJSON(`month/${month}`);
    if (m.ok) {
      const prev = m.value ?? {};
      await setJSON(`month/${month}`, { ...prev, cost: money(Math.max(0, (prev.cost ?? 0) - reserve + cost)) });
    }
    console.log(`check ok cost=$${cost.toFixed(4)}`);
    const payload = publicResult(result, { id: shareId, cached: false });
    if (process.env.SHOW_COST === '1') payload.cost = cost;
    return Response.json(payload, { headers: cookie ? { 'set-cookie': cookie } : {} });
  } catch (e) {
    console.error('check failed', e instanceof Error ? e.message : 'error');
    if (Number.isFinite(e?.trackingCost)) cost = e.trackingCost;
    if (reserved) await refundReservation(ipKey, day, month, cost, reserve);
    if (isCheckTimeout(e)) return fail(CHECK_TIMEOUT_ERROR, 504);
    return fail('The AI check failed. Please try again in a minute.', 502);
  }
}

async function refundReservation(ipKey, day, month, cost, reserve) {
  // Refund the reserved slot so failures don't burn quota. A failed re-read leaves the reserve in place.
  try {
    const [i2, d2, m2] = await Promise.all([readJSON(ipKey), readJSON(`day/${day}`), readJSON(`month/${month}`)]);
    if (!i2.ok || !d2.ok || !m2.ok) return;
    const prev = m2.value ?? {};
    await Promise.all([
      setJSON(ipKey, { n: Math.max(0, (i2.value?.n ?? 1) - 1) }),
      setJSON(`day/${day}`, { n: Math.max(0, (d2.value?.n ?? 1) - 1) }),
      setJSON(`month/${month}`, { ...prev, cost: money(Math.max(0, (prev.cost ?? 0) - reserve + cost)), n: Math.max(0, (prev.n ?? 1) - 1) }),
    ]);
  } catch {
    // Best effort. The response still has to leave before the platform kill.
  }
}
