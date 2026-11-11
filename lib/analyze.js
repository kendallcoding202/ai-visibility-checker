// Mention matching, adapted from the AI Search Visibility Tracker actor (entities.js).
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export function findMention(text, name) {
  const re = new RegExp(`(?<![\\p{L}\\p{N}_])${esc(name)}(?![\\p{L}\\p{N}_])`, 'iu');
  const m = re.exec(text);
  return m ? m.index : -1;
}
export const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return null; } };

// TLDs we strip when a competitor is entered as a domain-style name (Monday.com).
const TLDS = new Set(['com', 'io', 'ai', 'app', 'co', 'dev', 'so', 'net', 'org', 'us', 'uk', 'info', 'biz', 'xyz']);
// Trailing/leading descriptors that AI answers often append to a brand.
const SUFFIX_WORDS = new Set([
  'inc', 'llc', 'ltd', 'corp', 'corporation', 'company', 'co', 'hq', 'the',
  'ai', 'software', 'platform', 'platforms', 'suite', 'app', 'apps', 'tool', 'tools',
  'crm', 'work', 'workspace', 'workspaces', 'labs', 'lab', 'technologies', 'technology',
  'tech', 'systems', 'system', 'solutions', 'solution', 'group', 'media', 'digital',
  'online', 'official', 'products', 'product', 'services', 'service',
]);

/** Lowercase, strip accents/punctuation/TLDs/corporate suffixes → core brand phrase. */
export function normalizeBrand(name) {
  let s = String(name ?? '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  s = s.replace(/['’]/g, '');
  // monday.com / www.monday.com → monday; foo.io → foo
  const domainish = s.trim().match(/^(?:www\.)?([a-z0-9-]+(?:\.[a-z0-9-]+)*)\.([a-z]{2,})$/i);
  if (domainish && TLDS.has(domainish[2].toLowerCase())) {
    s = domainish[1].replace(/\./g, ' ');
  }
  s = s.replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const tokens = s.split(/\s+/).filter(Boolean);
  while (tokens.length > 1 && SUFFIX_WORDS.has(tokens[tokens.length - 1])) tokens.pop();
  while (tokens.length > 1 && SUFFIX_WORDS.has(tokens[0])) tokens.shift();
  return tokens.join(' ');
}

export function brandCore(name) {
  return (normalizeBrand(name).split(/\s+/)[0]) || '';
}

/**
 * Soft brand equality for user brand + competitors vs extracted names.
 * "Monday.com" ≈ "monday AI Work Platform"; "Notion" does NOT match "Notional".
 */
export function brandsMatch(a, b) {
  if (!a || !b) return false;
  const na = normalizeBrand(a);
  const nb = normalizeBrand(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  // "Click Up" ≈ "ClickUp"
  const ca = na.replace(/\s+/g, '');
  const cb = nb.replace(/\s+/g, '');
  if (ca === cb) return true;

  const ta = na.split(/\s+/)[0];
  const tb = nb.split(/\s+/)[0];
  // Same first significant token (min 3 chars so "AI"/"Go" don't fuzzy-match everything).
  if (ta.length >= 3 && ta === tb) return true;

  // Safe prefix at a token boundary only: "hubspot" ≈ "hubspot crm", not "notion" ≈ "notional".
  const [shorter, longer] = na.length <= nb.length ? [na, nb] : [nb, na];
  if (shorter.length >= 4 && (longer === shorter || longer.startsWith(`${shorter} `))) return true;
  return false;
}

/** Word-boundary search using the raw name plus its normalized core (so Monday.com finds "Monday"). */
export function findBrandMention(text, name) {
  if (!text || !name) return -1;
  const terms = new Set();
  const raw = String(name).trim();
  if (raw.length >= 2) terms.add(raw);
  const norm = normalizeBrand(raw);
  if (norm.length >= 2) terms.add(norm);
  const core = brandCore(raw);
  if (core.length >= 2) terms.add(core);
  // Also try compact form for spaced brands.
  const compact = norm.replace(/\s+/g, '');
  if (compact.length >= 2 && compact !== norm) terms.add(compact);
  let best = -1;
  for (const t of terms) {
    const i = findMention(text, t);
    if (i >= 0 && (best < 0 || i < best)) best = i;
  }
  return best;
}

export const EXTRACTION_SCHEMA = {
  title: 'brand_extraction', type: 'object', additionalProperties: false, required: ['answers'],
  properties: { answers: { type: 'array', items: {
    type: 'object', additionalProperties: false, required: ['brands', 'sentiment'],
    properties: {
      brands: { type: 'array', items: { type: 'string' } },
      sentiment: { type: 'string', enum: ['positive', 'neutral', 'negative', 'mixed', 'not_mentioned'] },
    },
  } } },
};

export function extractionPrompt(brand, qa) {
  return [
    'You analyze answers written by AI assistants. For EACH numbered answer below, in order, return:',
    '- brands: distinct brand, company or product names the answer recommends or discusses, in the order they first appear. Use the shortest common name (e.g. "HubSpot", not "HubSpot CRM Suite"). Max 20. Exclude generic terms and websites only cited as sources.',
    `- sentiment: the answer's overall sentiment toward "${brand}" (positive, neutral, negative, mixed), or not_mentioned.`,
    '',
    ...qa.map((x, i) => `### ANSWER ${i + 1}\nQUESTION: ${x.prompt}\n${x.text.slice(0, 8000)}\n`),
  ].join('\n');
}

export const LOOKUP_SCHEMA = {
  title: 'market_brands', type: 'object', additionalProperties: false, required: ['brands'],
  properties: { brands: { type: 'array', items: { type: 'string' } } },
};

/** Brand names from one market answer. The user market is not included. */
export function lookupExtractionPrompt(answerText) {
  return [
    'You extract brand, company, and local-business names from one AI answer.',
    'Return brands in the order they are recommended. Use the shortest common name. Max 12.',
    'Exclude generic categories, cities used only as locations, and websites that are only sources.',
    '',
    String(answerText ?? '').slice(0, 8000),
  ].join('\n');
}

export function cleanBrandList(list) {
  const out = [];
  for (const raw of list ?? []) {
    const name = String(raw ?? '').replace(/[\u0000-\u001f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
    if (name.length < 2) continue;
    if (!/[\p{L}\p{N}]/u.test(name)) continue;
    if (out.some((b) => b.toLowerCase() === name.toLowerCase())) continue;
    out.push(name);
    if (out.length >= 8) break;
  }
  return out.map((name, i) => ({ name, rank: i + 1 }));
}

export function buildPrompts(category) {
  return [
    `What are the best ${category} tools right now? Give me a ranked shortlist.`,
    `I'm choosing ${category} software for a small business. Which options would you recommend and why?`,
    `Which ${category} platforms do experts rate highest in 2026?`,
  ];
}
