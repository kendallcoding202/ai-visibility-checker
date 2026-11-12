import { test } from 'node:test';
import assert from 'node:assert/strict';
import { POST as subscribe, confirmPost } from '../app/api/subscribe/route.js';
import { POST as unsubscribe } from '../app/api/unsubscribe/route.js';
import { hashKey } from './hash.js';
import {
  confirmIdempotencyKey, reportIdempotencyKey, resetMailerForTests, sendMail, setMailerForTests,
} from './mailer.js';
import { resetPrivateStoreForTests } from './privateStore.js';
import { resetStoreForTests, setJSON } from './store.js';
import { getSubscriber, saveSubscriber } from './subscribers.js';

const host = 'aivisibilitychecker.app';
const headers = {
  origin: `https://${host}`,
  host,
  'content-type': 'application/json',
};
const email = 'owner@example.com';

function req(path, body) {
  return new Request(`https://${host}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

// Same key + same body counts as one send. Same key + different body is the 409.
function resendLike() {
  const seen = new Map();
  const delivered = [];
  const attempts = [];
  const send = async (message) => {
    attempts.push(message);
    const payload = JSON.stringify({
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
      unsubUrl: message.unsubUrl,
    });
    const prev = seen.get(message.idempotencyKey);
    if (prev && prev !== payload) return { ok: false, reason: 'conflict' };
    if (!prev) {
      seen.set(message.idempotencyKey, payload);
      delivered.push(message);
    }
    return { ok: true };
  };
  return { send, delivered, attempts };
}

async function cacheResult(id, brand) {
  await setJSON(`cache/${id}`, {
    at: Date.now(),
    result: {
      brand,
      category: 'notes',
      mentionedIn: 1,
      total: 3,
      score: 40,
      runs: 1,
      rows: [{ prompt: `What are alternatives to ${brand}?`, mentioned: true, rank: 1, brands: [brand] }],
      topBrands: [],
      topSources: [],
      checkedAt: '2026-11-12T00:00:00.000Z',
    },
  });
}

function confirmTokenFrom(message) {
  const url = message.text.match(/https:\/\/aivisibilitychecker\.app\/email\/confirm\?token=\S+/)[0];
  return new URL(url).searchParams.get('token');
}

function confirms(delivered) {
  return delivered.filter((m) => m.subject === 'Confirm your AI visibility report');
}

function reports(delivered) {
  return delivered.filter((m) => m.subject.startsWith('AI visibility report for '));
}

async function assertOk(res) {
  const body = await res.clone().json();
  assert.equal(res.status, 200, body.error || JSON.stringify(body));
  return body;
}

test('same confirmation retried sends once and a new confirmation to the same address sends again', async () => {
  resetStoreForTests();
  resetPrivateStoreForTests();
  const mail = resendLike();
  setMailerForTests(mail.send);
  try {
    const sameId = 'a'.repeat(24);
    const otherId = 'b'.repeat(24);
    await cacheResult(sameId, 'Notion');
    await cacheResult(otherId, 'Acme');
    const signup = (id) => subscribe(req('/api/subscribe', {
      email, consent: true, id, elapsed: 1500, company: '',
    }));

    await assertOk(await signup(sameId));
    assert.equal(confirms(mail.delivered).length, 1);
    const firstConfirm = confirms(mail.delivered)[0];
    const token = confirmTokenFrom(firstConfirm);
    assert.equal(firstConfirm.idempotencyKey, confirmIdempotencyKey(token, email));
    assert.equal(firstConfirm.idempotencyKey.includes(email), false);
    assert.equal(firstConfirm.idempotencyKey.includes(token), false);
    assert.notEqual(firstConfirm.idempotencyKey, `confirm/${hashKey(email)}`);

    const replay = await sendMail(firstConfirm);
    assert.equal(replay.ok, true);
    assert.equal(confirms(mail.delivered).length, 1);
    assert.equal(mail.attempts.filter((m) => m.idempotencyKey === firstConfirm.idempotencyKey).length, 2);

    await assertOk(await confirmPost(req('/api/subscribe/confirm', { token })));
    assert.equal(reports(mail.delivered).length, 1);
    const reportKey = reports(mail.delivered)[0].idempotencyKey;
    assert.equal(reportKey, reportIdempotencyKey(token, email));
    assert.equal(reportKey.includes(email), false);
    assert.equal(reportKey.includes(token), false);
    assert.notEqual(reportKey, `report/${hashKey(email)}`);

    const stored = await getSubscriber(email);
    stored.reportSentAt = null;
    await saveSubscriber(stored);
    await assertOk(await confirmPost(req('/api/subscribe/confirm', { token })));
    assert.equal(reports(mail.delivered).length, 1);
    const reportAttempts = mail.attempts.filter((m) => m.subject.startsWith('AI visibility report for '));
    assert.equal(reportAttempts.length, 2);
    assert.equal(reportAttempts.every((m) => m.idempotencyKey === reportKey), true);

    const again = await assertOk(await confirmPost(req('/api/subscribe/confirm', { token })));
    assert.equal(again.message, 'This address is already confirmed.');
    assert.equal(reports(mail.delivered).length, 1);

    await assertOk(await unsubscribe(req('/api/unsubscribe', { token: stored.unsubToken })));

    // Same check, new confirmation: the unsubscribe link in the body changes.
    await assertOk(await signup(sameId));
    assert.equal(confirms(mail.delivered).length, 2);
    const secondConfirm = confirms(mail.delivered)[1];
    const token2 = confirmTokenFrom(secondConfirm);
    assert.notEqual(token2, token);
    assert.notEqual(secondConfirm.idempotencyKey, firstConfirm.idempotencyKey);
    assert.equal(secondConfirm.idempotencyKey, confirmIdempotencyKey(token2, email));

    await assertOk(await confirmPost(req('/api/subscribe/confirm', { token: token2 })));
    assert.equal(reports(mail.delivered).length, 2);
    const report2 = reports(mail.delivered)[1];
    assert.notEqual(report2.text, reports(mail.delivered)[0].text);
    assert.notEqual(report2.idempotencyKey, reportKey);
    assert.equal(report2.idempotencyKey, reportIdempotencyKey(token2, email));

    const stored2 = await getSubscriber(email);
    await assertOk(await unsubscribe(req('/api/unsubscribe', { token: stored2.unsubToken })));

    // New check, same address.
    await assertOk(await signup(otherId));
    assert.equal(confirms(mail.delivered).length, 3);
    const token3 = confirmTokenFrom(confirms(mail.delivered)[2]);
    await assertOk(await confirmPost(req('/api/subscribe/confirm', { token: token3 })));
    assert.equal(reports(mail.delivered).length, 3);
    const report3 = reports(mail.delivered)[2];
    assert.notEqual(report3.idempotencyKey, report2.idempotencyKey);
    assert.equal(report3.idempotencyKey, reportIdempotencyKey(token3, email));
    assert.equal(report3.text.includes('Acme'), true);
  } finally {
    resetMailerForTests();
  }
});
