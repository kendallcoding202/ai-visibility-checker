import { test } from 'node:test';
import assert from 'node:assert/strict';
import { POST as subscribe, confirmPost } from '../app/api/subscribe/route.js';
import { POST as unsubscribe } from '../app/api/unsubscribe/route.js';
import { GET as answers } from '../app/api/answers/route.js';
import { resetStoreForTests, setJSON } from './store.js';
import { getPrivateJSON, resetPrivateStoreForTests } from './privateStore.js';
import { resetMailerForTests, setMailerForTests } from './mailer.js';
import { answerCookie, newAnswerToken, saveRawAnswers } from './rawAnswers.js';
import { hashKey } from './hash.js';
import { normalizeEmail, originForMail, fromAddress } from './emailAddress.js';
import { confirmEmail, reportEmail } from './emailCopy.js';
import { publicResult } from './publicResult.js';
import { paidReportEnabled } from './paidReport.js';
import { openSeal, seal } from './seal.js';

const host = 'aivisibilitychecker.app';
const headers = {
  origin: `https://${host}`,
  host,
  'content-type': 'application/json',
};

function req(path, body, extra = {}) {
  return new Request(`https://${host}${path}`, {
    method: 'POST',
    headers: { ...headers, ...extra },
    body: JSON.stringify(body),
  });
}

test('email helpers reject header injection and foreign hosts', () => {
  assert.equal(normalizeEmail('owner@example.com'), 'owner@example.com');
  assert.equal(normalizeEmail('owner@example.com\nBcc: evil@example.com'), null);
  assert.equal(normalizeEmail('Owner <owner@example.com>'), null);
  assert.equal(originForMail('evil.example'), null);
  assert.equal(originForMail('aivisibilitychecker.app'), 'https://aivisibilitychecker.app');
  assert.equal(originForMail('ai-visibility-checker-git-preview.vercel.app'), 'https://ai-visibility-checker-git-preview.vercel.app');
  assert.equal(originForMail('not-the-checker.vercel.app'), null);
  const prev = process.env.RESEND_FROM;
  process.env.RESEND_FROM = 'AI Visibility Checker <reports@pathproof.dev>\nBcc: evil@example.com';
  assert.equal(fromAddress(), '');
  process.env.RESEND_FROM = 'AI Visibility Checker <reports@pathproof.dev>';
  assert.equal(fromAddress(), 'AI Visibility Checker <reports@pathproof.dev>');
  if (prev === undefined) delete process.env.RESEND_FROM;
  else process.env.RESEND_FROM = prev;
});

test('every email template contains an unsubscribe link and a safe subject', () => {
  const unsub = 'https://aivisibilitychecker.app/email/unsubscribe?token=abc';
  const confirm = confirmEmail({ confirmUrl: 'https://aivisibilitychecker.app/email/confirm?token=abc', unsubUrl: unsub });
  const report = reportEmail({
    snapshot: { brand: 'Notion\r\nBcc: x', category: '', mentionedIn: 1, total: 3, score: 40, runs: 1, rows: [{ prompt: 'Q', mentioned: true, rank: 2, brands: ['Notion'] }], topBrands: [], topSources: [] },
    answers: [{ prompt: 'Q', text: 'raw <script>' }],
    unsubUrl: unsub,
    trackerUrl: 'https://apify.com/crunchy_galaxy_qcr/ai-visibility-tracker',
  });
  for (const message of [confirm, report]) {
    assert.equal(message.text.includes(unsub), true);
    assert.equal(message.html.includes(unsub), true);
    assert.equal(/[\r\n]/.test(message.subject), false);
  }
  assert.equal(report.html.includes('<script>'), false);
  assert.equal(report.text.includes('$0.0375'), true);
});

test('public results omit raw answer text and the paid report flag defaults off', () => {
  const out = publicResult({
    brand: 'Notion', runs: 1, rows: [{ prompt: 'Q', excerpt: 'secret excerpt', text: 'secret text', brands: [] }],
    answers: [{ text: 'nope' }],
  }, { id: 'a'.repeat(24), cached: false });
  const serialized = JSON.stringify(out);
  assert.equal(serialized.includes('secret'), false);
  assert.equal(serialized.includes('nope'), false);
  assert.equal(out.runs, 1);
  const prev = process.env.PAID_REPORT_ENABLED;
  delete process.env.PAID_REPORT_ENABLED;
  assert.equal(paidReportEnabled(), false);
  if (prev === undefined) delete process.env.PAID_REPORT_ENABLED;
  else process.env.PAID_REPORT_ENABLED = prev;
});

