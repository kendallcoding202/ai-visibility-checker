import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { POST as checkout } from '../app/api/checkout/route.js';
import { POST as subscribe, confirmPost } from '../app/api/subscribe/route.js';
import { GET as portalGet } from '../app/api/tracking/portal/route.js';
import { hashKey } from './hash.js';
import { resetMailerForTests, setMailerForTests } from './mailer.js';
import { resetPrivateStoreForTests } from './privateStore.js';
import { resetStoreForTests, setJSON } from './store.js';
import { resetStripeForTests, setStripeForTests } from './stripeApi.js';
import { getSubscriber, makeToken, saveSubscriber, subscriberByToken } from './subscribers.js';
import { applyStripeEvent } from './trackingEvents.js';
import { runTrackingCron } from './trackingCron.js';
import { activateTracking, deactivateTracking, listTrackingIds } from './trackingRecords.js';

const host = 'aivisibilitychecker.app';
const owner = 'owner@example.com';
const other = 'other@example.com';
const attacker = 'attacker@evil.example';
const NOTION = 'ab'.repeat(12);
const ACME = 'cd'.repeat(12);
const BETA = 'ef'.repeat(12);
const CRON = 'cron-secret-test-value';
const STRIPE_KEY = 'sk_test_tracking_secret_value';
const PRICE = 'price_testtracking';

function req(path, body, extra = {}) {
  return new Request(`https://${host}${path}`, {
    method: 'POST',
    headers: {
      origin: `https://${host}`,
      host,
      'content-type': 'application/json',
      'x-forwarded-for': '203.0.113.10',
      ...extra,
    },
    body: JSON.stringify(body),
  });
}

function subscribeBody(email, id, extra = {}) {
  return {
    email,
    consent: true,
    id,
    elapsed: 1500,
    company: '',
    recipient: attacker,
    to: attacker,
    notifyEmail: attacker,
    ...extra,
  };
}

