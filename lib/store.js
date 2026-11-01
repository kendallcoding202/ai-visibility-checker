// Tiny JSON key-value store on Vercel Blob (private-ish keys, cache-busted reads).
// Falls back to process memory when BLOB_READ_WRITE_TOKEN is absent (local dev).
import { put, head } from '@vercel/blob';
const mem = new Map();
const hasBlob = () => !!process.env.BLOB_READ_WRITE_TOKEN;

export async function getJSON(key) {
  if (!hasBlob()) return mem.get(key) ?? null;
  try {
    const h = await head(`kv/${key}.json`);
    const r = await fetch(`${h.url}?t=${Date.now()}`, { cache: 'no-store' });
    return r.ok ? await r.json() : null;
  } catch { return null; }
}
export async function setJSON(key, value) {
  if (!hasBlob()) { mem.set(key, value); return; }
  await put(`kv/${key}.json`, JSON.stringify(value), {
    access: 'public', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json', cacheControlMaxAge: 60,
  });
}
