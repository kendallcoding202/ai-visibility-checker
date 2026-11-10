// "How to get into this answer" — derived only from citations already stored on a check.
import { host } from './analyze.js';

const MAX_CITATIONS = 8;
const MAX_URL = 2000;
const MAX_TITLE = 140;
const MAX_SITES = 6;
const SHORT_URL = 64;

const ACTIONS = {
  review: [
    'Get listed or reviewed on this site.',
    'Ask a customer to leave a review there if the site allows it.',
  ],
  directory: [
    'Submit your product so it is listed on this site.',
  ],
  listicle: [
    'Ask the publisher to include you in this roundup.',
    'Publish your own comparison page for the same question.',
  ],
};

const DEFAULT_ACTIONS = [
  'Earn a mention on this site.',
  'Publish a page that answers the same question with clear facts.',
];

export function packCitations(list) {
  const out = [];
  const seen = new Set();
  for (const c of list ?? []) {
    let url = String(c?.url ?? '').trim().split('#')[0];
    if (!/^https?:\/\//i.test(url) || url.length > MAX_URL || seen.has(url)) continue;
    seen.add(url);
    const title = String(c?.title ?? '').replace(/[\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_TITLE);
    out.push(title ? { url, title } : { url });
    if (out.length >= MAX_CITATIONS) break;
  }
  return out;
}

export function safeHref(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u.href;
  } catch {
    return null;
  }
}

function canon(url) {
  const u = new URL(url);
  const name = u.hostname.replace(/^www\./, '').toLowerCase();
  const path = u.pathname.replace(/\/$/, '') || '/';
  return `${u.protocol}//${name}${path}${u.search}`;
}

export function shortUrl(url, max = SHORT_URL) {
  const href = safeHref(url);
  if (!href) return '';
  const u = new URL(href);
  const path = u.pathname === '/' ? '' : u.pathname;
  const text = `${u.hostname.replace(/^www\./, '')}${path}${u.search}`;
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

/** Label a page only when the URL or title itself says what it is. */
export function pageKind({ url, title } = {}) {
  let path = '';
  try { path = new URL(url).pathname.toLowerCase(); } catch { return null; }
  const text = `${title ?? ''} ${path}`.toLowerCase();
  const reviewPath = /\/reviews?(?:\/|$)/.test(path);
  const review = reviewPath || /\breviews?\b/.test(text);
  const listicle = /\b(best|top)\b.{0,40}\b(tools|software|platforms|apps|alternatives)\b/.test(text)
    || /\b(alternatives|roundup|comparison)\b/.test(text)
    || /\/best-|\/top-\d+|\/alternatives/.test(path);
  const directory = /\bdirector(y|ies)\b/.test(text) || /\/directory|\/listings?\b/.test(path);
  // A /reviews path stays a review page even if the title also says "best software".
  if (reviewPath) return 'review';
  if (listicle) return 'listicle';
  if (review) return 'review';
  if (directory) return 'directory';
  return null;
}

function majorityKind(pages) {
  const counts = new Map();
  for (const p of pages) {
    const k = pageKind(p);
    if (!k) continue;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  let best = null;
  let n = 0;
  for (const [k, c] of counts) {
    if (c > n) { best = k; n = c; }
  }
  return best;
}

export function actionsFor(kind) {
  return ACTIONS[kind] ?? DEFAULT_ACTIONS;
}

/**
 * Fix list for questions that did not name the brand.
 * Returns null when every question named the brand (nothing to show).
 * Sites are cited domains, deduped, ranked by citation count across those questions only.
 */
export function buildFixList(result) {
  const missing = (result?.rows ?? []).filter((r) => !r.mentioned);
  if (!missing.length) return null;

  const questions = [];
  const byDomain = new Map();

  missing.forEach((row) => {
    const pages = [];
    const seen = new Set();
    for (const c of row.citations ?? []) {
      const href = safeHref(c?.url);
      const key = href && canon(href);
      if (!href || seen.has(key)) continue;
      seen.add(key);
      const title = String(c?.title ?? '').replace(/\s+/g, ' ').trim();
      const page = { url: href, ...(title ? { title } : {}) };
      pages.push(page);
      const domain = host(href);
      if (!domain) continue;
      const bucket = byDomain.get(domain) ?? { domain, n: 0, pages: [] };
      bucket.n += 1;
      bucket.pages.push(page);
      byDomain.set(domain, bucket);
    }
    questions.push({ prompt: row.prompt, pages, stored: Array.isArray(row.citations) });
  });

  const sites = [...byDomain.values()]
    .sort((a, b) => b.n - a.n || a.domain.localeCompare(b.domain))
    .slice(0, MAX_SITES)
    .map((s) => {
      const kind = majorityKind(s.pages);
      return { domain: s.domain, n: s.n, kind, actions: actionsFor(kind) };
    });

  return { questions, sites };
}
