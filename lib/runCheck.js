// One ChatGPT web-search check: 3 questions, extraction, score, measured cost.
// Callers own spend limits. This module does not read or write the free-checker counters.
import { askWithSearch, json, costOf } from './openai.js';
import { findBrandMention, brandsMatch, host, EXTRACTION_SCHEMA, extractionPrompt, buildPrompts } from './analyze.js';
import { packCitations } from './fixList.js';
import { CheckTimeoutError } from './checkError.js';

const MIN_CALL_MS = 50;

async function allSettledThrow(promises) {
  const results = await Promise.all(promises.map((p) => p.then(
    (value) => ({ ok: true, value }),
    (error) => ({ ok: false, error }),
  )));
  const failed = results.find((r) => !r.ok);
  if (failed) throw failed.error;
  return results.map((r) => r.value);
}

export async function runVisibilityCheck({
  brand,
  category,
  competitors = [],
  deadline,
  searchTimeoutMs = 40_000,
  refundReserveMs = 12_000,
}) {
  let cost = 0;
  try {
    const callBudget = (cap) => {
      const left = deadline - Date.now() - refundReserveMs;
      if (left < MIN_CALL_MS) throw new CheckTimeoutError();
      return cap == null ? left : Math.min(cap, left);
    };
    const prompts = buildPrompts(category, brand);
    const searchMs = callBudget(searchTimeoutMs);
    const answers = await allSettledThrow(prompts.map((p) => askWithSearch(p, searchMs)));
    answers.forEach((a) => { cost += costOf(a.usage, 'search', a.searches || 1); });
    const ex = await json(
      extractionPrompt(brand, answers.map((a, i) => ({ prompt: prompts[i], text: a.text }))),
      EXTRACTION_SCHEMA,
      callBudget(),
    );
    cost += costOf(ex.usage, 'util');

    const brandLc = brand.toLowerCase();
    const rows = answers.map((a, i) => {
      const brands = (ex.data.answers[i]?.brands ?? []).map((b) => String(b).trim()).filter(Boolean).filter((b, j, arr) => arr.findIndex((x) => x.toLowerCase() === b.toLowerCase()) === j);
      const idx = brands.findIndex((b) => brandsMatch(brand, b));
      const mentioned = idx >= 0 || findBrandMention(a.text, brand) >= 0;
      return {
        prompt: prompts[i], mentioned, rank: idx >= 0 ? idx + 1 : (mentioned ? brands.length + 1 : null),
        brands: brands.slice(0, 10), sentiment: ex.data.answers[i]?.sentiment ?? 'not_mentioned',
        citations: packCitations(a.citations),
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
      brand, category, runs: 1, mentionedIn, total: rows.length,
      score: Math.round((mentionedIn / rows.length) * 100 * (ranks.length ? Math.max(0.4, 1 - (ranks.reduce((s, x) => s + x, 0) / ranks.length - 1) * 0.08) : 1)),
      avgRank: ranks.length ? +(ranks.reduce((s, x) => s + x, 0) / ranks.length).toFixed(1) : null,
      rows, competitorHits,
      topBrands: Object.entries(others).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, n]) => ({ name, n })),
      topSources: Object.entries(srcCount).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([domain, n]) => ({ domain, n })),
      checkedAt: new Date().toISOString(),
    };
    return {
      result,
      rawAnswers: answers.map((a, i) => ({ prompt: prompts[i], text: a.text })),
      cost,
    };
  } catch (error) {
    if (error && typeof error === 'object') error.trackingCost = cost;
    throw error;
  }
}
