import { askWithSearch, json, costOf } from '../../../lib/openai.js';
import { LOOKUP_SCHEMA, lookupExtractionPrompt, cleanBrandList } from '../../../lib/analyze.js';
import { lookupRejection, lookupUserPrompt, normalizeLookup } from '../../../lib/lookupInput.js';
import { blobReadWorstMs, blobWriteWorstMs, readJSON, safeErrorName, setJSON } from '../../../lib/store.js';
import { assertHashSalt, hashKey, HashSaltError } from '../../../lib/hash.js';
import { CHECK_TIMEOUT_ERROR, CheckTimeoutError, isCheckTimeout } from '../../../lib/checkError.js';
import { lookupSchedule } from '../../../lib/requestWindow.js';
import {
  dailyCap, estCostPerLookup, money, monthBudget, perIpDaily, spendDecision,
  LIMIT_MONTH, LIMIT_UNAVAILABLE,
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
  const perIp = perIpDaily();
  const reserve = estCostPerLookup();
  const cap = dailyCap(day);
  const budget = monthBudget(month);
  const [ipRead, dayRead, monthRead] = await Promise.all([
    readJSON(ipKey), readJSON(`day/${day}`), readJSON(`month/${month}`),
  ]);
  if (!ipRead.ok || !dayRead.ok || !monthRead.ok) return fail(LIMIT_UNAVAILABLE, 503);
  const decision = spendDecision({
    ipCount: ipRead.value?.n ?? 0,
    dayCount: dayRead.value?.n ?? 0,
    monthCost: monthRead.value?.cost ?? 0,
    perIp,
    cap,
    budget,
    reserve,
  });
  if (!decision.ok) return fail(decision.error, decision.status);

  let cost = 0;
  let reserved = false;
  try {
    reserved = true;
    const spent = money(monthRead.value?.cost ?? 0);
    await Promise.all([
      setJSON(ipKey, { n: (ipRead.value?.n ?? 0) + 1 }),
      setJSON(`day/${day}`, { n: (dayRead.value?.n ?? 0) + 1 }),
      setJSON(`month/${month}`, { cost: money(spent + reserve), n: (monthRead.value?.n ?? 0) + 1 }),
    ]);
    const held = await readJSON(`month/${month}`);
    if (!held.ok || !Number.isFinite(money(held.value?.cost)) || money(held.value.cost) > money(budget)) {
      await refundLookup(ipKey, day, month, 0, reserve);
      reserved = false;
      if (!held.ok || !Number.isFinite(money(held.value?.cost))) return fail(LIMIT_UNAVAILABLE, 503);
      return fail(LIMIT_MONTH, 429);
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
        await settleLookup(month, reserve, cost);
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
      await refundLookup(ipKey, day, month, cost, reserve);
    }
    if (isCheckTimeout(e)) return fail(CHECK_TIMEOUT_ERROR, 504);
    return fail('The AI check failed. Please try again in a minute.', 502);
  }
}

async function settleLookup(month, reserve, cost) {
  const m = await readJSON(`month/${month}`);
  if (!m.ok) return;
  const prev = m.value ?? {};
  await setJSON(`month/${month}`, { ...prev, cost: money(Math.max(0, (prev.cost ?? 0) - reserve + cost)) });
}

async function refundLookup(ipKey, day, month, cost, reserve) {
  try {
    const [ip, dayStats, monthStats] = await Promise.all([
      readJSON(ipKey), readJSON(`day/${day}`), readJSON(`month/${month}`),
    ]);
    if (!ip.ok || !dayStats.ok || !monthStats.ok) return;
    const prev = monthStats.value ?? {};
    await Promise.all([
      setJSON(ipKey, { n: Math.max(0, (ip.value?.n ?? 1) - 1) }),
      setJSON(`day/${day}`, { n: Math.max(0, (dayStats.value?.n ?? 1) - 1) }),
      setJSON(`month/${month}`, {
        ...prev,
        cost: money(Math.max(0, (prev.cost ?? 0) - reserve + cost)),
        n: Math.max(0, (prev.n ?? 1) - 1),
      }),
    ]);
  } catch {
    // Leave the reservation in place. That blocks further spend instead of forgetting it.
  }
}
