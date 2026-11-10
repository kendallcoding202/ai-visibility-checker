// Helpers for Vercel Web Analytics custom events.
// Never pass raw brand names, emails, IPs, share IDs, or free-text inputs as properties.

export const EVENTS = {
  VISIT_SOURCE: 'visit_source',
  CHECK_SUBMITTED: 'check_submitted',
  RESULT_VIEWED: 'result_viewed',
  CHECK_LIMITED: 'check_limited',
  CHECK_ERROR: 'check_error',
  TRACKER_CTA_CLICK: 'tracker_cta_click',
  CITATION_CTA_CLICK: 'citation_cta_click',
  SHARE_CLICK: 'share_click',
};

export const MAX_PROPS = 8;

const PROP_KEYS = new Set([
  'named',
  'engine',
  'cached',
  'source',
  'has_competitors',
  'category_bucket',
  'reason',
  'type',
  'location',
  'channel',
  'utm_source',
  'referrer_host',
]);

const ENGINES = new Set(['chatgpt', 'gemini', 'perplexity', 'unknown']);
const SOURCES = new Set(['home', 'share', 'article', 'other']);
const REASONS = new Set(['ip_daily', 'global_daily', 'monthly_budget']);
const ERROR_TYPES = new Set([
  'network', 'forbidden', 'validation', 'unavailable', 'failed', 'honeypot', 'origin', 'unknown',
]);
const LOCATIONS = new Set([
  'result-cta', 'result-top', 'result-sources', 'gemini-locked', 'footer', 'explainer',
  'article-citations', 'cta', 'other',
]);
const CHANNELS = new Set(['copy', 'x', 'linkedin']);
const CATEGORY_BUCKETS = new Set([
  'productivity', 'sales', 'ecommerce', 'marketing', 'design', 'software', 'finance',
  'health', 'education', 'real_estate', 'legal', 'travel', 'food', 'agency', 'other',
]);

const CATEGORY_RULES = [
  [/project|task manag|productivity|work ?os|pkm|notes?\b/, 'productivity'],
  [/\bcrm\b|sales force|sales software/, 'sales'],
  [/e-?commerc|online store|shopif|\bretail\b/, 'ecommerce'],
  [/\bseo\b|marketing|advertis|\bads?\b/, 'marketing'],
  [/\bui\/?ux\b|\bdesign\b|figma/, 'design'],
  [/software|saas|developer|devtools|\bapi\b|\bcloud\b/, 'software'],
  [/financ|banking|account(ing)?|insur/, 'finance'],
  [/health|fitness|medical|clinic/, 'health'],
  [/educat|e-?learn|course|school/, 'education'],
  [/real ?estate|\bpropert/, 'real_estate'],
  [/legal|lawyer|attorney|law firm/, 'legal'],
  [/travel|hotel|flight|airbnb/, 'travel'],
  [/restaurant|grocery|\bfood\b/, 'food'],
  [/agenc(y|ies)|consult(ing)?/, 'agency'],
];

const TOKEN = /^[a-z0-9][a-z0-9._-]{0,39}$/;
const HOST = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;

export function categoryBucket(category) {
  const text = String(category ?? '').toLowerCase();
  if (!text) return 'other';
  for (const [re, bucket] of CATEGORY_RULES) {
    if (re.test(text)) return bucket;
  }
  return 'other';
}

function sanitizeUtm(value) {
  const s = String(value ?? '').trim().toLowerCase().slice(0, 40);
  if (!s) return 'none';
  return TOKEN.test(s) ? s : 'other';
}

export function referrerHost(referrer) {
  const raw = String(referrer ?? '').trim();
  if (!raw) return 'direct';
  try {
    const host = new URL(raw).hostname.toLowerCase();
    if (!host || host === 'localhost') return 'direct';
    return HOST.test(host) ? host.slice(0, 80) : 'other';
  } catch {
    return 'other';
  }
}

function sanitize(key, value) {
  if (value == null) return null;
  switch (key) {
    case 'named':
    case 'cached':
    case 'has_competitors':
      return Boolean(value);
    case 'engine':
      return ENGINES.has(value) ? value : 'unknown';
    case 'source':
      return SOURCES.has(value) ? value : 'other';
    case 'category_bucket':
      return CATEGORY_BUCKETS.has(value) ? value : 'other';
    case 'reason':
      return REASONS.has(value) ? value : null;
    case 'type':
      return ERROR_TYPES.has(value) ? value : 'unknown';
    case 'location':
      return LOCATIONS.has(value) ? value : 'other';
    case 'channel':
      return CHANNELS.has(value) ? value : null;
    case 'utm_source':
      return sanitizeUtm(value);
    case 'referrer_host':
      return typeof value === 'string' && (value === 'direct' || value === 'other' || HOST.test(value))
        ? value.slice(0, 80)
        : 'other';
    default:
      return null;
  }
}

/** Build at most MAX_PROPS allowlisted properties. Drops unknown keys and unsanitized values. */
export function eventProps(input) {
  const out = {};
  if (!input || typeof input !== 'object') return out;
  for (const key of Object.keys(input)) {
    if (!PROP_KEYS.has(key)) continue;
    if (Object.keys(out).length >= MAX_PROPS) break;
    const value = sanitize(key, input[key]);
    if (value == null) continue;
    out[key] = value;
  }
  return out;
}

export function errorTypeFromStatus(status) {
  if (status === 429) return null;
  if (status === 403) return 'forbidden';
  if (status === 400) return 'validation';
  if (status === 503) return 'unavailable';
  if (status === 502 || status === 504) return 'failed';
  return 'unknown';
}

export function limitReason(status, message = '') {
  if (status !== 429) return null;
  const m = String(message).toLowerCase();
  if (m.includes('monthly')) return 'monthly_budget';
  if (m.includes("you've used your")) return 'ip_daily';
  return 'global_daily';
}

/** Fire-and-forget client or server track(). Never throws. */
export async function trackEvent(trackFn, name, props) {
  if (typeof trackFn !== 'function') return;
  if (!Object.values(EVENTS).includes(name)) return;
  try {
    await trackFn(name, eventProps(props));
  } catch {
    // Analytics must never break the checker.
  }
}
