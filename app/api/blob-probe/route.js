// Temporary diagnosis against the connected Blob store. Returns status codes
// and booleans only. No tokens, URLs, pathnames, or bodies. Removed before the fix lands.
import { del, get, head, put } from '@vercel/blob';
import { hashKey } from '../../../lib/hash.js';
import { delPrivateKey, getPrivateJSON, putPrivateJSON, sealedOriginUrl } from '../../../lib/privateStore.js';
import { openSeal, seal } from '../../../lib/seal.js';
import { deleteSubscriber, makeToken, saveSubscriber, subscriberByToken } from '../../../lib/subscribers.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const noStore = { 'cache-control': 'no-store' };

function safeMsg(error) {
  return String(error?.message || error?.name || 'Error')
    .replace(/bearer\s+\S+/gi, 'bearer [redacted]')
    .replace(/vercel_blob_\S+/gi, '[token]')
    .replace(/https?:\/\/\S+/gi, '[url]')
    .replace(/[\r\n]/g, ' ')
    .slice(0, 140);
}

function storeId() {
  return String(process.env.BLOB_READ_WRITE_TOKEN ?? '').split('_')[3] ?? '';
}

async function readText(response) {
  if (!response) return '';
  try { return await response.text(); } catch { return ''; }
}

async function sampleFetch(url, headers) {
  if (!url) return { status: 0, json: false, len: 0, etag: '', error: 'no-url' };
  try {
    const response = await fetch(url, {
      cache: 'no-store',
      redirect: 'manual',
      signal: AbortSignal.timeout(8_000),
      headers: { 'cache-control': 'no-cache', ...headers },
    });
    const text = response.status === 200 || response.status === 400 ? await readText(response) : '';
    let json = false;
    if (response.status === 200 && text) {
      try { json = JSON.parse(text)?.probe === 'blob-read'; } catch { json = false; }
    }
    return {
      status: response.status,
      json,
      len: response.status === 200 && text ? Buffer.byteLength(text) : 0,
      etag: response.headers.get('etag') || '',
      type: (response.headers.get('content-type') || '').split(';')[0].slice(0, 40),
      note: response.status === 400 ? safeMsg({ message: text }) : '',
    };
  } catch (error) {
    return { status: 0, json: false, len: 0, etag: 'absent', error: safeMsg(error) };
  }
}

async function sampleSdk(pathname, access, useCache) {
  try {
    const result = await get(pathname, {
      access,
      useCache,
      abortSignal: AbortSignal.timeout(8_000),
    });
    if (!result) return { status: 404, json: false };
    if (result.statusCode !== 200 || !result.stream) return { status: result.statusCode, json: false };
    const text = await readText(new Response(result.stream));
    let json = false;
    try { json = JSON.parse(text)?.probe === 'blob-read'; } catch { json = false; }
    const headEtag = result.blob?.etag || '';
    return {
      status: result.statusCode,
      json,
      len: Buffer.byteLength(text),
      size: result.blob?.size ?? null,
      sizeEq: typeof result.blob?.size === 'number' ? Buffer.byteLength(text) === result.blob.size : null,
      etag: headEtag ? 'present' : 'absent',
    };
  } catch (error) {
    return { status: 0, json: false, error: safeMsg(error) };
  }
}

function scrub(report) {
  const clone = JSON.parse(JSON.stringify(report));
  for (const read of Object.values(clone.reads || {})) {
    if (read && typeof read === 'object') delete read.etag;
  }
  return clone;
}

function recordFor(email, confirmToken, unsubToken) {
  return {
    email,
    status: 'pending',
    weekly: false,
    createdAt: new Date().toISOString(),
    confirmExpires: Date.now() + 3600_000,
    confirmToken,
    unsubToken,
    manageToken: makeToken(),
    resultId: 'ab'.repeat(12),
    snapshot: { brand: 'Probe', mentionedIn: 0, total: 1, score: 0, runs: 1, rows: [], topBrands: [], topSources: [] },
    answers: null,
    reportSentAt: null,
    confirmedAt: null,
  };
}

