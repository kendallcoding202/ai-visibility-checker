// Raw answers for the browser that ran the check.
// The token is an httpOnly cookie. It is not returned in JSON and not logged.
import { randomBytes } from 'node:crypto';
import { hashKey } from './hash.js';
import { openSeal, seal } from './seal.js';
import { getPrivateJSON, putPrivateJSON } from './privateStore.js';

const TOKEN = /^[A-Za-z0-9_-]{43}$/;
const DAY = 24 * 3600;

export function newAnswerToken() {
  return randomBytes(32).toString('base64url');
}

export function answerCookie(shareId, token) {
  return `avc_raw=${shareId}.${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${DAY}`;
}

export function readAnswerCookie(header) {
  const part = String(header ?? '').split(';').map((s) => s.trim()).find((s) => s.startsWith('avc_raw='));
  if (!part) return null;
  const value = part.slice('avc_raw='.length);
  const dot = value.indexOf('.');
  if (dot !== 24) return null;
  const shareId = value.slice(0, dot);
  const token = value.slice(dot + 1);
  if (!/^[a-f0-9]{24}$/.test(shareId) || !TOKEN.test(token)) return null;
  return { shareId, token };
}

export async function saveRawAnswers(token, { shareId, runs, answers }) {
  const clean = (answers ?? []).slice(0, 6).map((a) => ({
    prompt: String(a.prompt ?? '').slice(0, 300),
    text: String(a.text ?? '').slice(0, 12000),
  }));
  await putPrivateJSON(`raw/${hashKey(token)}`, seal({
    shareId,
    runs: Number(runs) > 0 ? Number(runs) : 1,
    answers: clean,
    exp: Date.now() + DAY * 1000,
  }));
}

export async function loadRawAnswers(token) {
  if (!TOKEN.test(token)) return null;
  const opened = openSeal(await getPrivateJSON(`raw/${hashKey(token)}`));
  if (!opened || !opened.exp || opened.exp < Date.now()) return null;
  return opened;
}
