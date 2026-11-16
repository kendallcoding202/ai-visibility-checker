import { blobReadWorstMs, blobWriteWorstMs, readJSON, safeErrorName, setJSON } from '../../../lib/store.js';
import { heldWithinBudget, refundLocalAudit, refundSpend, reserveLocalAudit, reserveSpend, settleMonthCost } from '../../../lib/counters.js';
import { assertHashSalt, hashKey, HashSaltError } from '../../../lib/hash.js';
import { CHECK_TIMEOUT_ERROR, isCheckTimeout } from '../../../lib/checkError.js';
import { dailyCap, monthBudget, perIpDaily } from '../../../lib/limits.js';
import { track } from '@vercel/analytics/server';
import { EVENTS, errorTypeFromStatus, limitReason, trackEvent } from '../../../lib/analyticsEvents.js';
import { sameOrigin } from '../../../lib/sameOrigin.js';
import { checkSchedule } from '../../../lib/requestWindow.js';
import { askWithSearch, json, costOf } from '../../../lib/openai.js';
import { findBrandMention, brandsMatch, host, EXTRACTION_SCHEMA, buildLocalPrompts, localExtractionPrompt } from '../../../lib/analyze.js';
import { packCitations } from '../../../lib/fixList.js';
import { parseLocalInput, normalizeWebsite } from '../../../lib/localCheck.js';
import { estCostPerLocalCheck, localAuditGlobalDaily, localAuditPerIpDaily, localServiceBusinessEnabled } from '../../../lib/localLimits.js';
import { audit } from '../../../lib/websiteAudit.js';
import { buildLocalFixList, generateFAQQuestions, generateLlmsTxt, generateLocalBusinessSchema, generateRobotsTxt } from '../../../lib/localFixes.js';

export const runtime = 'nodejs';
export const maxDuration = 120;

const CACHE_MS = 24 * 3600 * 1000;

function envMs(name, fallback, max) {
  const n = Number(process.env[name]);
  const ms = Number.isFinite(n) && n > 0 ? n : fallback;
  return Math.min(ms, max);
}
const searchTimeoutMs = () => envMs('SEARCH_TIMEOUT_MS', 40_000, 40_000);

const bad = (msg, status = 400) => Response.json({ error: msg }, { status });
const fail = (msg, status = 400) => {
  const reason = limitReason(status, msg);
  if (reason) void trackEvent(track, EVENTS.CHECK_LIMITED, { reason, engine: 'chatgpt' });
  else void trackEvent(track, EVENTS.CHECK_ERROR, { type: errorTypeFromStatus(status), engine: 'chatgpt' });
  return bad(msg, status);
};

