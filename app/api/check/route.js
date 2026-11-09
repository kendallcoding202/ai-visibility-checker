import { askWithSearch, json, costOf } from '../../../lib/openai.js';
import { findBrandMention, brandsMatch, host, EXTRACTION_SCHEMA, extractionPrompt, buildPrompts } from '../../../lib/analyze.js';
import { getJSON, setJSON } from '../../../lib/store.js';
import { assertHashSalt, hashKey, HashSaltError } from '../../../lib/hash.js';

export const runtime = 'nodejs';
export const maxDuration = 60;

const PER_IP_DAILY = +(process.env.PER_IP_DAILY ?? 3);
const GLOBAL_DAILY = +(process.env.GLOBAL_DAILY ?? 25);
// Launch-day boost: on these UTC dates (the day/ counter key) the global cap is LAUNCH_DAILY instead.
// Product Hunt launch 12:01 AM PT Tue Nov 10, 2026 = 08:01 UTC Nov 10. Covers UTC Nov 10-12
// (= 5 PM MT Nov 9 through 5 PM MT Nov 12), then falls back to GLOBAL_DAILY automatically.
const LAUNCH_DAYS = (process.env.LAUNCH_DAYS ?? '2026-11-10,2026-11-11,2026-11-12').split(',').map((s) => s.trim()).filter(Boolean);
const LAUNCH_DAILY = +(process.env.LAUNCH_DAILY ?? 150);
const dailyCap = (day) => (LAUNCH_DAYS.includes(day) ? LAUNCH_DAILY : GLOBAL_DAILY);
const MONTHLY_BUDGET = +(process.env.MONTHLY_BUDGET_USD ?? 10);
// Launch month gets +$10 (~105 more checks at ~$0.093 each) so the 150/day launch cap isn't blocked by the budget.
const LAUNCH_MONTH = process.env.LAUNCH_MONTH ?? '2026-11';
const LAUNCH_BUDGET = +(process.env.LAUNCH_MONTHLY_BUDGET_USD ?? 20);
const monthBudget = (month) => (month === LAUNCH_MONTH ? Math.max(LAUNCH_BUDGET, MONTHLY_BUDGET) : MONTHLY_BUDGET);
const EST_COST = +(process.env.EST_COST_PER_CHECK ?? 0.12); // reserve per check before calling OpenAI
const CACHE_MS = 24 * 3600 * 1000;

