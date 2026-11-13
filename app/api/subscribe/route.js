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
import { validCustomerId, validSubscriptionId } from '../../../lib/stripeApi.js';
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
const SUCCESS_MESSAGE = 'Check your inbox for a confirmation email. The report is sent after you confirm.';

const noStore = { 'cache-control': 'no-store' };
const bad = (msg, status = 400) => Response.json({ error: msg }, { status, headers: noStore });
const okMessage = (message) => Response.json({ ok: true, message }, { headers: noStore });

// Paid and formerly paid records. Re-signup must not rebuild these.
function keepsBilling(record) {
  if (!record || typeof record !== 'object') return false;
  if (record.trackingActive === true) return true;
  if (validCustomerId(record.stripeCustomerId)) return true;
  if (validSubscriptionId(record.stripeSubscriptionId)) return true;
  if (typeof record.trackingBrand === 'string' && record.trackingBrand.trim()) return true;
  if (Number(record.billingEventCount) > 0) return true;
  if (Number(record.trackingRunCount) > 0) return true;
  return false;
}

function isConfirmed(record) {
  return record?.status === 'confirmed' || Boolean(record?.reportSentAt);
}

async function answersFor(req, id) {
  const cookie = readAnswerCookie(req.headers.get('cookie'));
  if (!cookie || cookie.shareId !== id) return null;
  const raw = await loadRawAnswers(cookie.token);
  if (!raw || raw.shareId !== id || !Array.isArray(raw.answers)) return null;
  return raw.answers;
}

function pendingReportFor(record, token) {
  const pending = record?.pendingReport;
  if (!pending || typeof pending !== 'object') return null;
  if (pending.confirmToken !== token || record.confirmToken !== token) return null;
  if (!pending.snapshot || typeof pending.snapshot !== 'object') return null;
  return pending;
}

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
  // Same response as a new signup. Do not reveal whether this address is paid.
  if (existing && (existing.email !== email || keepsBilling(existing))) {
    await refund(sendSlot);
    return okMessage(SUCCESS_MESSAGE);
  }

  const confirmToken = makeToken();
  const answers = await answersFor(req, id);
  const now = Date.now();
  const prior = existing ? JSON.parse(JSON.stringify(existing)) : null;
  let record;
  if (existing && isConfirmed(existing)) {
    // Stay confirmed, and keep the address, report, and control links, until
    // this confirm token is opened. The new check is only a pending report.
    record = {
      ...existing,
      email: existing.email,
      confirmToken,
      confirmExpires: now + CONFIRM_MS,
      pendingReport: {
        confirmToken,
        confirmExpires: now + CONFIRM_MS,
        resultId: id,
        snapshot: reportSnapshot(cached.result),
        answers,
      },
    };
  } else {
    // New pathname every signup. Reusing the previous unsub token overwrites the
    // deleted object, and the CDN can keep serving that deletion.
    record = {
      email,
      status: 'pending',
      weekly: true,
      createdAt: new Date().toISOString(),
      confirmExpires: now + CONFIRM_MS,
      confirmToken,
      unsubToken: makeToken(),
      manageToken: existing?.manageToken || makeToken(),
      resultId: id,
      snapshot: reportSnapshot(cached.result),
      answers,
      reportSentAt: null,
      confirmedAt: null,
    };
  }
  await saveSubscriber(record);

  const confirmUrl = `${origin}/email/confirm?token=${encodeURIComponent(record.confirmToken)}`;
  const unsubPage = `${origin}/email/unsubscribe?token=${encodeURIComponent(record.unsubToken)}`;
  const unsubApi = `${origin}/api/unsubscribe?token=${encodeURIComponent(record.unsubToken)}`;
  const message = confirmEmail({ confirmUrl, unsubUrl: unsubPage });
  const sent = await sendMail({
    to: record.email,
    subject: message.subject,
    text: message.text,
    html: message.html,
    unsubUrl: unsubApi,
    idempotencyKey: confirmIdempotencyKey(record.confirmToken, record.email),
  });
  if (!sent.ok) {
    await refund(ipSlot);
    await refund(emailSlot);
    await refund(sendSlot);
    if (prior) await saveSubscriber(prior);
    else await deleteSubscriber(email);
    void trackEvent(track, EVENTS.EMAIL_CAPTURE, { outcome: sent.reason === 'unconfigured' ? 'unavailable' : 'error' });
    const status = sent.reason === 'unconfigured' ? 503 : 502;
    return bad(status === 503 ? 'Email is temporarily unavailable. Please try again later.' : 'The confirmation email could not be sent. Please try again.', status);
  }
  void trackEvent(track, EVENTS.EMAIL_CAPTURE, { outcome: 'ok' });
  return okMessage(SUCCESS_MESSAGE);
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
  const pending = pendingReportFor(record, token);
  const hasPending = Boolean(record.pendingReport && typeof record.pendingReport === 'object');
  if (!record.reportSentAt && !hasPending && record.confirmExpires && record.confirmExpires < Date.now()) {
    if (!keepsBilling(record)) await deleteSubscriber(record.email);
    return bad('This confirmation link is not valid or it has expired.');
  }
  if (!sameOrigin(req)) return bad('Forbidden', 403);
  const origin = originForMail(req.headers.get('host'));
  if (!origin) return bad('Email is not available from this host.', 400);
  const unsubPage = `${origin}/email/unsubscribe?token=${encodeURIComponent(record.unsubToken)}`;
  const unsubApi = `${origin}/api/unsubscribe?token=${encodeURIComponent(record.unsubToken)}`;
  if (pending) {
    if (!(Number(pending.confirmExpires) > Date.now())) {
      delete record.pendingReport;
      await saveSubscriber(record);
      return bad('This confirmation link is not valid or it has expired.');
    }
    // A billing record never takes a new snapshot or a new recipient from this link.
    if (keepsBilling(record)) {
      delete record.pendingReport;
      await saveSubscriber(record);
      return okMessage('This address is already confirmed.');
    }
    const message = reportEmail({
      snapshot: pending.snapshot,
      answers: pending.answers,
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
    const at = new Date().toISOString();
    record.snapshot = reportSnapshot(pending.snapshot);
    record.answers = Array.isArray(pending.answers) ? pending.answers : null;
    if (/^[a-f0-9]{24}$/.test(pending.resultId)) record.resultId = pending.resultId;
    record.status = 'confirmed';
    record.reportSentAt = at;
    record.confirmedAt = record.confirmedAt || at;
    delete record.pendingReport;
    await saveSubscriber(record);
    return okMessage('Confirmed. The report is on its way.');
  }
  if (record.reportSentAt) {
    return okMessage('This address is already confirmed.');
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
  return okMessage('Confirmed. The report is on its way.');
}