export async function POST(req) {
  if (!localServiceBusinessEnabled()) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

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

  if (!sameOrigin(req)) return fail('Forbidden', 403);
  let body;
  try { body = await req.json(); } catch { return fail('Bad request'); }
  if (body.honeypot) return fail('Forbidden', 403);
  if (!(Number(body.elapsed) >= 1500)) return fail('Please try again.', 400);

  const parsed = parseLocalInput(body);
  if (parsed.error) return fail(parsed.error);
  const { businessName, service, city, state, website } = parsed;

  if ((process.env.OPENAI_API_KEY ?? '').length < 20) return fail('The checker is warming up. Please try again later.', 503);
  const day = new Date().toISOString().slice(0, 10);
  const month = day.slice(0, 7);
  const websiteNorm = normalizeWebsite(website);
  const shareId = hashKey(`local|${businessName}|${service}|${city}|${state}|${websiteNorm}`.toLowerCase());
  const cacheKey = `local-cache/${shareId}`;
  
  const cached = await readJSON(cacheKey);
  if (cached.ok && cached.value && Date.now() - cached.value.at < CACHE_MS && cached.value.result) {
    return Response.json({ ...cached.value.result, id: shareId, cached: true });
  }

  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown';
  const ipKey = `ip/${day}/${hashKey(ip)}`;
  const dayKey = `day/${day}`;
  const monthKey = `month/${month}`;
  const perIp = perIpDaily();
  const reserve = estCostPerLocalCheck();
  const cap = dailyCap(day);
  const budget = monthBudget(month);
  
  const reservation = await reserveSpend({ ipKey, dayKey, monthKey, perIp, cap, budget, reserve });
  if (!reservation.ok) return fail(reservation.error, reservation.status);

  const auditIpKey = `local-audit-ip/${day}/${hashKey(ip)}`;
  const auditDayKey = `local-audit-day/${day}`;
  const auditPerIp = localAuditPerIpDaily();
  const auditCap = localAuditGlobalDaily();
  
  let auditReserved = false;
  if (website) {
    const auditRes = await reserveLocalAudit(auditIpKey, auditDayKey, auditPerIp, auditCap);
    if (!auditRes.ok) {
      try {
        await refundSpend(ipKey, dayKey, monthKey, 0, reserve);
        reserved = false;
      } catch (err) {
        console.error(`spend refund after audit fail failed name=${err?.name}`);
      }
      return fail(auditRes.error, auditRes.status);
    }
    auditReserved = true;
  }

  let cost = 0;
  let reserved = true;
  let success = false;
  try {
    const held = await heldWithinBudget(monthKey, budget);
    if (!held.ok) {
      return fail(held.error, held.status);
    }

    const callBudget = (cap) => {
      const left = modelDeadline - Date.now() - reserveMs;
      if (left < 50) throw new Error('Check timeout');
      return cap == null ? left : Math.min(cap, left);
    };

    const prompts = buildLocalPrompts(service, city, state, businessName);
    const searchMs = callBudget(searchTimeoutMs());
    const answers = await Promise.all(prompts.map((p) => askWithSearch(p, searchMs, { location: { city, region: state } })));
    answers.forEach((a) => { cost += costOf(a.usage, 'search', a.searches || 1); });

    const ex = await json(
      localExtractionPrompt(businessName, answers.map((a, i) => ({ prompt: prompts[i], text: a.text }))),
      EXTRACTION_SCHEMA,
      callBudget(),
    );
    cost += costOf(ex.usage, 'util');

    const businessLc = businessName.toLowerCase();
    const rows = answers.map((a, i) => {
      const brands = (ex.data.answers[i]?.brands ?? []).map((b) => String(b).trim()).filter(Boolean).filter((b, j, arr) => arr.findIndex((x) => x.toLowerCase() === b.toLowerCase()) === j);
      const idx = brands.findIndex((b) => brandsMatch(businessName, b));
      const mentioned = idx >= 0 || findBrandMention(a.text, businessName) >= 0;
      return {
        prompt: prompts[i], mentioned, rank: idx >= 0 ? idx + 1 : (mentioned ? brands.length + 1 : null),
        brands: brands.slice(0, 10), sentiment: ex.data.answers[i]?.sentiment ?? 'not_mentioned',
        citations: packCitations(a.citations),
        cited: a.citations.some((c) => (host(c.url) ?? '').includes(businessLc.replace(/\s+/g, ''))),
      };
    });

    const mentionedIn = rows.filter((r) => r.mentioned).length;
    const ranks = rows.map((r) => r.rank).filter(Boolean);
    const others = {};
    rows.forEach((r) => r.brands.forEach((b) => {
      if (brandsMatch(businessName, b)) return;
      others[b] = (others[b] ?? 0) + 1;
    }));

    const srcCount = {};
    answers.forEach((a) => new Set(a.citations.map((c) => host(c.url)).filter(Boolean)).forEach((h) => { srcCount[h] = (srcCount[h] ?? 0) + 1; }));
    
    const result = {
      businessName, service, city, state, website: website || null,
      runs: 1, mentionedIn, total: rows.length,
      score: Math.round((mentionedIn / rows.length) * 100 * (ranks.length ? Math.max(0.4, 1 - (ranks.reduce((s, x) => s + x, 0) / ranks.length - 1) * 0.08) : 1)),
      avgRank: ranks.length ? +(ranks.reduce((s, x) => s + x, 0) / ranks.length).toFixed(1) : null,
      rows,
      topBrands: Object.entries(others).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, n]) => ({ name, n })),
      topSources: Object.entries(srcCount).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([domain, n]) => ({ domain, n })),
      checkedAt: new Date().toISOString(),
    };

    let auditResult = null;
    if (website && timeLeft() > 15_000) {
      try {
        auditResult = await audit(website, businessName, service, city);
      } catch (err) {
        console.error(`audit failed name=${safeErrorName(err)}`);
        auditResult = { accessible: false, message: 'Audit failed' };
      }
    } else if (website) {
      auditResult = { skipped: true, reason: 'Insufficient time remaining' };
    }

    const fixKit = {
      schema: generateLocalBusinessSchema(businessName, service, city, state),
      faqQuestions: generateFAQQuestions(businessName, service, city, state),
      llmsTxt: generateLlmsTxt(businessName, service, city, state),
      robotsTxt: generateRobotsTxt(),
    };

    const fixList = buildLocalFixList(result, auditResult);

    if (timeLeft() > blobWriteWorstMs()) {
      try {
        await setJSON(cacheKey, { at: Date.now(), result: { ...result, audit: auditResult, fixKit, fixList } });
      } catch (error) {
        console.error(`cache store failed name=${safeErrorName(error)}`);
      }
    }

    success = true;
    if (timeLeft() > blobReadWorstMs() + blobWriteWorstMs()) {
      try {
        const settled = await settleMonthCost(monthKey, reserve, cost);
        if (!settled) {
          console.error('cost settle failed');
        }
      } catch (error) {
        console.error(`cost settle failed name=${safeErrorName(error)}`);
      }
    } else {
      console.error('cost settle skipped');
    }
    console.log(`local check ok cost=$${cost.toFixed(4)}`);
    const payload = { ...result, audit: auditResult, fixKit, fixList, id: shareId, cached: false };
    return Response.json(payload);
  } catch (e) {
    console.error('local check failed', safeErrorName(e));
    if (Number.isFinite(e?.trackingCost)) cost = e.trackingCost;
    if (isCheckTimeout(e)) return fail(CHECK_TIMEOUT_ERROR, 504);
    return fail('The AI check failed. Please try again in a minute.', 502);
  } finally {
    if (!success && reserved) {
      try {
        await refundSpend(ipKey, dayKey, monthKey, cost, reserve);
      } catch (err) {
        console.error(`refund failed ipKey dayKey monthKey name=${err?.name}`);
      }
    }
    if (!success && auditReserved) {
      await refundLocalAudit(auditIpKey, auditDayKey);
    }
  }
}

export async function GET() {
  if (!localServiceBusinessEnabled()) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }
  return Response.json({ error: 'Method not allowed' }, { status: 405 });
}