const bad = (msg, status = 400) => Response.json({ error: msg }, { status });
const clean = (s, max) => String(s ?? '').replace(/[\u0000-\u001f<>{}\[\]`]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const VALID = /^[\p{L}\p{N} .,&'+\-/()!]+$/u;

export async function POST(req) {
  try {
    assertHashSalt();
  } catch (e) {
    if (e instanceof HashSaltError) {
      console.error('HASH_SALT is required');
      return bad('The checker is temporarily unavailable. Please try again later.', 503);
    }
    throw e;
  }

  // Basic bot protection: same-origin, JSON only, honeypot, minimum fill time.
  const origin = req.headers.get('origin');
  const hostHdr = req.headers.get('host');
  let oh = null; try { oh = new URL(origin).host; } catch {}
  if (!oh || oh !== hostHdr) return bad('Forbidden', 403);
  let body;
  try { body = await req.json(); } catch { return bad('Bad request'); }
  if (body.website) return bad('Forbidden', 403);
  if (!(Number(body.elapsed) >= 1500)) return bad('Please try again.', 400);

  const brand = clean(body.brand, 60);
  const category = clean(body.category, 80);
  const competitors = String(body.competitors ?? '').split(',').map((c) => clean(c, 60)).filter(Boolean).slice(0, 5);
  if (brand.length < 2 || category.length < 3) return bad('Enter a brand name and a category.');
  if (![brand, category, ...competitors].every((s) => VALID.test(s))) return bad('Please use plain letters and numbers only.');

  if ((process.env.OPENAI_API_KEY ?? '').length < 20) return bad('The checker is warming up. Please try again later.', 503);
  const day = new Date().toISOString().slice(0, 10);
  const month = day.slice(0, 7);
  const shareId = hashKey(`${brand}|${category}|${competitors.join(',')}`.toLowerCase());
  const cacheKey = `cache/${shareId}`;
  const cached = await getJSON(cacheKey);
  if (cached && Date.now() - cached.at < CACHE_MS) return Response.json({ ...cached.result, id: shareId, cached: true });

  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown';
  const ipKey = `ip/${day}/${hashKey(ip)}`;
  const [ipCount, dayStats, monthStats] = await Promise.all([getJSON(ipKey), getJSON(`day/${day}`), getJSON(`month/${month}`)]);
  const tomorrow = 'Free checks are used up for today. Please come back tomorrow!';
  if ((ipCount?.n ?? 0) >= PER_IP_DAILY) return bad(`You've used your ${PER_IP_DAILY} free checks for today. Come back tomorrow!`, 429);
  if ((dayStats?.n ?? 0) >= dailyCap(day)) return bad(tomorrow, 429);
  if ((monthStats?.cost ?? 0) + EST_COST > monthBudget(month)) return bad('The free checker has hit its monthly limit. Please come back next month, or use the full tracker below.', 429);

  // Reserve the slot before spending money.
  await Promise.all([
    setJSON(ipKey, { n: (ipCount?.n ?? 0) + 1 }),
    setJSON(`day/${day}`, { n: (dayStats?.n ?? 0) + 1 }),
    setJSON(`month/${month}`, { cost: (monthStats?.cost ?? 0) + EST_COST, n: (monthStats?.n ?? 0) + 1 }),
  ]);

  let cost = 0;
  try {
    const prompts = buildPrompts(category);
    const answers = await Promise.all(prompts.map((p) => askWithSearch(p)));
    answers.forEach((a) => { cost += costOf(a.usage, 'search', a.searches || 1); });
    const ex = await json(extractionPrompt(brand, answers.map((a, i) => ({ prompt: prompts[i], text: a.text }))), EXTRACTION_SCHEMA);
    cost += costOf(ex.usage, 'util');

    const brandLc = brand.toLowerCase();
    const rows = answers.map((a, i) => {
      const brands = (ex.data.answers[i]?.brands ?? []).map((b) => String(b).trim()).filter(Boolean).filter((b, j, arr) => arr.findIndex((x) => x.toLowerCase() === b.toLowerCase()) === j);
      const idx = brands.findIndex((b) => brandsMatch(brand, b));
      const mentioned = idx >= 0 || findBrandMention(a.text, brand) >= 0;
      return {
        prompt: prompts[i], mentioned, rank: idx >= 0 ? idx + 1 : (mentioned ? brands.length + 1 : null),
        brands: brands.slice(0, 10), sentiment: ex.data.answers[i]?.sentiment ?? 'not_mentioned',
        excerpt: a.text.slice(0, 600),
        cited: a.citations.some((c) => (host(c.url) ?? '').includes(brandLc.replace(/\s+/g, ''))),
      };
    });
    const mentionedIn = rows.filter((r) => r.mentioned).length;
    const ranks = rows.map((r) => r.rank).filter(Boolean);
    const others = {};
    rows.forEach((r) => r.brands.forEach((b) => {
      if (brandsMatch(brand, b)) return;
      if (competitors.some((c) => brandsMatch(c, b))) return;
      others[b] = (others[b] ?? 0) + 1;
    }));
    const competitorHits = competitors.map((c) => ({
      name: c,
      mentionedIn: rows.filter((r, i) => findBrandMention(answers[i].text, c) >= 0 || r.brands.some((b) => brandsMatch(c, b))).length,
    }));
    const srcCount = {};
    answers.forEach((a) => new Set(a.citations.map((c) => host(c.url)).filter(Boolean)).forEach((h) => { srcCount[h] = (srcCount[h] ?? 0) + 1; }));
    const result = {
      brand, category, mentionedIn, total: rows.length,
      score: Math.round((mentionedIn / rows.length) * 100 * (ranks.length ? Math.max(0.4, 1 - (ranks.reduce((s, x) => s + x, 0) / ranks.length - 1) * 0.08) : 1)),
      avgRank: ranks.length ? +(ranks.reduce((s, x) => s + x, 0) / ranks.length).toFixed(1) : null,
      rows, competitorHits,
      topBrands: Object.entries(others).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, n]) => ({ name, n })),
      topSources: Object.entries(srcCount).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([domain, n]) => ({ domain, n })),
      checkedAt: new Date().toISOString(),
    };
    await setJSON(cacheKey, { at: Date.now(), result });
    // Replace the reservation with the measured cost.
    const m = await getJSON(`month/${month}`);
    await setJSON(`month/${month}`, { ...m, cost: Math.max(0, (m?.cost ?? 0) - EST_COST + cost) });
    console.log(`check ok cost=$${cost.toFixed(4)}`);
    return Response.json({ ...result, id: shareId, cached: false, ...(process.env.SHOW_COST === '1' ? { cost } : {}) });
  } catch (e) {
    console.error('check failed', e.message);
    // Refund the reserved slot so failures don't burn quota.
    const [i2, d2, m2] = await Promise.all([getJSON(ipKey), getJSON(`day/${day}`), getJSON(`month/${month}`)]);
    await Promise.all([
      setJSON(ipKey, { n: Math.max(0, (i2?.n ?? 1) - 1) }),
      setJSON(`day/${day}`, { n: Math.max(0, (d2?.n ?? 1) - 1) }),
      setJSON(`month/${month}`, { ...m2, cost: Math.max(0, (m2?.cost ?? 0) - EST_COST + cost), n: Math.max(0, (m2?.n ?? 1) - 1) }),
    ]).catch(() => {});
    return bad('The AI check failed. Please try again in a minute.', 502);
  }
}
