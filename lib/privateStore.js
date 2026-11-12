// Private JSON for email records and raw answers.
// Production uses Vercel Blob access: 'private'. Local tests use memory.
// Callers seal secrets before writing. This module does not log values.
import { get, put } from '@vercel/blob';
import { isMissingBlob } from './store.js';

const mem = new Map();
const hasBlob = () => !!process.env.BLOB_READ_WRITE_TOKEN;

export function resetPrivateStoreForTests() {
  mem.clear();
}

function timeout() {
  return AbortSignal.timeout(8_000);
}

export async function putPrivateJSON(key, value) {
  const body = JSON.stringify(value);
  if (!hasBlob()) {
    mem.set(key, body);
    return;
  }
  await put(`private/${key}.json`, body, {
    access: 'private',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json',
    abortSignal: timeout(),
  });
}

export async function getPrivateJSON(key) {
  if (!hasBlob()) {
    const raw = mem.get(key);
    return raw ? JSON.parse(raw) : null;
  }
  try {
    const result = await get(`private/${key}.json`, { access: 'private', useCache: false, abortSignal: timeout() });
    if (!result || result.statusCode === 304 || !result.stream) return null;
    const text = await new Response(result.stream).text();
    if (!text) return null;
    return JSON.parse(text);
  } catch (error) {
    if (isMissingBlob(error)) return null;
    const name = error?.name || 'Error';
    console.error(`private read failed name=${name}`);
    return null;
  }
}
