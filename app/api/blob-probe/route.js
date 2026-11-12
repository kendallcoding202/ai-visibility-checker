// Temporary diagnosis against the connected Blob store. Returns status codes
// and booleans only. No tokens, URLs, pathnames, or bodies. Removed before the fix lands.
import { del, get, head, put } from '@vercel/blob';
import { getPrivateJSON, putPrivateJSON, sealedOriginUrl } from '../../../lib/privateStore.js';

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
    const text = response.status === 200 ? await readText(response) : '';
    let json = false;
    if (text) {
      try { json = JSON.parse(text)?.probe === 'blob-read'; } catch { json = false; }
    }
    return {
      status: response.status,
      json,
      len: text ? Buffer.byteLength(text) : 0,
      etag: response.headers.get('etag') ? 'present' : 'absent',
      type: (response.headers.get('content-type') || '').split(';')[0].slice(0, 40),
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

export async function POST() {
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
      report.etag = {
        head: meta.etag ? 'present' : 'absent',
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

  console.error(`blob-probe ${JSON.stringify(report)}`);
  return Response.json(report, { headers: noStore });
}
