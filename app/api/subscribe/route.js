import { track } from '@vercel/analytics/server';
import { EVENTS, trackEvent } from '../../../lib/analyticsEvents.js';
import { normalizeEmail, originForMail } from '../../../lib/emailAddress.js';
import { confirmEmail, reportEmail } from '../../../lib/emailCopy.js';
import { assertHashSalt, hashKey, HashSaltError } from '../../../lib/hash.js';
import { confirmIdempotencyKey, reportIdempotencyKey, sendMail } from '../../../lib/mailer.js';
import { reportSnapshot } from '../../../lib/publicResult.js';
import { getJSON, readJSON, setJSON } from '../../../lib/store.js';
import { readAnswerCookie, loadRawAnswers } from '../../../lib/rawAnswers.js';
import { sameOrigin, clientIp } from '../../../lib/sameOrigin.js';
import { TRACKER } from '../../links.js';
import {
  deleteSubscriber, getSubscriber, makeToken, markReportSent, saveSubscriber, subscriberByToken,
} from '../../../lib/subscribers.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const IP_DAILY = 5;
const EMAIL_DAILY = 3;
const SEND_DAILY = 30;
const CONFIRM_MS = 48 * 3600 * 1000;

const noStore = { 'cache-control': 'no-store' };
const bad = (msg, status = 400) => Response.json({ error: msg }, { status, headers: noStore });

async function bump(key, limit) {
  const read = await readJSON(key);
  if (!read.ok) return { ok: false, status: 503 };
  const n = read.value?.n ?? 0;
  if (n >= limit) return { ok: false, status: 429 };
  await setJSON(key, { n: n + 1 });
  return { ok: true, key, prev: n };
}

async function refund(slot) {
  if (!slot?.ok) return;
  const read = await readJSON(slot.key);
  if (!read.ok) return;
  await setJSON(slot.key, { n: Math.max(0, (read.value?.n ?? 1) - 1) });
}

function dayKey() {
  return new Date().toISOString().slice(0, 10);
}

