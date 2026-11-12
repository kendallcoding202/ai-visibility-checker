// Daily totals for the monthly-tracking offer.
// One Blob object per UTC day, overwritten in place. The pathname is a salted
// hash, so it is not guessable on the public store. Reads go through readJSON.
// Do not add a zero cache query: this public store answers 400 for that.
// Values are four counters plus a write budget. No brand, email, IP, or raw text.
// Failures are swallowed. Callers in the checker, checkout, and webhook must not see them.
import { timingSafeEqual } from 'node:crypto';
import { hashKey } from './hash.js';
import { readJSON, setJSON } from './store.js';

export const METRIC_COUNTER_CAP = 100_000;
export const METRIC_WRITE_CAP = 5_000;
export const MAX_STORED_BYTES = 256;
export const METRICS_WINDOW_DAYS = 14;
export const ADMIN_METRICS_LIMIT = 30;
export const OFFER_EVENT_LIMIT = 12;

const ADMIN_WINDOW_MS = 60_000;
const OFFER_WINDOW_MS = 10 * 60 * 1000;
const OFFER_BUCKET_MAX = 500;
const KEY_LABEL = 'tracking-offer-v1';

export const METRIC_FIELDS = {
  impression: 'impressions',
  click: 'clicks',
  checkout: 'checkouts',
  subscription: 'subscriptions',
};

const COUNT_FIELDS = Object.values(METRIC_FIELDS);

let nowFn = () => Date.now();
let writeJSON = setJSON;
let tail = Promise.resolve();
const offerBuckets = new Map();
const adminHits = [];

export function resetTrackingMetricsForTests() {
  nowFn = () => Date.now();
  writeJSON = setJSON;
  tail = Promise.resolve();
  offerBuckets.clear();
  adminHits.length = 0;
}

export function setMetricsClockForTests(fn) {
  nowFn = typeof fn === 'function' ? fn : () => Date.now();
}

/** Test-only. Production routes never call this. */
export function setMetricsWriterForTests(fn) {
  writeJSON = typeof fn === 'function' ? fn : setJSON;
}

/** Test-only. Keys are salted hashes, never raw IPs. */
export function offerLimiterStateForTests() {
  return { size: offerBuckets.size, keys: [...offerBuckets.keys()] };
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) {
    timingSafeEqual(left, left);
    return false;
  }
  return timingSafeEqual(left, right);
}

export function metricsAuthorized(header) {
  const presented = String(header ?? '');
  const secrets = ['CRON_SECRET', 'ADMIN_SECRET']
    .map((name) => String(process.env[name] ?? '').trim())
    .filter((secret) => secret.length >= 16);
  const candidates = secrets.length ? secrets : ['x'.repeat(16)];
  let ok = false;
  for (const secret of candidates) {
    if (safeEqual(presented, `Bearer ${secret}`) && secrets.length) ok = true;
  }
  return ok;
}

export function adminMetricsAllowed(now = nowFn()) {
  const cutoff = now - ADMIN_WINDOW_MS;
  while (adminHits.length && adminHits[0] <= cutoff) adminHits.shift();
  if (adminHits.length >= ADMIN_METRICS_LIMIT) return false;
  adminHits.push(now);
  return true;
}

export function offerAllowed(ip, now = nowFn()) {
  const key = hashKey(String(ip || 'unknown'));
  for (const [bucketKey, slot] of offerBuckets) {
    if (now - slot.start >= OFFER_WINDOW_MS) offerBuckets.delete(bucketKey);
  }
  const existing = offerBuckets.get(key);
  if (existing) {
    if (existing.n >= OFFER_EVENT_LIMIT) return false;
    existing.n += 1;
    return true;
  }
  while (offerBuckets.size >= OFFER_BUCKET_MAX) {
    const oldest = offerBuckets.keys().next().value;
    offerBuckets.delete(oldest);
  }
  offerBuckets.set(key, { start: now, n: 1 });
  return true;
}

function clampInt(value, cap) {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) return 0;
  return Math.min(cap, value);
}

function blankCounts() {
  return { impressions: 0, clicks: 0, checkouts: 0, subscriptions: 0, writes: 0 };
}

function normalizeStored(value) {
  const out = blankCounts();
  if (!value || typeof value !== 'object' || Array.isArray(value)) return out;
  for (const field of COUNT_FIELDS) out[field] = clampInt(value[field], METRIC_COUNTER_CAP);
  out.writes = clampInt(value.writes, METRIC_WRITE_CAP);
  return out;
}

function storedTooBig(value) {
  if (value == null) return false;
  try {
    return Buffer.byteLength(JSON.stringify(value)) > MAX_STORED_BYTES;
  } catch {
    return true;
  }
}

function limited(counts) {
  if (counts.writes >= METRIC_WRITE_CAP) return true;
  return COUNT_FIELDS.some((field) => counts[field] >= METRIC_COUNTER_CAP);
}

function publicDay(date, counts) {
  return {
    date,
    impressions: counts.impressions,
    clicks: counts.clicks,
    checkouts: counts.checkouts,
    subscriptions: counts.subscriptions,
    limited: limited(counts),
  };
}

export function metricsStorageKey(day) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error('bad day');
  return `offer-metrics/${hashKey(KEY_LABEL)}/${day}`;
}

function utcDay(now = nowFn()) {
  return new Date(now).toISOString().slice(0, 10);
}

async function persist(key, counts) {
  const body = JSON.stringify(counts);
  if (Buffer.byteLength(body) > MAX_STORED_BYTES) return;
  await writeJSON(key, counts);
}

async function applyOne(field) {
  const day = utcDay();
  const key = metricsStorageKey(day);
  const read = await readJSON(key);
  if (!read.ok) return;
  const current = normalizeStored(read.value);
  const huge = storedTooBig(read.value);
  const frozen = current.writes >= METRIC_WRITE_CAP || current[field] >= METRIC_COUNTER_CAP;
  if (frozen) {
    if (huge) await persist(key, current);
    return;
  }
  const next = {
    impressions: current.impressions,
    clicks: current.clicks,
    checkouts: current.checkouts,
    subscriptions: current.subscriptions,
    writes: current.writes + 1,
  };
  next[field] += 1;
  await persist(key, next);
}

/** Never throws. One overwrite of that day's object, or no write when the cap is hit. */
export function recordTrackingMetric(event) {
  const field = METRIC_FIELDS[event];
  if (!field) return Promise.resolve();
  const job = tail.then(() => applyOne(field)).catch(() => {});
  tail = job;
  return job;
}

export async function readTrackingMetrics(now = nowFn()) {
  const days = [];
  for (let i = 0; i < METRICS_WINDOW_DAYS; i++) {
    const date = utcDay(now - i * 86400000);
    let read;
    try {
      read = await readJSON(metricsStorageKey(date));
    } catch {
      return { ok: false, days: [] };
    }
    if (!read?.ok) return { ok: false, days: [] };
    days.push(publicDay(date, normalizeStored(read.value)));
  }
  return { ok: true, days };
}
