import { askWithSearch, json, costOf } from '../../../lib/openai.js';
import { LOOKUP_SCHEMA, lookupExtractionPrompt, cleanBrandList } from '../../../lib/analyze.js';
import { lookupRejection, lookupUserPrompt, normalizeLookup } from '../../../lib/lookupInput.js';
import { blobReadWorstMs, blobWriteWorstMs, readJSON, safeErrorName, setJSON } from '../../../lib/store.js';
import { heldWithinBudget, refundSpend, reserveSpend, settleMonthCost } from '../../../lib/counters.js';
import { assertHashSalt, hashKey, HashSaltError } from '../../../lib/hash.js';
import { CHECK_TIMEOUT_ERROR, CheckTimeoutError, isCheckTimeout } from '../../../lib/checkError.js';
import { lookupSchedule } from '../../../lib/requestWindow.js';
import {
  dailyCap, estCostPerLookup, money, monthBudget, perIpDaily,
  LIMIT_UNAVAILABLE,
} from '../../../lib/limits.js';
import { track } from '@vercel/analytics/server';
import { EVENTS, errorTypeFromStatus, limitReason, trackEvent } from '../../../lib/analyticsEvents.js';

export const runtime = 'nodejs';
export const maxDuration = 90;

const CACHE_MS = 24 * 3600 * 1000;

function envMs(name, fallback, max) {
  const n = Number(process.env[name]);
  const ms = Number.isFinite(n) && n > 0 ? n : fallback;
  return Math.min(ms, max);
}

const bad = (msg, status = 400) => Response.json({ error: msg }, { status, headers: { 'cache-control': 'no-store' } });
const fail = (msg, status = 400) => {
  const reason = limitReason(status, msg);
  if (reason) void trackEvent(track, EVENTS.CHECK_LIMITED, { reason, engine: 'chatgpt' });
  else void trackEvent(track, EVENTS.CHECK_ERROR, { type: errorTypeFromStatus(status), engine: 'chatgpt' });
  return bad(msg, status);
};

function sameOrigin(req) {
  const origin = req.headers.get('origin');
  const hostHdr = req.headers.get('host');
  let oh = null;
  try { oh = new URL(origin).host; } catch { oh = null; }
  return Boolean(oh && oh === hostHdr);
}

export async function POST(req) {
  const started = Date.now();
  const schedule = lookupSchedule(started);
  const { hardStop, modelDeadline, reserveMs } = schedule;
  const timeLeft = () => hardStop - Date.now();

  try {
    assertHashSalt();
  } catch (e) {
    if (e instanceof HashSaltError) {
      console.error('HASH_SALT is required');
      return fail(LIMIT_UNAVAILABLE, 503);
    }
    throw e;
  }

  if (!sameOrigin(req)) return fail('Forbidden', 403);
  let body;
  try { body = await req.json(); } catch { return fail('Bad request'); }
  if (body.website) return fail('Forbidden', 403);
  if (!(Number(body.elapsed) >= 1500)) return fail('Please try again.', 400);

  const rejection = lookupRejection(body.market);
  if (rejection) return fail(rejection);
  const market = normalizeLookup(body.market);

  if ((process.env.OPENAI_API_KEY ?? '').length < 20) return fail(LIMIT_UNAVAILABLE, 503);

  const day = new Date().toISOString().slice(0, 10);
  const month = day.slice(0, 7);
  const shareId = hashKey(`lookup|${market}`);
  const cacheKey = `lookup/${shareId}`;
  // A missing or unreadable cache blob is a miss. Counter reads below still fail closed.
  const cached = await readJSON(cacheKey);
  if (cached.ok && cached.value && Date.now() - cached.value.at < CACHE_MS && cached.value.result) {
    return Response.json(
      { ...cached.value.result, id: shareId, cached: true },
      { headers: { 'cache-control': 'no-store' } },
    );
  }

  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown';
  const ipKey = `ip/${day}/${hashKey(ip)}`;
  const dayKey = `day/${day}`;
  const monthKey = `month/${month}`;
  const perIp = perIpDaily();
  const reserve = estCostPerLookup();
  const cap = dailyCap(day);
  const budget = monthBudget(month);
  const reservation = await reserveSpend({ ipKey, dayKey, monthKey, perIp, cap, budget, reserve });
  if (!reservation.ok) return fail(reservation.error, reservation.status);

  let cost = 0;
  let reserved = true;
  try {
    const held = await heldWithinBudget(monthKey, budget);
    if (!held.ok) {
      await refundSpend(ipKey, dayKey, monthKey, 0, reserve);
      reserved = false;
      return fail(held.error, held.status);
    }

    const callBudget = (max) => {
      const left = modelDeadline - Date.now() - reserveMs;
      if (left < 50) throw new CheckTimeoutError();
      return Math.min(max, left);
    };
    const answer = await askWithSearch(lookupUserPrompt(market), callBudget(envMs('SEARCH_TIMEOUT_MS', 40_000, 40_000)), { maxOutputTokens: 700 });
    cost += costOf(answer.usage, 'search', answer.searches || 1);
    const ex = await json(lookupExtractionPrompt(answer.text), LOOKUP_SCHEMA, callBudget(20_000), { maxOutputTokens: 400 });
    cost += costOf(ex.usage, 'util');
    const result = {
      market,
      brands: cleanBrandList(ex.data?.brands),
      excerpt: String(answer.text ?? '').slice(0, 600),
      checkedAt: new Date().toISOString(),
      engine: 'chatgpt',
    };
    if (timeLeft() > blobWriteWorstMs()) {
      try {
        await setJSON(cacheKey, { at: Date.now(), result });
      } catch (error) {
        console.error(`cache store failed name=${safeErrorName(error)}`);
      }
    }
    if (timeLeft() > blobReadWorstMs() + blobWriteWorstMs()) {
      try {
        await settleMonthCost(monthKey, reserve, cost);
      } catch (error) {
        console.error(`cost settle failed name=${safeErrorName(error)}`);
      }
    }
    console.log(`lookup ok cost=$${cost.toFixed(4)}`);
    return Response.json(
      { ...result, id: shareId, cached: false, ...(process.env.SHOW_COST === '1' ? { cost: money(cost) } : {}) },
      { headers: { 'cache-control': 'no-store' } },
    );
  } catch (e) {
    console.error('lookup failed', safeErrorName(e));
    if (reserved && timeLeft() > blobReadWorstMs() + blobWriteWorstMs()) {
      await refundSpend(ipKey, dayKey, monthKey, cost, reserve);
    }
    if (isCheckTimeout(e)) return fail(CHECK_TIMEOUT_ERROR, 504);
    return fail('The AI check failed. Please try again in a minute.', 502);
  }
}
