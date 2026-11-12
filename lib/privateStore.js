// Sealed JSON for email records and raw answers.
// The Blob store rejects access:"private" on put (the SDK reports an unknown
// error and does not save the object). Callers seal the value first. Objects
// are public, under unguessable pathnames, and this module never returns a URL.
//
// Public blob URLs are served by the CDN. A new object can 404 there for a
// while, and an overwrite or delete can keep serving the previous bytes for
// at least a minute. head() is the Blob API. The body is read from the private
// origin host with cache=0, not from head().url. A miss is retried briefly.
// A missing key is null. Local tests use memory. Values and URLs are not logged.
import { del, head, put } from '@vercel/blob';
import { isMissingBlob } from './store.js';

const mem = new Map();
const hasBlob = () => !!process.env.BLOB_READ_WRITE_TOKEN;
let testClient = null;
let readDelays = null;

const DEFAULT_DELAYS = [0, 50, 150, 350];

export function resetPrivateStoreForTests() {
  mem.clear();
  testClient = null;
  readDelays = null;
}

/** Test-only. Production routes never call this. */
export function setPrivateBlobClientForTests(client) {
  testClient = client;
}

/** Test-only. Replaces the miss backoff so tests do not sleep. */
export function setPrivateReadDelaysForTests(delays) {
  readDelays = delays;
}

function remote() {
  return Boolean(testClient) || hasBlob();
}

function timeout() {
  return AbortSignal.timeout(8_000);
}

function delays() {
  return readDelays ?? DEFAULT_DELAYS;
}

function sleep(ms) {
  if (!ms) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function pathnameFor(key) {
  return `sealed/${key}.json`;
}

function storeIdFromToken(token) {
  return String(token ?? '').split('_')[3] ?? '';
}

function logStoreError(error) {
  const raw = String(error?.message || error?.name || 'Error')
    .replace(/bearer\s+\S+/gi, 'bearer [redacted]')
    .replace(/[\r\n]/g, ' ')
    .slice(0, 120);
  console.error(`sealed store failed msg=${raw}`);
}

function alreadyExists(error) {
  const msg = String(error?.message || '');
  return /already exists/i.test(msg) || /allowOverwrite/i.test(msg);
}

function matchesSize(text, meta, etag) {
  const size = meta?.size;
  if (typeof size === 'number' && size >= 0 && Buffer.byteLength(text) !== size) return false;
  if (meta?.etag && etag && meta.etag !== etag) return false;
  return true;
}

// Origin read. cache=0 on the private host bypasses the public CDN.
// The public URL from head() is not fetched here.
export function sealedOriginUrl(pathname) {
  const token = process.env.BLOB_READ_WRITE_TOKEN ?? '';
  const id = storeIdFromToken(token);
  if (!id || !token) return null;
  const url = new URL(`https://${id}.private.blob.vercel-storage.com/${pathname}`);
  url.searchParams.set('cache', '0');
  return url;
}

async function readOrigin(pathname) {
  if (testClient?.read) return testClient.read(pathname);
  const url = sealedOriginUrl(pathname);
  const token = process.env.BLOB_READ_WRITE_TOKEN ?? '';
  if (!url || !token) return { status: 0, text: '' };
  const response = await fetch(url, {
    cache: 'no-store',
    signal: timeout(),
    headers: {
      authorization: `Bearer ${token}`,
      'cache-control': 'no-cache',
    },
  });
  const text = response.status === 200 ? await response.text() : '';
  return { status: response.status, text, etag: response.headers.get('etag') };
}

async function readPublic(meta) {
  if (!meta?.url) return { status: 0, text: '' };
  let url;
  try { url = new URL(meta.url); } catch { return { status: 0, text: '' }; }
  if (!url.hostname.endsWith('.public.blob.vercel-storage.com')) return { status: 0, text: '' };
  url.searchParams.set('t', `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`);
  const response = await fetch(url, {
    cache: 'no-store',
    signal: timeout(),
    headers: { 'cache-control': 'no-cache', pragma: 'no-cache' },
  });
  const text = response.status === 200 ? await response.text() : '';
  return { status: response.status, text, etag: response.headers.get('etag') };
}

function parseBody(text, meta, etag) {
  if (!text || !matchesSize(text, meta, etag)) return undefined;
  try { return JSON.parse(text); } catch { return null; }
}

export async function putPrivateJSON(key, value, options = {}) {
  const once = options.once === true;
  const body = JSON.stringify(value);
  if (!remote()) {
    if (once && mem.has(key)) return;
    mem.set(key, body);
    return;
  }
  const putFn = testClient?.put ?? put;
  try {
    await putFn(pathnameFor(key), body, {
      access: 'public',
      addRandomSuffix: false,
      allowOverwrite: !once,
      contentType: 'application/json',
      cacheControlMaxAge: 60,
      abortSignal: timeout(),
    });
  } catch (error) {
    if (once && alreadyExists(error)) return;
    throw error;
  }
}

export async function delPrivateKey(key) {
  if (!remote()) {
    mem.delete(key);
    return;
  }
  const delFn = testClient?.del ?? del;
  await delFn(pathnameFor(key), { abortSignal: timeout() });
}

export async function hasPrivateKey(key) {
  if (!remote()) return mem.has(key);
  const headFn = testClient?.head ?? head;
  try {
    await headFn(pathnameFor(key), { abortSignal: timeout() });
    return true;
  } catch (error) {
    if (isMissingBlob(error)) return false;
    logStoreError(error);
    return false;
  }
}

export async function getPrivateJSON(key, options = {}) {
  if (!remote()) {
    const raw = mem.get(key);
    return raw ? JSON.parse(raw) : null;
  }
  const attempts = options.retry === true ? delays() : [0];
  let sawHead = false;
  let lastMeta = null;
  for (let i = 0; i < attempts.length; i++) {
    if (attempts[i]) await sleep(attempts[i]);
    const headFn = testClient?.head ?? head;
    let meta;
    try {
      meta = await headFn(pathnameFor(key), { abortSignal: timeout() });
    } catch (error) {
      if (isMissingBlob(error)) continue;
      logStoreError(error);
      return null;
    }
    if (!meta) continue;
    sawHead = true;
    lastMeta = meta;
    try {
      const origin = await readOrigin(pathnameFor(key));
      if (origin.status === 200) {
        const parsed = parseBody(origin.text, meta, origin.etag);
        if (parsed !== undefined) return parsed;
        continue;
      }
      // The private host rejects some public stores. Do not treat that as a miss.
      if (origin.status === 400 || origin.status === 403) {
        const pub = await readPublic(meta);
        if (pub.status === 200) {
          const parsed = parseBody(pub.text, meta, pub.etag);
          if (parsed !== undefined) return parsed;
        }
      }
    } catch (error) {
      if (isMissingBlob(error)) continue;
      logStoreError(error);
      return null;
    }
  }
  // Head sees the object but the private host never returned it. One public
  // read, accepted only when the body length matches the API metadata.
  if (sawHead && lastMeta) {
    try {
      const pub = await readPublic(lastMeta);
      if (pub.status === 200) {
        const parsed = parseBody(pub.text, lastMeta, pub.etag);
        if (parsed !== undefined) return parsed;
      }
    } catch (error) {
      logStoreError(error);
    }
  }
  return null;
}
