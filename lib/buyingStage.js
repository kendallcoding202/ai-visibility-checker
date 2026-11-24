// Buying-stage tags for a paid report. Classification is local: template match, then
// keyword rules. It does not call a model.
import { brandsMatch, templateStage } from './analyze.js';

export const BUYING_STAGES = ['learn', 'compare', 'buy'];

export const STAGE_LABEL = {
  learn: 'Learn',
  compare: 'Compare',
  buy: 'Buy',
};

export const AGENCY_MAX = 80;
export const AGENCY_ERROR = 'Agency name must be 80 characters or fewer, using letters, numbers, and simple punctuation.';

const AGENCY = /^[\p{L}\p{N} .,&'+\-/()!]+$/u;

const BUY_RULES = [
  /\bpricing\b/,
  /\bprices?\b/,
  /\bcosts?\b/,
  /\bbuy\b/,
  /\bpurchase\b/,
  /\bnear me\b/,
  /\bsign[\s-]?up\b/,
  /\bsubscribe\b/,
  /\bfree trial\b/,
];

const COMPARE_RULES = [
  /\bbest\b/,
  /\bvs\b\.?/,
  /\bversus\b/,
  /\balternatives?\b/,
  /\bcompare(?:d|s|son)?\b/,
  /\bcomparing\b/,
  /\bcompeting\b/,
  /\bcompetitors?\b/,
  /\bshortlist\b/,
  /\brate highest\b/,
  /\bhighest rated\b/,
  /\btop rated\b/,
  /\bwhich\b[^.]{0,120}\brecommend\b/,
];

const LEARN_RULES = [
  /\bwhat(?:'s| is| are| does)\b/,
  /\bhow (?:to|do|does|can|should)\b/,
  /\bguide\b/,
  /\bexplained\b/,
  /\bdefinition\b/,
  /\btutorial\b/,
];

export function isBuyingStage(value) {
  return BUYING_STAGES.includes(value);
}

function normalized(prompt) {
  return String(prompt ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function matchesAny(text, rules) {
  return rules.some((rule) => rule.test(text));
}

/**
 * Learn: what is / how to.
 * Compare: best X, X vs Y, alternatives.
 * Buy: pricing, buy, near me, sign up, and a brand named with that purchase language.
 * A known generator template wins, then buy, then compare, then learn.
 * Anything else is Learn.
 */
export function classifyBuyingStage(prompt, context = {}) {
  const fromTemplate = templateStage(prompt);
  if (isBuyingStage(fromTemplate)) return fromTemplate;
  const text = normalized(prompt);
  // Buy is pricing, buy, near me, sign up, and a brand together with that language
  // ("HubSpot pricing", "buy Notion", "plumbers near me"). The purchase words are
  // enough; the brand does not need a separate model call.
  void context;
  if (matchesAny(text, BUY_RULES)) return 'buy';
  if (matchesAny(text, COMPARE_RULES)) return 'compare';
  if (matchesAny(text, LEARN_RULES)) return 'learn';
  return 'learn';
}

/** Keep a validated enum stamped at generation time. Otherwise classify. */
export function coerceStage(stage, prompt, brand) {
  const tagged = String(stage ?? '').trim().toLowerCase();
  if (isBuyingStage(tagged)) return tagged;
  return classifyBuyingStage(prompt, { brand });
}

export function parseAgencyName(value) {
  if (value == null || value === '') return { ok: true, name: '' };
  if (typeof value !== 'string') return { ok: false, error: AGENCY_ERROR };
  if (value.length > AGENCY_MAX) return { ok: false, error: AGENCY_ERROR };
  if (/[\u0000-\u001f\u007f]/.test(value)) return { ok: false, error: AGENCY_ERROR };
  const name = value.replace(/\s+/g, ' ').trim();
  if (!name) return { ok: true, name: '' };
  if (name.length > AGENCY_MAX) return { ok: false, error: AGENCY_ERROR };
  if (!AGENCY.test(name)) return { ok: false, error: AGENCY_ERROR };
  return { ok: true, name };
}

function competitorCounts(rows, brand) {
  const counts = [];
  for (const row of rows) {
    const seen = [];
    for (const raw of row?.brands ?? []) {
      const name = String(raw ?? '').replace(/\s+/g, ' ').trim();
      if (name.length < 2 || name.length > 60) continue;
      if (brand && brandsMatch(brand, name)) continue;
      if (seen.some((item) => brandsMatch(item, name))) continue;
      seen.push(name);
      const existing = counts.find((item) => brandsMatch(item.name, name));
      if (existing) existing.n += 1;
      else counts.push({ name, n: 1 });
    }
  }
  counts.sort((a, b) => b.n - a.n || a.name.localeCompare(b.name));
  return counts.slice(0, 3);
}

export function stageSummaryLine(summary) {
  const prompts = summary.prompts;
  const promptWord = prompts === 1 ? 'prompt' : 'prompts';
  const competitors = summary.topCompetitors.length
    ? summary.topCompetitors.map((item) => `${item.name} (${item.n})`).join(', ')
    : 'none';
  return `${summary.label}: ${prompts} ${promptWord}, ${summary.mentioned} of ${prompts} mention the brand. Top competitors: ${competitors}`;
}

export function groupByStage(rows, { brand } = {}) {
  const groups = { learn: [], compare: [], buy: [] };
  for (const row of rows ?? []) {
    if (!row || typeof row !== 'object') continue;
    const prompt = String(row.prompt ?? '');
    const stage = coerceStage(row.stage, prompt, brand);
    groups[stage].push({ ...row, prompt, stage });
  }
  return groups;
}

export function stageSummaries(rows, { brand } = {}) {
  const groups = groupByStage(rows, { brand });
  return BUYING_STAGES.map((stage) => {
    const items = groups[stage];
    const summary = {
      stage,
      label: STAGE_LABEL[stage],
      prompts: items.length,
      mentioned: items.filter((row) => row.mentioned).length,
      topCompetitors: competitorCounts(items, brand),
    };
    summary.line = stageSummaryLine(summary);
    return summary;
  });
}
