// Tiny JSON key-value store on Vercel Blob (private-ish keys, cache-busted reads).
// Falls back to process memory when BLOB_READ_WRITE_TOKEN is absent (local dev).
// Reads retry short transient failures. A missing key is empty. A key head() saw
// but whose body never arrives stays a failure, so a counter cannot reset to zero.
// Counter updates go through mutateJSON: a conditional put (ifMatch / create-if-absent)
// so two parallel requests cannot both commit the same read.
import { createHash } from 'node:crypto';
import { put, head, BlobNotFoundError, BlobPreconditionFailedError } from '@vercel/blob';

const mem = new Map();
let memVersion = 0;
const hasBlob = () => !!process.env.BLOB_READ_WRITE_TOKEN;

function memoryEtag() {
  memVersion += 1;
  return `"m${memVersion}"`;
}
let testRead = null;
let testHead = null;
let testPut = null;
let readDelaysOverride = null;

export const BLOB_READ_ATTEMPTS = 3;
export const BLOB_READ_DELAYS = [0, 150, 400];
export const BLOB_ATTEMPT_MS = 2_000;
export const BLOB_WRITE_ATTEMPTS = 2;
export const BLOB_WRITE_DELAY_MS = 200;

export function blobReadWorstMs() {
  return BLOB_READ_ATTEMPTS * BLOB_ATTEMPT_MS + BLOB_READ_DELAYS.reduce((sum, ms) => sum + ms, 0);
}

export function blobWriteWorstMs() {
  return BLOB_WRITE_ATTEMPTS * BLOB_ATTEMPT_MS + BLOB_WRITE_DELAY_MS * (BLOB_WRITE_ATTEMPTS - 1);
}

export function resetStoreForTests() {
  mem.clear();
  memVersion = 0;
  testRead = null;
  testHead = null;
  testPut = null;
  readDelaysOverride = null;
}

/** Test-only. Production routes never call this. */
export function setReadJSONForTests(fn) {
  testRead = fn;
}

/** Test-only. Production routes never call this. */
export function setBlobClientForTests({ head: headFn = null, put: putFn = null } = {}) {
  testHead = headFn;
  testPut = putFn;
}

/** Test-only. Replaces read backoff so tests do not sleep. */
export function setReadRetryForTests(delays) {
  readDelaysOverride = delays;
}

// @vercel/blob@2.8.2: BlobNotFoundError extends BlobError extends Error and never
// sets this.name. head() throws it for API code "not_found" with message
// "Vercel Blob: The requested blob does not exist" and no status. In the
// production bundle the name is "Error", and a minifier can rename the class.
// Match the class or that exact message. Do not match other Blob errors
// ("This store does not exist.", access, timeout, network): those stay failures.
const MISSING_BLOB_MESSAGE = 'Vercel Blob: The requested blob does not exist';

export function isMissingBlob(error) {
  if (!error || typeof error !== 'object') return false;
  if (error instanceof BlobNotFoundError) return true;
  if (error.message === MISSING_BLOB_MESSAGE) return true;
  if (error.name === 'BlobNotFoundError') return true;
  const status = error.status ?? error.statusCode;
  return status === 404;
}

const PERMANENT_BLOB = [
  'does not exist',
  'private access',
  'already exists',
  'suspended',
  'Access denied',
  'token has expired',
  'Content type mismatch',
  'Pathname mismatch',
  'File is too large',
  'Precondition failed',
];

// Lost compare-and-swap: the blob was created or changed since we read it.
// Callers re-read and try again. This is not a successful write.
export function isConflictError(error) {
  if (!error || typeof error !== 'object') return false;
  if (error instanceof BlobPreconditionFailedError) return true;
  if (error.name === 'BlobPreconditionFailedError') return true;
  const status = error.status ?? error.statusCode;
  if (status === 412) return true;
  const message = typeof error.message === 'string' ? error.message : '';
  if (message.includes('Precondition failed')) return true;
  if (message.includes('already exists')) return true;
  return false;
}