test('seal round trip hides the address', () => {
  const sealed = seal({ email: 'owner@example.com' });
  assert.equal(JSON.stringify(sealed).includes('owner@example.com'), false);
  assert.equal(openSeal(sealed).email, 'owner@example.com');
  assert.equal(openSeal({ v: 1, iv: 'bad', tag: 'bad', data: 'bad' }), null);
});

test('subscribe confirms, emails only that check\'s raw answers, and unsubscribe deletes the address', async () => {
  resetStoreForTests();
  resetPrivateStoreForTests();
  const sent = [];
  setMailerForTests(async (message) => { sent.push(message); return { ok: true }; });
  const id = 'ab'.repeat(12);
  const secret = 'SECRET-ANSWER-ONLY-FOR-RUNNER';
  await setJSON(`cache/${id}`, {
    at: Date.now(),
    result: {
      brand: 'Notion', category: '', mentionedIn: 1, total: 3, score: 40, runs: 1,
      rows: [{ prompt: 'What are alternatives to Notion?', mentioned: true, rank: 1, brands: ['Notion'] }],
      topBrands: [], topSources: [], checkedAt: new Date().toISOString(),
    },
  });
  const token = newAnswerToken();
  await saveRawAnswers(token, { shareId: id, runs: 1, answers: [{ prompt: 'Q', text: secret }] });
  const other = await answers(new Request(`https://${host}/api/answers?id=${id}`));
  assert.equal(other.status, 404);
  const own = await answers(new Request(`https://${host}/api/answers?id=${id}`, { headers: { cookie: answerCookie(id, token) } }));
  assert.equal(own.status, 200);
  assert.equal((await own.json()).answers[0].text, secret);
  const wrong = await answers(new Request(`https://${host}/api/answers?id=${'c'.repeat(24)}`, { headers: { cookie: answerCookie(id, token) } }));
  assert.equal(wrong.status, 404);

  const first = await subscribe(req('/api/subscribe', {
    email: 'owner@example.com', consent: true, id, elapsed: 1500, company: '',
  }, { cookie: answerCookie(id, token) }));
  assert.equal(first.status, 200);
  const stored = await getPrivateJSON(`mail/addr/${hashKey('owner@example.com')}`);
  assert.equal(JSON.stringify(stored).includes('owner@example.com'), false);

  const second = await subscribe(req('/api/subscribe', {
    email: 'other@example.com', consent: true, id, elapsed: 1500, company: '',
  }));
  assert.equal(second.status, 200);
  const noConsent = await subscribe(req('/api/subscribe', { email: 'third@example.com', consent: false, id, elapsed: 1500 }));
  assert.equal(noConsent.status, 400);
  const injected = await subscribe(req('/api/subscribe', { email: 'a@b.com\nBcc: x@y.z', consent: true, id, elapsed: 1500 }));
  assert.equal(injected.status, 400);
  assert.equal(sent.length, 2);

  const confirmToken = new URL(sent[0].text.match(/https:\/\/aivisibilitychecker\.app\/email\/confirm\?token=([^\s]+)/)[0]).searchParams.get('token');
  const confirmed = await confirmPost(req('/api/subscribe/confirm', { token: confirmToken }));
  assert.equal(confirmed.status, 200);
  const report = sent.find((m) => m.subject.startsWith('AI visibility report'));
  assert.equal(report.text.includes(secret), true);
  assert.equal(report.text.includes('Unsubscribe:'), true);
  assert.equal(/[\r\n]/.test(report.subject), false);

  const otherToken = new URL(sent[1].text.match(/https:\/\/aivisibilitychecker\.app\/email\/confirm\?token=([^\s]+)/)[0]).searchParams.get('token');
  const otherConfirmed = await confirmPost(req('/api/subscribe/confirm', { token: otherToken }));
  assert.equal(otherConfirmed.status, 200);
  const otherReport = sent.filter((m) => m.to === 'other@example.com' && m.subject.startsWith('AI visibility report'))[0];
  assert.equal(otherReport.text.includes(secret), false);

  const unsubUrl = report.text.match(/https:\/\/aivisibilitychecker\.app\/email\/unsubscribe\?token=([^\s]+)/)[0];
  const unsubToken = new URL(unsubUrl).searchParams.get('token');
  const removed = await unsubscribe(req(`/api/unsubscribe?token=${encodeURIComponent(unsubToken)}`, { token: unsubToken }));
  assert.equal(removed.status, 200);
  const again = await unsubscribe(req('/api/unsubscribe', { token: unsubToken }));
  assert.equal(again.status, 400);
  const sealedGone = await getPrivateJSON(`mail/addr/${hashKey('owner@example.com')}`);
  assert.equal(JSON.stringify(sealedGone).includes('owner@example.com'), false);
  resetMailerForTests();
});
