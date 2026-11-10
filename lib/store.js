// Tiny JSON key-value store on Vercel Blob (private-ish keys, cache-busted reads).
// Falls back to process memory when BLOB_READ_WRITE_TOKEN is absent (local dev).
import { put, head } from '@vercel/blob';
const mem = new Map();
const hasBlob = () => !!process.env.BLOB_READ_WRITE_TOKEN;

// Short on purpose: a hung Blob call must fail before the platform kills the function.
function blobTimeoutMs() {
  const n = Number(process.env.BLOB_TIMEOUT_MS);
  const ms = Number.isFinite(n) && n > 0 ? n : 5_000;
  return Math.min(ms, 8_000);
}

export async function getJSON(key) {
  if (!hasBlob()) return mem.get(key) ?? null;
  try {
    const signal = AbortSignal.timeout(blobTimeoutMs());
    const h = await head(`kv/${key}.json`, { abortSignal: signal });
    const r = await fetch(`${h.url}?t=${Date.now()}`, { cache: 'no-store', signal });
    return r.ok ? await r.json() : null;
  } catch { return null; }
}
export async function setJSON(key, value) {
  if (!hasBlob()) { mem.set(key, value); return; }
  await put(`kv/${key}.json`, JSON.stringify(value), {
    access: 'public', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json', cacheControlMaxAge: 60,
    abortSignal: AbortSignal.timeout(blobTimeoutMs()),
  });
}