async function lookupShape(kind, token) {
  const index = openSeal(await getPrivateJSON(`mail/${kind}/${hashKey(token)}`, { retry: true }));
  if (!index) return { index: 'missing' };
  if (!index.version) return { index: 'no-version' };
  const record = openSeal(await getPrivateJSON(`mail/v/${index.version}`, { retry: true }));
  if (!record?.email) return { index: 'opened', version: 'missing' };
  return { index: 'opened', version: 'opened', tokenMatch: record[kind === 'confirm' ? 'confirmToken' : 'unsubToken'] === token };
}

export async function POST(req) {
  const phase = new URL(req.url).searchParams.get('phase') || '';
  if (phase === 'write' || phase === 'read') {
    if (phase === 'write') {
      const nonce = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
      const email = `probe-${nonce}@example.com`;
      const confirmToken = makeToken();
      const unsubToken = makeToken();
      await saveSubscriber(recordFor(email, confirmToken, unsubToken));
      await putPrivateJSON(`probe/session/${nonce}`, seal({ confirmToken, unsubToken, email }));
      const same = await subscriberByToken('confirm', confirmToken);
      const report = { phase, nonce, sameRequest: same?.email === email };
      console.error(`blob-probe ${JSON.stringify(report)}`);
      return Response.json(report, { headers: noStore });
    }
    let body = {};
    try { body = await req.json(); } catch { body = {}; }
    const nonce = String(body.nonce || '');
    if (!/^[a-z0-9]+$/.test(nonce)) return Response.json({ error: 'bad nonce' }, { status: 400, headers: noStore });
    const session = openSeal(await getPrivateJSON(`probe/session/${nonce}`, { retry: true }));
    if (!session?.confirmToken || !session.email) {
      return Response.json({ phase, session: false }, { headers: noStore });
    }
    const confirm = await subscriberByToken('confirm', session.confirmToken);
    const unsub = await subscriberByToken('unsub', session.unsubToken);
    const shape = {
      confirm: await lookupShape('confirm', session.confirmToken),
      unsub: await lookupShape('unsub', session.unsubToken),
    };
    await deleteSubscriber(confirm || session.email);
    const afterDelete = await subscriberByToken('unsub', session.unsubToken);
    const confirmToken2 = makeToken();
    const unsubToken2 = makeToken();
    await saveSubscriber(recordFor(session.email, confirmToken2, unsubToken2));
    const resubConfirm = await subscriberByToken('confirm', confirmToken2);
    const resubUnsub = await subscriberByToken('unsub', unsubToken2);
    await deleteSubscriber(session.email);
    await delPrivateKey(`probe/session/${nonce}`);
    const report = {
      phase,
      session: true,
      confirm: confirm?.email === session.email,
      unsub: unsub?.email === session.email,
      afterDelete: !afterDelete,
      resubConfirm: resubConfirm?.email === session.email,
      resubUnsub: resubUnsub?.email === session.email,
      shape,
    };
    console.error(`blob-probe ${JSON.stringify(report)}`);
    return Response.json(report, { headers: noStore });
  }
  if (phase === 'lookup') {
    let body = {};
    try { body = await req.json(); } catch { body = {}; }
    const kind = body.kind === 'unsub' ? 'unsub' : 'confirm';
    const token = String(body.token || '');
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
      return Response.json({ phase, tokenShape: false }, { headers: noStore });
    }
    const key = `mail/${kind}/${hashKey(token)}`;
    const pathname = `sealed/${key}.json`;
    let headFound = false;
    let headError = '';
    let meta = null;
    try {
      meta = await head(pathname, { abortSignal: AbortSignal.timeout(8_000) });
      headFound = Boolean(meta);
    } catch (error) {
      headError = safeMsg(error);
    }
    const authToken = process.env.BLOB_READ_WRITE_TOKEN ?? '';
    const auth = authToken ? { authorization: `Bearer ${authToken}` } : {};
    const origin = sealedOriginUrl(pathname);
    const privateCache0 = await sampleFetch(origin, auth);
    let privatePlain = { status: 0 };
    if (origin) {
      const plain = new URL(origin);
      plain.searchParams.delete('cache');
      privatePlain = await sampleFetch(plain, auth);
    }
    let publicStatus = 0;
    let publicLen = 0;
    if (meta?.url) {
      const pub = await sampleFetch(new URL(meta.url), auth);
      publicStatus = pub.status;
      publicLen = pub.len;
    }
    const index = openSeal(await getPrivateJSON(key, { retry: true }));
    const versionDiag = { hasVersion: typeof index?.version === 'string' };
    if (typeof index?.version === 'string') {
      versionDiag.versionShape = /^[A-Za-z0-9_-]{43}$/.test(index.version);
      versionDiag.versionLen = index.version.length;
      const versionPath = `sealed/mail/v/${index.version}.json`;
      try {
        const versionMeta = await head(versionPath, { abortSignal: AbortSignal.timeout(8_000) });
        versionDiag.headFound = true;
        versionDiag.size = versionMeta?.size ?? null;
      } catch (error) {
        versionDiag.headFound = false;
        versionDiag.headError = safeMsg(error);
      }
      const versionOrigin = sealedOriginUrl(versionPath);
      const versionPrivate = await sampleFetch(versionOrigin, auth);
      versionDiag.privateCache0 = versionPrivate.status;
      if (versionOrigin) {
        const plain = new URL(versionOrigin);
        plain.searchParams.delete('cache');
        const plainRead = await sampleFetch(plain, auth);
        versionDiag.privateNoCache = plainRead.status;
        versionDiag.privateLen = plainRead.len;
      }
      const raw = await getPrivateJSON(`mail/v/${index.version}`, { retry: false });
      versionDiag.raw = raw == null ? 'null' : (raw?.v === 1 ? 'seal' : typeof raw);
      const opened = openSeal(raw);
      versionDiag.opened = Boolean(opened?.email);
      versionDiag.deleted = Boolean(opened?.deleted);
    }
    const found = Boolean(await subscriberByToken(kind, token));
    const shape = await lookupShape(kind, token);
    const report = {
      phase,
      kind,
      tokenShape: true,
      headFound,
      headError,
      privateCache0: privateCache0.status,
      privateNoCache: privatePlain.status,
      privateLen: privatePlain.len,
      publicStatus,
      publicLen,
      found,
      shape,
      versionDiag,
    };
    console.error(`blob-probe ${JSON.stringify(report)}`);
    return Response.json(report, { headers: noStore });
  }

  const id = storeId();
  const nonce = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const key = `probe/${nonce}`;
  const pathname = `sealed/${key}.json`;
  const marker = { probe: 'blob-read', n: 1 };
  const body = JSON.stringify(marker);
  const report = {
    storeIdHintMatch: id === 'TSu0gnfQyEAU5KEM',
    storeIdLen: id.length,
    put: null,
    privatePut: null,
    head: null,
    reads: {},
    currentPath: null,
    overwrite: null,
  };

  try {
    const saved = await put(pathname, body, {
      access: 'public',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: 'application/json',
      cacheControlMaxAge: 60,
      abortSignal: AbortSignal.timeout(8_000),
    });
    report.put = 'ok';
    let meta = null;
    try {
      meta = await head(pathname, { abortSignal: AbortSignal.timeout(8_000) });
      const host = (() => { try { return new URL(meta.url).hostname; } catch { return ''; } })();
      report.head = {
        found: true,
        size: meta.size,
        sizeEq: meta.size === Buffer.byteLength(body),
        hostMatchesParsedId: host.startsWith(`${id}.`),
        hostIsPublic: host.endsWith('.public.blob.vercel-storage.com'),
        hostIsPrivate: host.endsWith('.private.blob.vercel-storage.com'),
      };
    } catch (error) {
      report.head = { found: false, error: safeMsg(error) };
    }

    const origin = sealedOriginUrl(pathname);
    const token = process.env.BLOB_READ_WRITE_TOKEN ?? '';
    const auth = token ? { authorization: `Bearer ${token}` } : {};
    report.reads.privateCache0 = await sampleFetch(origin, auth);
    if (origin) {
      const plain = new URL(origin);
      plain.searchParams.delete('cache');
      report.reads.privateNoCache = await sampleFetch(plain, auth);
    }
    if (meta?.url) {
      const pub = new URL(meta.url);
      report.reads.publicAuth = await sampleFetch(pub, auth);
      const bust = new URL(meta.url);
      bust.searchParams.set('t', nonce);
      report.reads.publicBust = await sampleFetch(bust, auth);
      const cache0 = new URL(meta.url);
      cache0.searchParams.set('cache', '0');
      report.reads.publicCache0 = await sampleFetch(cache0, auth);
      report.reads.publicNoAuth = await sampleFetch(pub, {});
      const headEtag = meta.etag || '';
      report.etagEq = {
        headPresent: Boolean(headEtag),
        publicAuth: Boolean(headEtag) && report.reads.publicAuth.etag === headEtag,
        publicBust: Boolean(headEtag) && report.reads.publicBust.etag === headEtag,
        privateNoCache: Boolean(headEtag) && report.reads.privateNoCache.etag === headEtag,
      };
    }
    report.reads.sdkPublic = await sampleSdk(pathname, 'public', true);
    report.reads.sdkPublicNoCache = await sampleSdk(pathname, 'public', false);
    report.reads.sdkPrivate = await sampleSdk(pathname, 'private', false);

    await putPrivateJSON(key, marker);
    const viaCurrent = await getPrivateJSON(key, { retry: true });
    report.currentPath = { found: viaCurrent?.probe === 'blob-read' };

    const next = JSON.stringify({ probe: 'blob-read', n: 2 });
    await put(pathname, next, {
      access: 'public',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: 'application/json',
      cacheControlMaxAge: 60,
      abortSignal: AbortSignal.timeout(8_000),
    });
    const after = meta?.url ? await sampleFetch(new URL(meta.url), auth) : { status: 0, json: false };
    let sawTwo = false;
    if (after.status === 200) {
      const again = await fetch(meta.url, {
        cache: 'no-store',
        signal: AbortSignal.timeout(8_000),
        headers: { ...auth, 'cache-control': 'no-cache' },
      });
      const text = again.status === 200 ? await again.text() : '';
      try { sawTwo = JSON.parse(text)?.n === 2; } catch { sawTwo = false; }
    }
    report.overwrite = { status: after.status, latest: sawTwo };
    if (saved?.url) report.putHostPublic = true;
  } catch (error) {
    report.put = report.put || 'error';
    report.error = safeMsg(error);
  }

  try {
    await put(`sealed/probe-private-${nonce}.json`, body, {
      access: 'private',
      addRandomSuffix: false,
      allowOverwrite: false,
      contentType: 'application/json',
      abortSignal: AbortSignal.timeout(8_000),
    });
    report.privatePut = 'ok';
    await del(`sealed/probe-private-${nonce}.json`, { abortSignal: AbortSignal.timeout(8_000) });
  } catch (error) {
    report.privatePut = safeMsg(error);
  }

  try {
    await del(pathname, { abortSignal: AbortSignal.timeout(8_000) });
    report.deleted = true;
  } catch (error) {
    report.deleted = false;
    report.deleteError = safeMsg(error);
  }

  const safe = scrub(report);
  console.error(`blob-probe ${JSON.stringify(safe)}`);
  return Response.json(safe, { headers: noStore });
}
