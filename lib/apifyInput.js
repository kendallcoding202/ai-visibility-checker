import { TRACKER } from '../app/links.js';

// Pure builders for the Apify inputs the result page hands over.
// The full input (prompts, competitors, engines) goes to the clipboard only.
// Apify Console does not apply a visitor's input from the URL: schema `prefill` is fixed,
// and a published task cannot carry that visitor's brand. The tracker link may still
// carry brand and category as encoded query params when they pass the allowlist below.
// Actor: r5fguKH3mxvfARnap (crunchy_galaxy_qcr/ai-visibility-tracker).

export const VIS_PRICE = 0.0375; // AI Visibility Tracker, Apify Free tier per answer as of 2026-11-11. Bronze 0.034, Silver 0.03, Gold and up 0.028.
export const CIT_PRICE = 0.05; // AI Citation Tracker, free-tier price per answer
// Visibility engines are the checker's existing set (all valid on that actor).
export const VIS_ENGINES = ['chatgpt-search', 'gemini-knowledge', 'perplexity-search'];
// Citation actor default. Google AI Overviews and AI Mode are opt-in, so they are not included.
export const CIT_ENGINES = ['chatgpt', 'perplexity'];

const TRACKER_ORIGIN = 'https://apify.com';
const TRACKER_PATH = '/crunchy_galaxy_qcr/ai-visibility-tracker';
// Same allowlist as the check API (app/api/check/route.js). Anything else is omitted, not stripped into the URL.
const FIELD = /^[\p{L}\p{N} .,&'+\-/()!]+$/u;
const PLACEMENT = /^[a-z0-9-]{1,40}$/;
const BRAND_MAX = 60;
const CATEGORY_MAX = 80;

const slug = (s) => `${s}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

export function trackerInput(d) {
  const comps = [...new Set([...(d.competitorHits ?? []).map((c) => c.name), ...(d.topBrands ?? []).map((b) => b.name)])].slice(0, 5);
  return {
    brand: d.brand, competitors: comps, prompts: (d.rows ?? []).map((r) => r.prompt), category: d.category,
    engines: VIS_ENGINES, samplesPerPrompt: 1,
    trackingName: `${slug(d.brand)}-weekly`,
  };
}

/** Return the string when it is safe to put in a query value, otherwise ''. */
export function urlField(value, max) {
  if (typeof value !== 'string') return '';
  if (!value || value.length > max) return '';
  if (/[\u0000-\u001f\u007f]/.test(value)) return '';
  if (value !== value.trim() || /\s{2,}/.test(value)) return '';
  if (!FIELD.test(value)) return '';
  return value;
}

/**
 * Store URL for the visibility actor plus UTM, and brand/category only when they validate.
 * Host and path stay fixed. URLSearchParams encodes the values, so `&`, spaces and quotes
 * cannot add parameters or change the destination.
 */
export function trackerCtaUrl(d, placement = 'result-cta') {
  const content = PLACEMENT.test(placement) ? placement : 'result-cta';
  const url = new URL(TRACKER(content));
  url.searchParams.set('utm_source', 'ai-visibility-checker');
  url.searchParams.set('utm_medium', 'referral');
  url.searchParams.set('utm_campaign', 'free-checker');
  url.searchParams.set('utm_content', content);
  const brand = urlField(d?.brand, BRAND_MAX);
  const category = urlField(d?.category, CATEGORY_MAX);
  if (brand) url.searchParams.set('brand', brand);
  if (category) url.searchParams.set('category', category);
  if (url.origin !== TRACKER_ORIGIN || url.pathname !== TRACKER_PATH) return TRACKER('result-cta');
  return url.toString();
}

export function citationInput(d) {
  return { prompts: (d.rows ?? []).map((r) => r.prompt), yourDomains: [], engines: CIT_ENGINES, samplesPerPrompt: 1 };
}

export const runCost = (input, price) => +(input.prompts.length * input.engines.length * (input.samplesPerPrompt ?? 1) * price).toFixed(2);