export function isTransientBlobError(error) {
  if (!error || typeof error !== 'object' || isMissingBlob(error)) return false;
  const status = error.status ?? error.statusCode;
  if (status === 400 || status === 401 || status === 403 || status === 404) return false;
  if (status === 408 || status === 429 || status === 500 || status === 502 || status === 503 || status === 504) return true;
  const name = String(error.name || '');
  if (name === 'TimeoutError' || name === 'AbortError' || name === 'TypeError') return true;
  const message = typeof error.message === 'string' ? error.message : '';
  if (!message.startsWith('Vercel Blob:')) return false;
  if (PERMANENT_BLOB.some((part) => message.includes(part))) return false;
  return true;
}

export function safeErrorName(error) {
  const name = String(error?.name || 'Error').replace(/[^A-Za-z0-9_]/g, '').slice(0, 40);
  return name || 'Error';
}

function readDelays() {
  return readDelaysOverride ?? BLOB_READ_DELAYS;
}

function attemptTimeoutMs() {
  const n = Number(process.env.BLOB_TIMEOUT_MS);
  const ms = Number.isFinite(n) && n > 0 ? n : BLOB_ATTEMPT_MS;
  return Math.min(ms, BLOB_ATTEMPT_MS);
}

function sleep(ms) {
  if (!ms) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function httpStatus(status) {
  return Number.isInteger(status) && status >= 400 && status <= 599 ? status : 0;
}

// head() URLs are Blob hosts. Never follow a different host with the store token.
function blobHostOk(raw) {
  let host = '';
  try { host = new URL(raw).hostname.toLowerCase(); } catch { return false; }
  if (host === 'blob.test') return testHead != null;
  return host.endsWith('.blob.vercel-storage.com');
}

// Same public store as sealed records: the private host returns the bytes the CDN can still 404.
// The store id is the fourth underscore field of the read-write token. cache=0 is rejected here.
function originUrl(pathname) {
  const token = process.env.BLOB_READ_WRITE_TOKEN ?? '';
  const id = token.split('_')[3] ?? '';
  if (!id || !/^[A-Za-z0-9]+$/.test(id)) return null;
  return new URL(`https://${id}.private.blob.vercel-storage.com/${pathname}`);
}

function sizeOk(text, meta) {
  const size = meta?.size;
  return !(typeof size === 'number' && size >= 0 && Buffer.byteLength(text) !== size);
}

function logReadFailure(failure) {
  if (failure.status) console.error(`blob read failed status=${failure.status}`);
  else console.error(`blob read failed name=${failure.name || 'Error'}`);
}

function retryableStatus(status) {
  return status === 408 || status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

async function readText(url, signal, auth) {
  const token = process.env.BLOB_READ_WRITE_TOKEN ?? '';
  const headers = {};
  if (auth && token) headers.authorization = `Bearer ${token}`;
  const response = await fetch(url, { cache: 'no-store', signal, headers });
  const text = response.status === 200 ? await response.text() : '';
  return { status: response.status, text, etag: response.headers.get('etag') || '' };
}

// The etag has to belong to the bytes we parsed. A newer head etag with an older
// body would let a conditional write commit a stale counter. Test doubles that
// omit etag get a hash of the body so sequential tests can still settle.
function etagForBody(responseEtag, meta, bodyText) {
  if (responseEtag) return responseEtag;
  if (testHead) return `"${createHash('sha1').update(bodyText).digest('hex').slice(0, 16)}"`;
  if (meta?.etag && sizeOk(bodyText, meta)) return meta.etag;
  return '';
}

// One attempt: head, then the private host, then the public URL. They share one timeout.
async function readOnce(key) {
  const pathname = `kv/${key}.json`;
  const signal = AbortSignal.timeout(attemptTimeoutMs());
  const headFn = testHead ?? head;
  const meta = await headFn(pathname, { abortSignal: signal });
  const sawHead = Boolean(meta);
  if (!sawHead) return { ok: false, value: null, reason: 'empty', name: 'Error', retry: true, sawHead: false };

  const tryParse = (text) => {
    if (!sizeOk(text, meta)) return { mismatch: true };
    try { return { value: JSON.parse(text) }; } catch { return { badJson: true }; }
  };

  let sawMiss = false;
  let sawRetry = false;
  let retryStatus = 0;
  let retryName = '';
  let sawOther = 0;
  const take = (parsed, status, responseEtag, bodyText) => {
    if (parsed?.value !== undefined) {
      const etag = etagForBody(responseEtag, meta, bodyText ?? '');
      const done = { ok: true, value: parsed.value, sawHead: true };
      if (etag) done.etag = etag;
      return done;
    }
    if (parsed?.badJson) return { ok: false, value: null, reason: 'json', name: 'SyntaxError', retry: false, sawHead: true };
    if (status === 404) sawMiss = true;
    else if (retryableStatus(status)) {
      sawRetry = true;
      retryStatus = status;
    } else if (status) sawOther = status;
    return null;
  };

  const origin = originUrl(pathname);
  if (origin) {
    try {
      const got = await readText(origin, signal, true);
      const done = take(got.status === 200 ? tryParse(got.text) : null, got.status, got.etag, got.text);
      if (done) return done;
    } catch (error) {
      if (!isTransientBlobError(error)) {
        return { ok: false, value: null, reason: safeErrorName(error), name: safeErrorName(error), retry: false, sawHead: true };
      }
      sawRetry = true;
      retryName = safeErrorName(error);
    }
  }

  if (meta.url && blobHostOk(meta.url)) {
    try {
      const url = new URL(meta.url);
      url.searchParams.set('t', String(Date.now()));
      const got = await readText(url, signal, false);
      const done = take(got.status === 200 ? tryParse(got.text) : null, got.status, got.etag, got.text);
      if (done) return done;
    } catch (error) {
      if (!isTransientBlobError(error)) {
        return { ok: false, value: null, reason: safeErrorName(error), name: safeErrorName(error), retry: false, sawHead: true };
      }
      sawRetry = true;
      retryName = safeErrorName(error);
    }
  } else if (!origin) {
    return { ok: false, value: null, reason: 'host', name: 'HostError', retry: false, sawHead: false };
  }

  // head() found the object. A 404 from either host is replication lag, not an empty key.
  if (sawMiss && !sawOther) {
    return { ok: false, value: null, reason: 'status-404', status: 404, name: 'Error', retry: true, sawHead: true };
  }
  if (sawRetry && !sawOther) {
    const status = httpStatus(retryStatus);
    return {
      ok: false,
      value: null,
      reason: status ? `status-${status}` : (retryName || 'TimeoutError'),
      status,
      name: status ? 'Error' : (retryName || 'TimeoutError'),
      retry: true,
      sawHead: true,
    };
  }
  const status = httpStatus(sawOther);
  return {
    ok: false,
    value: null,
    reason: status ? `status-${status}` : 'empty',
    status,
    name: 'Error',
    retry: Boolean(status && retryableStatus(status)),
    sawHead: true,
  };
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
  if (!hasBlob()) {
    const row = mem.get(key);
    if (!row) return { ok: true, value: null };
    return { ok: true, value: row.value, etag: row.etag };
  }
  const delays = readDelays();
  let last = { ok: false, value: null, reason: 'empty', name: 'Error', retry: false };
  let sawHead = false;
  for (let i = 0; i < delays.length; i++) {
    if (delays[i]) await sleep(delays[i]);
    try {
      last = await readOnce(key);
      if (last.sawHead) sawHead = true;
    } catch (error) {
      if (isMissingBlob(error)) {
        if (!sawHead) return { ok: true, value: null };
        last = { ok: false, value: null, reason: 'status-404', status: 404, name: 'Error', retry: false };
        break;
      }
      last = {
        ok: false,
        value: null,
        reason: safeErrorName(error),
        name: safeErrorName(error),
        retry: isTransientBlobError(error),
      };
    }
    if (last.ok || !last.retry) break;
  }
  if (!last.ok) logReadFailure(last);
  if (last.ok) {
    const out = { ok: true, value: last.value };
    if (typeof last.etag === 'string' && last.etag) out.etag = last.etag;
    return out;
  }
  return { ok: false, value: null, reason: last.reason };
}

/**
 * Public cache record. A missing key is a miss. A store error stays an error
 * so a shared page can say the result is unavailable instead of "not found".
 */
export async function loadPublicCache(key) {
  const read = await readJSON(key);
  if (!read.ok) return { ok: false, result: null };
  const result = read.value && typeof read.value === 'object' ? read.value.result ?? null : null;
  if (!result || typeof result !== 'object') return { ok: true, result: null };
  return { ok: true, result };
}

function memoryCas(key, value, etag) {
  const row = mem.get(key);
  const current = row ? row.etag : null;
  if ((etag ?? null) !== (current ?? null)) return { ok: false, conflict: true };
  const next = memoryEtag();
  mem.set(key, { value, etag: next });
  return { ok: true, etag: next };
}

// One conditional write. A conflict is returned to the caller so it can re-read.
// Transient failures retry. Anything else fails closed (the previous value stays).
async function compareAndSwapJSON(key, value, etag) {
  if (!hasBlob()) return memoryCas(key, value, etag);
  const putFn = testPut ?? put;
  const body = JSON.stringify(value);
  const pathname = `kv/${key}.json`;
  for (let i = 0; i < BLOB_WRITE_ATTEMPTS; i++) {
    if (i) await sleep(BLOB_WRITE_DELAY_MS);
    try {
      const options = {
        access: 'public',
        addRandomSuffix: false,
        allowOverwrite: etag != null,
        contentType: 'application/json',
        cacheControlMaxAge: 60,
        abortSignal: AbortSignal.timeout(attemptTimeoutMs()),
      };
      if (etag != null) options.ifMatch = etag;
      else options.allowOverwrite = false;
      const result = await putFn(pathname, body, options);
      return { ok: true, etag: typeof result?.etag === 'string' ? result.etag : null };
    } catch (error) {
      if (isConflictError(error)) return { ok: false, conflict: true };
      if (!isTransientBlobError(error)) return { ok: false, reason: 'write' };
    }
  }
  return { ok: false, reason: 'write' };
}

export const CAS_ATTEMPTS = 16;

/**
 * Read-modify-write one key so overlapping callers cannot both commit the same read.
 * `updater` returns `{ value }` to write, `{ deny }` to stop without writing, or `{ abort: true }`
 * to fail closed. A missing etag on an existing value fails closed instead of overwriting.
 * The updater result is not logged.
 */
export async function mutateJSON(key, updater, { attempts = CAS_ATTEMPTS } = {}) {
  const tries = Number.isFinite(attempts) && attempts > 0 ? Math.min(Math.floor(attempts), 32) : CAS_ATTEMPTS;
  for (let i = 0; i < tries; i++) {
    const read = await readJSON(key);
    if (!read.ok) return { ok: false, reason: 'read' };
    let decision;
    try {
      decision = updater(read.value);
    } catch {
      console.error('counter update failed reason=updater');
      return { ok: false, reason: 'updater' };
    }
    if (!decision || typeof decision !== 'object') {
      console.error('counter update failed reason=updater');
      return { ok: false, reason: 'updater' };
    }
    if (decision.deny) return { ok: false, deny: decision.deny, value: read.value };
    if (decision.abort || !Object.hasOwn(decision, 'value')) {
      console.error('counter update failed reason=abort');
      return { ok: false, reason: 'abort' };
    }
    if (read.value != null && (typeof read.etag !== 'string' || !read.etag)) {
      console.error('counter update failed reason=etag');
      return { ok: false, reason: 'etag' };
    }
    const wrote = await compareAndSwapJSON(key, decision.value, read.value == null ? null : read.etag);
    if (wrote.ok) return { ok: true, value: decision.value, etag: wrote.etag };
    if (wrote.conflict) continue;
    console.error('counter update failed reason=write');
    return { ok: false, reason: wrote.reason || 'write' };
  }
  console.error('counter update failed reason=conflict');
  return { ok: false, reason: 'conflict' };
}

export async function setJSON(key, value) {
  if (!hasBlob()) {
    mem.set(key, { value, etag: memoryEtag() });
    return;
  }
  const putFn = testPut ?? put;
  const body = JSON.stringify(value);
  const pathname = `kv/${key}.json`;
  let last;
  for (let i = 0; i < BLOB_WRITE_ATTEMPTS; i++) {
    if (i) await sleep(BLOB_WRITE_DELAY_MS);
    try {
      await putFn(pathname, body, {
        access: 'public',
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: 'application/json',
        cacheControlMaxAge: 60,
        abortSignal: AbortSignal.timeout(attemptTimeoutMs()),
      });
      return;
    } catch (error) {
      last = error;
      if (!isTransientBlobError(error)) break;
    }
  }
  throw last;
}