export async function POST(req) {
  try {
    assertHashSalt();
  } catch (e) {
    if (e instanceof HashSaltError) return bad('Email is temporarily unavailable. Please try again later.', 503);
    throw e;
  }
  if (!sameOrigin(req)) return bad('Forbidden', 403);
  const origin = originForMail(req.headers.get('host'));
  if (!origin) return bad('Email is not available from this host.', 400);

  let body;
  try { body = await req.json(); } catch { return bad('Bad request'); }
  if (body.company) return bad('Forbidden', 403);
  if (body.consent !== true) return bad('Check the box to agree to the email.');
  if (!(Number(body.elapsed) >= 1000)) return bad('Please try again.');

  const email = normalizeEmail(body.email);
  if (!email) {
    void trackEvent(track, EVENTS.EMAIL_CAPTURE, { outcome: 'invalid' });
    return bad('Enter a valid email address.');
  }
  const id = String(body.id ?? '');
  if (!/^[a-f0-9]{24}$/.test(id)) return bad('Run a check first, then ask for the email.');

  const cached = await getJSON(`cache/${id}`);
  if (!cached?.result) return bad('That check is no longer available. Run it again.');

  const day = dayKey();
  const ipSlot = await bump(`signup-ip/${day}/${hashKey(clientIp(req))}`, IP_DAILY);
  if (!ipSlot.ok) {
    void trackEvent(track, EVENTS.EMAIL_CAPTURE, { outcome: ipSlot.status === 429 ? 'limited' : 'unavailable' });
    return bad(ipSlot.status === 429 ? 'Too many email requests. Try again tomorrow.' : 'Email is temporarily unavailable. Please try again later.', ipSlot.status);
  }
  const emailSlot = await bump(`signup-email/${day}/${hashKey(email)}`, EMAIL_DAILY);
  if (!emailSlot.ok) {
    await refund(ipSlot);
    void trackEvent(track, EVENTS.EMAIL_CAPTURE, { outcome: emailSlot.status === 429 ? 'limited' : 'unavailable' });
    return bad(emailSlot.status === 429 ? 'Too many email requests. Try again tomorrow.' : 'Email is temporarily unavailable. Please try again later.', emailSlot.status);
  }
  const sendSlot = await bump(`signup-send/${day}`, SEND_DAILY);
  if (!sendSlot.ok) {
    await refund(ipSlot);
    await refund(emailSlot);
    void trackEvent(track, EVENTS.EMAIL_CAPTURE, { outcome: sendSlot.status === 429 ? 'limited' : 'unavailable' });
    return bad(sendSlot.status === 429 ? 'Too many email requests. Try again tomorrow.' : 'Email is temporarily unavailable. Please try again later.', sendSlot.status);
  }

  const existing = await getSubscriber(email);
  const confirmToken = makeToken();
  // New pathname every signup. Reusing the previous unsub token overwrites the
  // deleted object, and the CDN can keep serving that deletion.
  const unsubToken = makeToken();
  const manageToken = existing?.manageToken || makeToken();
  const cookie = readAnswerCookie(req.headers.get('cookie'));
  let answers = null;
  if (cookie && cookie.shareId === id) {
    const raw = await loadRawAnswers(cookie.token);
    if (raw && raw.shareId === id) answers = raw.answers;
  }
  const record = {
    email,
    status: 'pending',
    weekly: true,
    createdAt: new Date().toISOString(),
    confirmExpires: Date.now() + CONFIRM_MS,
    confirmToken,
    unsubToken,
    manageToken,
    resultId: id,
    snapshot: reportSnapshot(cached.result),
    answers,
    reportSentAt: null,
    confirmedAt: null,
  };
  await saveSubscriber(record);

  const confirmUrl = `${origin}/email/confirm?token=${encodeURIComponent(confirmToken)}`;
  const unsubPage = `${origin}/email/unsubscribe?token=${encodeURIComponent(unsubToken)}`;
  const unsubApi = `${origin}/api/unsubscribe?token=${encodeURIComponent(unsubToken)}`;
  const message = confirmEmail({ confirmUrl, unsubUrl: unsubPage });
  const sent = await sendMail({
    to: email,
    subject: message.subject,
    text: message.text,
    html: message.html,
    unsubUrl: unsubApi,
    idempotencyKey: confirmIdempotencyKey(confirmToken, email),
  });
  if (!sent.ok) {
    await refund(ipSlot);
    await refund(emailSlot);
    await refund(sendSlot);
    if (!existing) await deleteSubscriber(email);
    void trackEvent(track, EVENTS.EMAIL_CAPTURE, { outcome: sent.reason === 'unconfigured' ? 'unavailable' : 'error' });
    const status = sent.reason === 'unconfigured' ? 503 : 502;
    return bad(status === 503 ? 'Email is temporarily unavailable. Please try again later.' : 'The confirmation email could not be sent. Please try again.', status);
  }
  void trackEvent(track, EVENTS.EMAIL_CAPTURE, { outcome: 'ok' });
  return Response.json({ ok: true, message: 'Check your inbox for a confirmation email. The report is sent after you confirm.' }, { headers: noStore });
}

export async function confirmPost(req) {
  try {
    assertHashSalt();
  } catch (e) {
    if (e instanceof HashSaltError) return bad('Email is temporarily unavailable. Please try again later.', 503);
    throw e;
  }
  let body;
  try { body = await req.json(); } catch { return bad('Bad request'); }
  const token = String(body.token ?? '');
  const record = await subscriberByToken('confirm', token);
  if (!record) return bad('This confirmation link is not valid or it has expired.');
  if (record.confirmExpires && record.confirmExpires < Date.now() && !record.reportSentAt) {
    await deleteSubscriber(record.email);
    return bad('This confirmation link is not valid or it has expired.');
  }
  if (!sameOrigin(req)) return bad('Forbidden', 403);
  const origin = originForMail(req.headers.get('host'));
  if (!origin) return bad('Email is not available from this host.', 400);
  const unsubPage = `${origin}/email/unsubscribe?token=${encodeURIComponent(record.unsubToken)}`;
  const unsubApi = `${origin}/api/unsubscribe?token=${encodeURIComponent(record.unsubToken)}`;
  if (record.reportSentAt) {
    return Response.json({ ok: true, message: 'This address is already confirmed.' }, { headers: noStore });
  }
  const message = reportEmail({
    snapshot: record.snapshot,
    answers: record.answers,
    unsubUrl: unsubPage,
    trackerUrl: TRACKER('report-email'),
  });
  const sent = await sendMail({
    to: record.email,
    subject: message.subject,
    text: message.text,
    html: message.html,
    unsubUrl: unsubApi,
    idempotencyKey: reportIdempotencyKey(record.confirmToken, record.email),
  });
  if (!sent.ok) return bad('Confirmed, but the report email could not be sent. Open the confirmation link again.', 502);
  await markReportSent(record, new Date().toISOString());
  return Response.json({ ok: true, message: 'Confirmed. The report is on its way.' }, { headers: noStore });
}
