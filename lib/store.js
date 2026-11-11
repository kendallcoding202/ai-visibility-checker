// Tiny JSON key-value store on Vercel Blob (private-ish keys, cache-busted reads).
// Falls back to process memory when BLOB_READ_WRITE_TOKEN is absent (local dev).
import { put, head } from '@vercel/blob';
const mem = new Map();
const hasBlob = () => !!process.env.BLOB_READ_WRITE_TOKEN;
let testRead = null;

export function resetStoreForTests() {
  mem.clear();
  testRead = null;
}

/** Test-only. Production routes never call this. */
export function setReadJSONForTests(fn) {
  testRead = fn;
}

export function isMissingBlob(error) {
  if (!error || typeof error !== 'object') return false;
  if (error.name === 'BlobNotFoundError') return true;
  const status = error.status ?? error.statusCode;
  return status === 404;
}

// Short on purpose: a hung Blob call must fail before the platform kills the function.
function blobTimeoutMs() {
  const n = Number(process.env.BLOB_TIMEOUT_MS);
  const ms = Number.isFinite(n) && n > 0 ? n : 5_000;
  return Math.min(ms, 8_000);
}

export async function getJSON(key) {
  const read = await readJSON(key);
  return read.ok ? read.value : null;
}

/**
 * Read a counter or cache record.
 * A missing key is `{ ok: true, value: null }`. A transport or store error is `{ ok: false }`
 * so callers can fail closed instead of treating the failure as a zero balance.
 */
export async function readJSON(key) {
  if (testRead) return testRead(key);
  if (!hasBlob()) return { ok: true, value: mem.has(key) ? mem.get(key) : null };
  try {
    // head() is authenticated. The following fetch cache-busts, because the object is public and
    // a cached 404 or a stale cost would let another call spend against the wrong balance.
    const h = await head(`kv/${key}.json`, { abortSignal: AbortSignal.timeout(blobTimeoutMs()) });
    const url = new URL(h.url);
    url.searchParams.set('t', String(Date.now()));
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    const r = await fetch(url, {
      cache: 'no-store',
      signal: AbortSignal.timeout(blobTimeoutMs()),
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });
    if (r.status === 404) return { ok: true, value: null };
    if (!r.ok) {
      console.error(`blob read failed status=${r.status}`);
      return { ok: false, value: null, reason: `status-${r.status}` };
    }
    return { ok: true, value: await r.json() };
  } catch (error) {
    if (isMissingBlob(error)) return { ok: true, value: null };
    const name = error?.name || 'Error';
    console.error(`blob read failed name=${name}`);
    return { ok: false, value: null, reason: name };
  }
}
export async function setJSON(key, value) {
  if (!hasBlob()) { mem.set(key, value); return; }
  await put(`kv/${key}.json`, JSON.stringify(value), {
    access: 'public', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json', cacheControlMaxAge: 60,
    abortSignal: AbortSignal.timeout(blobTimeoutMs()),
  });
}
