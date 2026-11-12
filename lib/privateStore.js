// Sealed JSON for email records and raw answers.
// The existing Blob store rejects access:"private" (the SDK reports an unknown
// error and does not save the object). Callers seal the value first. This module
// writes that ciphertext with the same token the rest of the app uses, under an
// unguessable pathname, and never returns the blob URL. A missing key is null.
// Local tests use memory. This module does not log values or URLs.
import { head, put } from '@vercel/blob';
import { isMissingBlob } from './store.js';

const mem = new Map();
const hasBlob = () => !!process.env.BLOB_READ_WRITE_TOKEN;

export function resetPrivateStoreForTests() {
  mem.clear();
}

function timeout() {
  return AbortSignal.timeout(8_000);
}

function logStoreError(error) {
  const raw = String(error?.message || error?.name || 'Error')
    .replace(/bearer\s+\S+/gi, 'bearer [redacted]')
    .replace(/[\r\n]/g, ' ')
    .slice(0, 120);
  console.error(`sealed store failed msg=${raw}`);
}

export async function putPrivateJSON(key, value) {
  const body = JSON.stringify(value);
  if (!hasBlob()) {
    mem.set(key, body);
    return;
  }
  await put(`sealed/${key}.json`, body, {
    access: 'public',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json',
    cacheControlMaxAge: 60,
    abortSignal: timeout(),
  });
}

export async function getPrivateJSON(key) {
  if (!hasBlob()) {
    const raw = mem.get(key);
    return raw ? JSON.parse(raw) : null;
  }
  try {
    const h = await head(`sealed/${key}.json`, { abortSignal: timeout() });
    const url = new URL(h.url);
    url.searchParams.set('t', String(Date.now()));
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    const response = await fetch(url, {
      cache: 'no-store',
      signal: timeout(),
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });
    if (response.status === 404) return null;
    if (!response.ok) {
      console.error(`sealed read failed status=${response.status}`);
      return null;
    }
    const text = await response.text();
    if (!text) return null;
    return JSON.parse(text);
  } catch (error) {
    if (isMissingBlob(error)) return null;
    logStoreError(error);
    return null;
  }
}