async function cache(id, brand) {
  await setJSON(`cache/${id}`, {
    at: Date.now(),
    result: {
      brand,
      category: 'docs',
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

function baseRecord(email, brand) {
  return {
    email,
    status: 'confirmed',
    weekly: true,
    createdAt: '2026-11-12T00:00:00.000Z',
    confirmExpires: Date.now() + 86_000_000,
    confirmToken: makeToken(),
    unsubToken: makeToken(),
    manageToken: makeToken(),
    resultId: NOTION,
    snapshot: {
      brand,
      category: 'docs',
      mentionedIn: 1,
      total: 3,
      score: 40,
      avgRank: 1,
      runs: 1,
      rows: [{ prompt: 'What are the best docs tools?', mentioned: true, rank: 1, brands: [brand] }],
      topBrands: [],
      topSources: [],
      checkedAt: '2026-11-12T00:00:00.000Z',
    },
    answers: [{ prompt: 'Q', text: 'owner-only-answer' }],
    reportSentAt: '2026-11-12T00:00:00.000Z',
    confirmedAt: '2026-11-12T00:00:00.000Z',
  };
}

function confirmTokenFrom(message) {
  const url = message.text.match(/https:\/\/aivisibilitychecker\.app\/email\/confirm\?token=\S+/)[0];
  return new URL(url).searchParams.get('token');
}

function unsubTokenFrom(message) {
  const url = message.text.match(/https:\/\/aivisibilitychecker\.app\/email\/unsubscribe\?token=\S+/)[0];
  return new URL(url).searchParams.get('token');
}

function silence() {
  const logs = [];
  const prevLog = console.log;
  const prevErr = console.error;
  console.log = (...args) => { logs.push(args.join(' ')); };
  console.error = (...args) => { logs.push(args.join(' ')); };
  return { logs, restore() { console.log = prevLog; console.error = prevErr; } };
}

describe('re-signup keeps confirmed subscriber state', { concurrency: false }, () => {
  let sent;

  test.beforeEach(() => {
    resetStoreForTests();
    resetPrivateStoreForTests();
    resetMailerForTests();
    resetStripeForTests();
    sent = [];
    setMailerForTests(async (message) => {
      sent.push(message);
      return { ok: true };
    });
  });

  test.afterEach(() => {
    resetMailerForTests();
    resetStripeForTests();
  });

  test('a confirmed free re-signup stays confirmed until the owner opens the new link', async () => {
    await cache(NOTION, 'Notion');
    await cache(ACME, 'Acme');
    await cache(BETA, 'Beta');
    const ownerRecord = baseRecord(owner, 'Notion');
    const otherRecord = baseRecord(other, 'Other');
    await saveSubscriber(ownerRecord);
    await saveSubscriber(otherRecord);
    const unsubBefore = ownerRecord.unsubToken;
    const manageBefore = ownerRecord.manageToken;

    const staged = await subscribe(req('/api/subscribe', subscribeBody(owner, ACME)));
    const stagedBody = await staged.json();
    assert.equal(staged.status, 200);
    assert.equal(stagedBody.message, 'Check your inbox for a confirmation email. The report is sent after you confirm.');
    assert.equal(JSON.stringify(stagedBody).includes(attacker), false);
    assert.equal(JSON.stringify(stagedBody).includes(other), false);

    let stored = await getSubscriber(owner);
    assert.equal(stored.status, 'confirmed');
    assert.equal(stored.email, owner);
    assert.equal(stored.snapshot.brand, 'Notion');
    assert.equal(stored.answers[0].text, 'owner-only-answer');
    assert.equal(stored.reportSentAt, ownerRecord.reportSentAt);
    assert.equal(stored.unsubToken, unsubBefore);
    assert.equal(stored.manageToken, manageBefore);
    assert.equal(stored.trackingActive === true, false);
    assert.equal(stored.stripeCustomerId || '', '');
    assert.equal(stored.stripeSubscriptionId || '', '');
    assert.equal(stored.pendingReport.snapshot.brand, 'Acme');
    assert.equal(sent.length, 1);
    assert.equal(sent[0].to, owner);
    assert.equal(sent[0].to === attacker, false);
    assert.equal(unsubTokenFrom(sent[0]), unsubBefore);
    const untouched = await getSubscriber(other);
    assert.equal(untouched.email, other);
    assert.equal(untouched.snapshot.brand, 'Other');
    assert.equal(await subscriberByToken('unsub', unsubBefore).then((record) => record.email), owner);

    const replaced = await subscribe(req('/api/subscribe', subscribeBody(owner, BETA)));
    assert.equal(replaced.status, 200);
    assert.equal(sent.length, 2);
    assert.equal(sent[1].to, owner);
    const stale = await confirmPost(req('/api/subscribe/confirm', { token: confirmTokenFrom(sent[0]) }));
    assert.equal(stale.status, 400);
    stored = await getSubscriber(owner);
    assert.equal(stored.status, 'confirmed');
    assert.equal(stored.snapshot.brand, 'Notion');
    assert.equal(stored.email, owner);

    const confirmed = await confirmPost(req('/api/subscribe/confirm', { token: confirmTokenFrom(sent[1]) }));
    const confirmedBody = await confirmed.json();
    assert.equal(confirmed.status, 200, confirmedBody.error || '');
    const reports = sent.filter((message) => message.subject.startsWith('AI visibility report'));
    assert.equal(reports.length, 1);
    assert.equal(reports[0].to, owner);
    assert.equal(reports[0].text.includes('Beta'), true);
    assert.equal(reports[0].text.includes(attacker), false);
    stored = await getSubscriber(owner);
    assert.equal(stored.status, 'confirmed');
    assert.equal(stored.email, owner);
    assert.equal(stored.snapshot.brand, 'Beta');
    assert.equal(stored.pendingReport, undefined);
    assert.equal(stored.unsubToken, unsubBefore);
    assert.equal(stored.manageToken, manageBefore);
    assert.equal(stored.trackingActive === true, false);
    assert.equal(stored.stripeCustomerId || '', '');
    const again = await confirmPost(req('/api/subscribe/confirm', { token: confirmTokenFrom(sent[1]) }));
    assert.equal((await again.json()).message, 'This address is already confirmed.');
    assert.equal(sent.filter((message) => message.subject.startsWith('AI visibility report')).length, 1);
    assert.equal((await getSubscriber(other)).snapshot.brand, 'Other');
    assert.equal(sent.every((message) => message.to === owner), true);
  });

  test('an expired free re-signup link does not delete or unconfirm the address', async () => {
    await cache(ACME, 'Acme');
    const ownerRecord = baseRecord(owner, 'Notion');
    await saveSubscriber(ownerRecord);
    const staged = await subscribe(req('/api/subscribe', subscribeBody(owner, ACME)));
    assert.equal(staged.status, 200);
    const token = confirmTokenFrom(sent[0]);
    const stored = await getSubscriber(owner);
    stored.pendingReport.confirmExpires = Date.now() - 1000;
    await saveSubscriber(stored);
    const expired = await confirmPost(req('/api/subscribe/confirm', { token }));
    assert.equal(expired.status, 400);
    const after = await getSubscriber(owner);
    assert.equal(after.email, owner);
    assert.equal(after.status, 'confirmed');
    assert.equal(after.snapshot.brand, 'Notion');
    assert.equal(after.reportSentAt, ownerRecord.reportSentAt);
    assert.equal(after.pendingReport, undefined);
    assert.equal(sent.length, 1);
  });

  test('a failed confirmation send restores the confirmed free record', async () => {
    await cache(ACME, 'Acme');
    const ownerRecord = baseRecord(owner, 'Notion');
    await saveSubscriber(ownerRecord);
    setMailerForTests(async () => ({ ok: false, reason: 'send' }));
    const failed = await subscribe(req('/api/subscribe', subscribeBody(owner, ACME)));
    assert.equal(failed.status, 502);
    const stored = await getSubscriber(owner);
    assert.equal(stored.status, 'confirmed');
    assert.equal(stored.email, owner);
    assert.equal(stored.confirmToken, ownerRecord.confirmToken);
    assert.equal(stored.unsubToken, ownerRecord.unsubToken);
    assert.equal(stored.snapshot.brand, 'Notion');
    assert.equal(stored.pendingReport, undefined);
    assert.equal(stored.reportSentAt, ownerRecord.reportSentAt);
  });

  test('an active tracking re-signup does not change billing, brand, or who gets reports', async () => {
    const prev = new Map([
      ['TRACKING_TIER_ENABLED', process.env.TRACKING_TIER_ENABLED],
      ['STRIPE_SECRET_KEY', process.env.STRIPE_SECRET_KEY],
      ['STRIPE_TRACKING_PRICE_ID', process.env.STRIPE_TRACKING_PRICE_ID],
      ['CRON_SECRET', process.env.CRON_SECRET],
      ['TRACKING_MONTHLY_BUDGET_USD', process.env.TRACKING_MONTHLY_BUDGET_USD],
    ]);
    const spy = silence();
    let portalCustomer = '';
    let checkouts = 0;
    setStripeForTests({
      checkout: { sessions: { create: async () => { checkouts += 1; return { url: 'https://checkout.stripe.com/c/pay/cs_test_abc' }; } } },
      billingPortal: { sessions: { create: async (input) => { portalCustomer = input.customer; return { url: 'https://billing.stripe.com/p/session/test_123' }; } } },
    });
    process.env.TRACKING_TIER_ENABLED = '1';
    process.env.STRIPE_SECRET_KEY = STRIPE_KEY;
    process.env.STRIPE_TRACKING_PRICE_ID = PRICE;
    process.env.CRON_SECRET = CRON;
    process.env.TRACKING_MONTHLY_BUDGET_USD = '10';
    try {
      await cache(ACME, 'Acme');
      await saveSubscriber(baseRecord(owner, 'Notion'));
      await saveSubscriber(baseRecord(other, 'Other'));
      await activateTracking(owner, { customerId: 'cus_owner1', subscriptionId: 'sub_owner1', brand: 'Notion', category: 'docs' });
      await activateTracking(other, { customerId: 'cus_other1', subscriptionId: 'sub_other1', brand: 'Other', category: 'docs' });
      const before = await getSubscriber(owner);
      const otherBefore = await getSubscriber(other);

      const resigned = await subscribe(req('/api/subscribe', subscribeBody(owner, ACME)));
      const body = await resigned.json();
      assert.equal(resigned.status, 200);
      assert.equal(body.message, 'Check your inbox for a confirmation email. The report is sent after you confirm.');
      assert.equal(JSON.stringify(body).includes('cus_'), false);
      assert.equal(JSON.stringify(body).includes(owner), false);
      assert.equal(JSON.stringify(body).includes(attacker), false);
      assert.equal(sent.length, 0);

      const stored = await getSubscriber(owner);
      assert.equal(stored.email, owner);
      assert.equal(stored.status, 'confirmed');
      assert.equal(stored.trackingActive, true);
      assert.equal(stored.stripeCustomerId, 'cus_owner1');
      assert.equal(stored.stripeSubscriptionId, 'sub_owner1');
      assert.equal(stored.trackingBrand, 'Notion');
      assert.equal(stored.snapshot.brand, 'Notion');
      assert.equal(stored.unsubToken, before.unsubToken);
      assert.equal(stored.manageToken, before.manageToken);
      assert.equal(stored.confirmToken, before.confirmToken);
      assert.equal(stored.reportSentAt, before.reportSentAt);
      assert.equal(stored.pendingReport, undefined);
      assert.equal((await listTrackingIds()).includes(hashKey(owner)), true);
      const otherAfter = await getSubscriber(other);
      assert.equal(otherAfter.email, other);
      assert.equal(otherAfter.trackingActive, true);
      assert.equal(otherAfter.stripeCustomerId, 'cus_other1');
      assert.equal(otherAfter.stripeSubscriptionId, otherBefore.stripeSubscriptionId);
      assert.equal(otherAfter.snapshot.brand, 'Other');

      const portal = await portalGet(new Request(`https://${host}/api/tracking/portal?token=${stored.manageToken}`, { headers: { host } }));
      assert.equal(portal.status, 303);
      assert.equal(portalCustomer, 'cus_owner1');
      const already = await checkout(req('/api/checkout', { email: owner, brand: 'Notion', elapsed: 1500 }));
      assert.equal(already.status, 400);
      assert.equal((await already.json()).error, 'This address already has monthly tracking. Use the manage link in the tracking email.');
      assert.equal(checkouts, 0);

      const forgedToken = makeToken();
      stored.confirmToken = forgedToken;
      stored.pendingReport = {
        confirmToken: forgedToken,
        confirmExpires: Date.now() + 60_000,
        resultId: ACME,
        snapshot: { brand: 'Acme', category: 'docs', mentionedIn: 0, total: 3, score: 0, runs: 1, rows: [] },
        answers: [],
        email: attacker,
      };
      await saveSubscriber(stored);
      const ignored = await confirmPost(req('/api/subscribe/confirm', { token: forgedToken, email: attacker, to: attacker }));
      assert.equal((await ignored.json()).message, 'This address is already confirmed.');
      assert.equal(sent.length, 0);
      const kept = await getSubscriber(owner);
      assert.equal(kept.email, owner);
      assert.equal(kept.status, 'confirmed');
      assert.equal(kept.trackingActive, true);
      assert.equal(kept.stripeCustomerId, 'cus_owner1');
      assert.equal(kept.stripeSubscriptionId, 'sub_owner1');
      assert.equal(kept.trackingBrand, 'Notion');
      assert.equal(kept.snapshot.brand, 'Notion');
      assert.equal(kept.pendingReport, undefined);

      const brands = [];
      const cron = await runTrackingCron(new Request(`https://${host}/api/cron/tracking`, {
        headers: { host, authorization: `Bearer ${CRON}` },
      }), {
        run: async (input) => {
          brands.push(input.brand);
          return {
            cost: 0.01,
            result: {
              brand: input.brand, category: 'docs', runs: 1, mentionedIn: 1, total: 3, score: 40, avgRank: 1,
              rows: [{ prompt: 'Q', mentioned: true, rank: 1, brands: [input.brand] }],
              topBrands: [], topSources: [], checkedAt: '2026-11-12T00:00:00.000Z',
            },
            rawAnswers: [],
          };
        },
      });
      assert.equal(cron.status, 200);
      const cronBody = await cron.json();
      assert.equal(cronBody.ran >= 1, true);
      assert.equal(brands.includes('Notion'), true);
      assert.equal(brands.includes('Acme'), false);
      assert.equal(sent.some((message) => message.to === owner), true);
      assert.equal(sent.some((message) => message.to === attacker), false);
      assert.equal((await listTrackingIds()).includes(hashKey(owner)), true);
      assert.equal((await getSubscriber(owner)).trackingActive, true);

      const paid = await applyStripeEvent({
        id: 'evt_resignup_active',
        type: 'invoice.paid',
        data: {
          object: {
            id: 'in_resignup_active',
            customer: 'cus_owner1',
            parent: { subscription_details: { subscription: 'sub_owner1', metadata: { brand: 'Notion', email: owner } } },
          },
        },
      });
      assert.equal(paid.applied, true);
      const renewed = await getSubscriber(owner);
      assert.equal(renewed.trackingActive, true);
      assert.equal(renewed.stripeCustomerId, 'cus_owner1');
      assert.equal(renewed.stripeSubscriptionId, 'sub_owner1');
      assert.equal(renewed.trackingBrand, 'Notion');
      assert.equal(renewed.status, 'confirmed');
      assert.equal(renewed.email, owner);
      assert.equal(JSON.stringify(spy.logs).includes(owner), false);
      assert.equal(JSON.stringify(spy.logs).includes(STRIPE_KEY), false);
      assert.equal(JSON.stringify(spy.logs).includes(CRON), false);
      assert.equal(JSON.stringify(cronBody).includes(owner), false);
    } finally {
      spy.restore();
      resetStripeForTests();
      for (const [key, value] of prev) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  });

  test('a canceled subscriber keeps Stripe ids and is not marked unconfirmed', async () => {
    const prev = new Map([
      ['TRACKING_TIER_ENABLED', process.env.TRACKING_TIER_ENABLED],
      ['STRIPE_SECRET_KEY', process.env.STRIPE_SECRET_KEY],
      ['STRIPE_TRACKING_PRICE_ID', process.env.STRIPE_TRACKING_PRICE_ID],
    ]);
    const spy = silence();
    let portalCustomer = '';
    let checkoutCustomer = '';
    setStripeForTests({
      checkout: { sessions: { create: async (input) => { checkoutCustomer = input.customer; return { url: 'https://checkout.stripe.com/c/pay/cs_test_abc' }; } } },
      billingPortal: { sessions: { create: async (input) => { portalCustomer = input.customer; return { url: 'https://billing.stripe.com/p/session/test_123' }; } } },
    });
    process.env.TRACKING_TIER_ENABLED = '1';
    process.env.STRIPE_SECRET_KEY = STRIPE_KEY;
    process.env.STRIPE_TRACKING_PRICE_ID = PRICE;
    try {
      await cache(ACME, 'Acme');
      await saveSubscriber(baseRecord(owner, 'Notion'));
      await saveSubscriber(baseRecord(other, 'Other'));
      await activateTracking(owner, { customerId: 'cus_owner1', subscriptionId: 'sub_owner1', brand: 'Notion', category: 'docs' });
      await deactivateTracking(owner);
      const before = await getSubscriber(owner);
      assert.equal(before.trackingActive, false);
      assert.equal(before.status, 'confirmed');
      assert.equal((await listTrackingIds()).includes(hashKey(owner)), false);

      const resigned = await subscribe(req('/api/subscribe', subscribeBody(owner, ACME)));
      assert.equal(resigned.status, 200);
      assert.equal(sent.length, 0);
      const stored = await getSubscriber(owner);
      assert.equal(stored.email, owner);
      assert.equal(stored.status, 'confirmed');
      assert.equal(stored.reportSentAt, before.reportSentAt);
      assert.equal(stored.trackingActive, false);
      assert.equal(stored.stripeCustomerId, 'cus_owner1');
      assert.equal(stored.stripeSubscriptionId, 'sub_owner1');
      assert.equal(stored.trackingBrand, 'Notion');
      assert.equal(stored.snapshot.brand, 'Notion');
      assert.equal(stored.unsubToken, before.unsubToken);
      assert.equal(stored.manageToken, before.manageToken);
      assert.equal(stored.confirmToken, before.confirmToken);
      assert.equal(stored.pendingReport, undefined);
      assert.equal((await listTrackingIds()).includes(hashKey(owner)), false);
      assert.equal((await getSubscriber(other)).email, other);
      assert.equal((await getSubscriber(other)).stripeCustomerId || '', '');

      const portal = await portalGet(new Request(`https://${host}/api/tracking/portal?token=${stored.manageToken}`, { headers: { host } }));
      assert.equal(portal.status, 303);
      assert.equal(portalCustomer, 'cus_owner1');
      const sameBrand = await checkout(req('/api/checkout', { email: owner, brand: 'Notion', elapsed: 1500 }));
      assert.equal(sameBrand.status, 200);
      assert.equal(checkoutCustomer, 'cus_owner1');
      const otherBrand = await checkout(req('/api/checkout', { email: owner, brand: 'Acme', elapsed: 1500 }));
      assert.equal(otherBrand.status, 400);
      assert.equal((await getSubscriber(owner)).stripeCustomerId, 'cus_owner1');

      const paid = await applyStripeEvent({
        id: 'evt_resignup_canceled',
        type: 'invoice.paid',
        data: {
          object: {
            id: 'in_resignup_canceled',
            customer: 'cus_owner1',
            parent: { subscription_details: { subscription: 'sub_owner1', metadata: { brand: 'Notion', email: owner } } },
          },
        },
      });
      assert.equal(paid.applied, true);
      const renewed = await getSubscriber(owner);
      assert.equal(renewed.status, 'confirmed');
      assert.equal(renewed.email, owner);
      assert.equal(renewed.trackingActive, true);
      assert.equal(renewed.stripeCustomerId, 'cus_owner1');
      assert.equal(renewed.stripeSubscriptionId, 'sub_owner1');
      assert.equal(renewed.trackingBrand, 'Notion');
      assert.equal((await listTrackingIds()).includes(hashKey(owner)), true);
      assert.equal(JSON.stringify(spy.logs).includes(owner), false);
      assert.equal(JSON.stringify(spy.logs).includes(STRIPE_KEY), false);
    } finally {
      spy.restore();
      resetStripeForTests();
      for (const [key, value] of prev) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  });
});
