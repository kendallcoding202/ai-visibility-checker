import { blobReadWorstMs, blobWriteWorstMs, readJSON, safeErrorName, setJSON } from '../../../lib/store.js';
import { heldWithinBudget, refundSpend, reserveSpend, settleMonthCost } from '../../../lib/counters.js';
import { assertHashSalt, hashKey, HashSaltError } from '../../../lib/hash.js';
import { CHECK_TIMEOUT_ERROR, isCheckTimeout } from '../../../lib/checkError.js';
import { dailyCap, estCostPerCheck, monthBudget, perIpDaily } from '../../../lib/limits.js';
import { track } from '@vercel/analytics/server';
import { EVENTS, errorTypeFromStatus, limitReason, trackEvent } from '../../../lib/analyticsEvents.js';
import { parseCheckInput } from '../../../lib/checkInput.js';
import { publicResult } from '../../../lib/publicResult.js';
import { sameOrigin } from '../../../lib/sameOrigin.js';
import { answerCookie, newAnswerToken, rawAnswerPutWorstMs, saveRawAnswers } from '../../../lib/rawAnswers.js';
import { runVisibilityCheck } from '../../../lib/runCheck.js';
import { checkSchedule } from '../../../lib/requestWindow.js';

export const runtime = 'nodejs';
// Pro plan. The schedule stops the model before this so the response is JSON, not a platform kill.
export const maxDuration = 120;

function envMs(name, fallback, max) {
  const n = Number(process.env[name]);
  const ms = Number.isFinite(n) && n > 0 ? n : fallback;
  return Math.min(ms, max);
}
const searchTimeoutMs = () => envMs('SEARCH_TIMEOUT_MS', 40_000, 40_000);

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
  const started = Date.now();
  const schedule = checkSchedule(started);
  const { hardStop, modelDeadline, reserveMs } = schedule;
  const timeLeft = () => hardStop - Date.now();

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
  // A missing cache blob is a miss. A failed cache read is also a miss: the counters below still fail closed.
  const cached = await readJSON(cacheKey);
  if (cached.ok && cached.value && Date.now() - cached.value.at < CACHE_MS && cached.value.result) {
    return Response.json(publicResult(cached.value.result, { id: shareId, cached: true }));
  }

  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown';
  const ipKey = `ip/${day}/${hashKey(ip)}`;
  const dayKey = `day/${day}`;
  const monthKey = `month/${month}`;
  const perIp = perIpDaily();
  const reserve = estCostPerCheck();
  const cap = dailyCap(day);
  const budget = monthBudget(month);
  // The reservation commits only if this request still fits. Parallel requests retry on conflict.
  const reservation = await reserveSpend({ ipKey, dayKey, monthKey, perIp, cap, budget, reserve });
  if (!reservation.ok) return fail(reservation.error, reservation.status);

  // Reserve the slot before spending money. A timeout here still refunds: the write may have landed.
  let cost = 0;
  let reserved = true;
  try {
    const held = await heldWithinBudget(monthKey, budget);
    if (!held.ok) {
      await refundSpend(ipKey, dayKey, monthKey, 0, reserve);
      reserved = false;
      return fail(held.error, held.status);
    }

    const checked = await runVisibilityCheck({
      brand,
      category,
      competitors,
      deadline: modelDeadline,
      searchTimeoutMs: searchTimeoutMs(),
      refundReserveMs: reserveMs,
    });
    cost = checked.cost;
    const { result, rawAnswers } = checked;
    if (timeLeft() > blobWriteWorstMs()) {
      try {
        await setJSON(cacheKey, { at: Date.now(), result });
      } catch (error) {
        console.error(`cache store failed name=${safeErrorName(error)}`);
      }
    }
    let cookie = '';
    if (timeLeft() > rawAnswerPutWorstMs()) {
      try {
        const answerToken = newAnswerToken();
        await saveRawAnswers(answerToken, {
          shareId,
          runs: 1,
          answers: rawAnswers,
        });
        cookie = answerCookie(shareId, answerToken);
      } catch (error) {
        console.error(`answer store failed name=${safeErrorName(error)}`);
      }
    }
    // Replace the reservation with the measured cost. If the counter cannot be re-read, keep the reserve.
    if (timeLeft() > blobReadWorstMs() + blobWriteWorstMs()) {
      try {
        await settleMonthCost(monthKey, reserve, cost);
      } catch (error) {
        console.error(`cost settle failed name=${safeErrorName(error)}`);
      }
    }
    console.log(`check ok cost=$${cost.toFixed(4)}`);
    const payload = publicResult(result, { id: shareId, cached: false });
    if (process.env.SHOW_COST === '1') payload.cost = cost;
    return Response.json(payload, { headers: cookie ? { 'set-cookie': cookie } : {} });
  } catch (e) {
    console.error('check failed', safeErrorName(e));
    if (Number.isFinite(e?.trackingCost)) cost = e.trackingCost;
    if (reserved && timeLeft() > blobReadWorstMs() + blobWriteWorstMs()) {
      await refundSpend(ipKey, dayKey, monthKey, cost, reserve);
    }
    if (isCheckTimeout(e)) return fail(CHECK_TIMEOUT_ERROR, 504);
    return fail('The AI check failed. Please try again in a minute.', 502);
  }
}
