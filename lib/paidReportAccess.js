// Capability for one paid report. The token is created for the buyer and is not
// derived from the public result id. Lookup uses a salted hash of the token.
import { randomBytes } from 'node:crypto';
import { originForMail } from './emailAddress.js';
import { hashKey } from './hash.js';
import { mutateJSON, readJSON, setJSON } from './store.js';

export const REPORT_TOKEN = /^[A-Za-z0-9_-]{43}$/;
const SESSION_ID = /^cs_[A-Za-z0-9_]{4,120}$/;
const RESULT_ID = /^[a-f0-9]{24}$/;
const PRODUCTION_ORIGIN = 'https://aivisibilitychecker.app';

export function isReportToken(value) {
  return REPORT_TOKEN.test(String(value ?? ''));
}

export function newReportToken() {
  return randomBytes(32).toString('base64url');
}

export function reportAccessKey(token) {
  return `paid-report-pdf/${hashKey(token)}`;
}

export function reportPageUrl(origin, token) {
  if (!isReportToken(token)) return '';
  let host = '';
  try { host = new URL(String(origin ?? '')).host; } catch { host = ''; }
  const base = originForMail(host) || PRODUCTION_ORIGIN;
  const url = new URL('/paid-report', base);
  url.searchParams.set('token', token);
  return url.toString();
}

export async function saveReportAccess({ token, sessionId, resultId }) {
  if (!isReportToken(token) || !SESSION_ID.test(String(sessionId ?? '')) || !RESULT_ID.test(String(resultId ?? ''))) {
    return false;
  }
  await setJSON(reportAccessKey(token), { sessionId, resultId });
  return true;
}

/**
 * Stable download token for this Stripe session. A retry reuses the token already
 * stored on the snapshot so the emailed link does not change.
 */
export async function ensureReportDownload({ sessionId, resultId, fallback } = {}) {
  if (!SESSION_ID.test(String(sessionId ?? '')) || !RESULT_ID.test(String(resultId ?? ''))) return '';
  const key = `paid-report-snapshot/${sessionId}`;
  const mutated = await mutateJSON(key, (current) => {
    const existing = current && typeof current === 'object' && current.result ? current : null;
    if (!existing && !fallback?.result) return { abort: true };
    const source = existing || {
      result: fallback.result,
      answers: fallback.answers ?? null,
      origin: typeof fallback.origin === 'string' ? fallback.origin : '',
    };
    if (source.resultId && source.resultId !== resultId) return { deny: 'mismatch' };
    const token = isReportToken(source.pdfToken) ? source.pdfToken : newReportToken();
    return { value: { ...source, resultId, pdfToken: token } };
  });
  if (!mutated.ok || !isReportToken(mutated.value?.pdfToken)) return '';
  const saved = await saveReportAccess({ token: mutated.value.pdfToken, sessionId, resultId });
  return saved ? mutated.value.pdfToken : '';
}

export async function loadPaidReport(token) {
  if (!isReportToken(token)) return null;
  const index = await readJSON(reportAccessKey(token));
  if (!index.ok || !index.value || typeof index.value !== 'object') return null;
  const sessionId = String(index.value.sessionId ?? '');
  const resultId = String(index.value.resultId ?? '');
  if (!SESSION_ID.test(sessionId) || !RESULT_ID.test(resultId)) return null;
  const snap = await readJSON(`paid-report-snapshot/${sessionId}`);
  if (!snap.ok || !snap.value || typeof snap.value !== 'object') return null;
  if (snap.value.pdfToken !== token) return null;
  if (snap.value.resultId !== resultId) return null;
  if (!snap.value.result || typeof snap.value.result !== 'object') return null;
  return {
    resultId,
    result: snap.value.result,
    answers: Array.isArray(snap.value.answers) ? snap.value.answers : [],
  };
}
