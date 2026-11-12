import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import Stripe from 'stripe';
import { POST as checkout } from '../app/api/checkout/route.js';
import { POST as webhook } from '../app/api/stripe/webhook/route.js';
import { GET as cronGet } from '../app/api/cron/tracking/route.js';
import { GET as portalGet } from '../app/api/tracking/portal/route.js';
import { POST as unsubscribe } from '../app/api/unsubscribe/route.js';
import { TRACKING_CANCELED_BODY, TRACKING_SUCCESS_BODY } from './trackingTier.js';
import { resetStoreForTests, setJSON, getJSON } from './store.js';
import { resetPrivateStoreForTests } from './privateStore.js';
import { resetMailerForTests, setMailerForTests } from './mailer.js';
import { resetStripeForTests, setStripeForTests } from './stripeApi.js';
import { makeToken, saveSubscriber, getSubscriber } from './subscribers.js';
import { runTrackingCron } from './trackingCron.js';
import { listTrackingIds } from './trackingRecords.js';
import { TRACKING_RESERVE_USD } from './trackingMoney.js';
import { hashKey } from './hash.js';

const host = 'aivisibilitychecker.app';
const NOW = Date.parse('2026-11-12T15:00:00.000Z');
const SECRET = 'whsec_tracking_test_secret_value';
const CRON = 'cron-secret-test-value';
const STRIPE_KEY = 'sk_test_tracking_secret_value';
const PRICE = 'price_testtracking';
const RAW = 'RAW-TRACKING-ANSWER';

const ENV = [
  'TRACKING_TIER_ENABLED', 'STRIPE_SECRET_KEY', 'STRIPE_TRACKING_PRICE_ID',
  'STRIPE_WEBHOOK_SECRET', 'CRON_SECRET', 'TRACKING_MONTHLY_BUDGET_USD', 'OPENAI_API_KEY',
];

function saveEnv() {
  return new Map(ENV.map((key) => [key, process.env[key]]));
}

function restoreEnv(prev) {
  for (const key of ENV) {
    const value = prev.get(key);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

function silence() {
  const logs = [];
  const prevLog = console.log;
  const prevErr = console.error;
  console.log = (...args) => { logs.push(args.join(' ')); };
  console.error = (...args) => { logs.push(args.join(' ')); };
  return {
    logs,
    restore() { console.log = prevLog; console.error = prevErr; },
  };
}

function req(path, body, extra = {}) {
  return new Request(`https://${host}${path}`, {
    method: 'POST',
    headers: { origin: `https://${host}`, host, 'content-type': 'application/json', ...extra },
    body: JSON.stringify(body),
  });
}

async function confirmed(email, brand) {
  await saveSubscriber({
    email,
    status: 'confirmed',
    weekly: true,
    createdAt: '2026-11-12T00:00:00.000Z',
    confirmExpires: Date.now() + 86_000_000,
    confirmToken: makeToken(),
    unsubToken: makeToken(),
    manageToken: makeToken(),
    resultId: 'ab'.repeat(12),
    snapshot: {
      brand, category: 'docs', mentionedIn: 1, total: 3, score: 40, avgRank: 1, runs: 1,
      rows: [{ prompt: 'What are the best docs tools?', mentioned: true, rank: 1, brands: [brand] }],
      topBrands: [], topSources: [], checkedAt: '2026-11-12T00:00:00.000Z',
    },
    answers: [],
    reportSentAt: '2026-11-12T00:00:00.000Z',
    confirmedAt: '2026-11-12T00:00:00.000Z',
    trackingActive: false,
  });
}

function event(id, type, object) {
  return { id, object: 'event', type, data: { object } };
}

function signed(evt, { secret = SECRET, signature, body } = {}) {
  const payload = body ?? JSON.stringify(evt);
  const header = signature ?? Stripe.webhooks.generateTestHeaderString({ payload, secret });
  return new Request(`https://${host}/api/stripe/webhook`, {
    method: 'POST',
    headers: { host, 'content-type': 'application/json', ...(header ? { 'stripe-signature': header } : {}) },
    body: payload,
  });
}

describe('monthly tracking can go live', { concurrency: false }, () => {
  test('flag off hides checkout, flag on starts a $24 subscription session', async () => {
    const prev = saveEnv();
    const spy = silence();
    resetStoreForTests();
    resetPrivateStoreForTests();
    resetStripeForTests();
    try {
      delete process.env.TRACKING_TIER_ENABLED;
      process.env.STRIPE_SECRET_KEY = STRIPE_KEY;
      process.env.STRIPE_TRACKING_PRICE_ID = PRICE;
      const hidden = await checkout(req('/api/checkout', { email: 'owner@example.com', brand: 'Notion', elapsed: 1500 }));
      assert.equal(hidden.status, 404);

      process.env.TRACKING_TIER_ENABLED = '1';
      const pending = await checkout(req('/api/checkout', { email: 'owner@example.com', brand: 'Notion', elapsed: 1500 }));
      assert.equal(pending.status, 400);

      await confirmed('owner@example.com', 'Notion');
      await confirmed('other@example.com', 'Other');
      let params = null;
      setStripeForTests({
        checkout: { sessions: { create: async (input) => { params = input; return { url: 'https://checkout.stripe.com/c/pay/cs_test_abc' }; } } },
      });
      const started = await checkout(req('/api/checkout', { email: 'owner@example.com', brand: 'Notion', elapsed: 1500, company: '' }));
      assert.equal(started.status, 200);
      const startedBody = await started.json();
      assert.equal(startedBody.url, 'https://checkout.stripe.com/c/pay/cs_test_abc');
      assert.equal(JSON.stringify(startedBody).includes(STRIPE_KEY), false);
      assert.equal(params.mode, 'subscription');
      assert.equal(params.payment_method_types, undefined);
      assert.equal(params.line_items[0].price, PRICE);
      assert.equal(params.line_items[0].quantity, 1);
      assert.equal(params.customer_email, 'owner@example.com');
      assert.equal(params.metadata.email, 'owner@example.com');
      assert.equal(params.metadata.brand, 'Notion');
      assert.equal(params.subscription_data.metadata.email, 'owner@example.com');
      assert.equal(params.subscription_data.metadata.brand, 'Notion');
      assert.match(params.integration_identifier, /^aic_tracking_[a-z]{8}$/);
      assert.equal(params.success_url.includes('/tracking/success'), true);

      const wrongBrand = await checkout(req('/api/checkout', { email: 'owner@example.com', brand: 'Other', elapsed: 1500 }));
      assert.equal(wrongBrand.status, 400);
      const other = await getSubscriber('other@example.com');
      assert.equal(other.trackingActive, false);

      const successPage = readFileSync(new URL('../app/tracking/success/page.js', import.meta.url), 'utf8');
      const canceledPage = readFileSync(new URL('../app/tracking/canceled/page.js', import.meta.url), 'utf8');
      assert.equal(successPage.includes('../../../lib/trackingTier.js'), true);
      assert.equal(canceledPage.includes('../../../lib/trackingTier.js'), true);
      assert.equal(successPage.includes('TRACKING_SUCCESS_BODY'), true);
      assert.equal(canceledPage.includes('TRACKING_CANCELED_BODY'), true);
      assert.equal(TRACKING_SUCCESS_BODY.includes('$24/month'), true);
      assert.equal(TRACKING_SUCCESS_BODY.includes('Cancel anytime'), true);
      assert.equal(TRACKING_SUCCESS_BODY.includes('raw answers'), true);
      assert.equal(TRACKING_CANCELED_BODY.includes('You have not been charged for monthly tracking.'), true);
      assert.equal(JSON.stringify(spy.logs).includes(STRIPE_KEY), false);
    } finally {
      spy.restore();
      resetStripeForTests();
      restoreEnv(prev);
    }
  });

  test('webhook rejects unsigned requests and activates or deactivates once per event id', async () => {
    const prev = saveEnv();
    const spy = silence();
    resetStoreForTests();
    resetPrivateStoreForTests();
    resetStripeForTests();
    process.env.STRIPE_WEBHOOK_SECRET = SECRET;
    process.env.STRIPE_SECRET_KEY = STRIPE_KEY;
    try {
      await confirmed('owner@example.com', 'Notion');
      await confirmed('other@example.com', 'Other');
      const paid = event('evt_activate_1', 'checkout.session.completed', {
        id: 'cs_test_1', mode: 'subscription', payment_status: 'paid',
        customer: 'cus_owner1', subscription: 'sub_owner1',
        metadata: { brand: 'Notion', email: 'owner@example.com' },
      });

      const missing = await webhook(signed(paid, { signature: '' }));
      assert.equal(missing.status, 400);
      const badSig = await webhook(signed(paid, { secret: 'whsec_wrong_secret_value_here' }));
      assert.equal(badSig.status, 400);
      const payload = JSON.stringify(paid);
      const header = Stripe.webhooks.generateTestHeaderString({ payload, secret: SECRET });
      const tampered = await webhook(signed(paid, { signature: header, body: `${payload} ` }));
      assert.equal(tampered.status, 400);
      let owner = await getSubscriber('owner@example.com');
      assert.equal(owner.trackingActive || false, false);

      const ok = await webhook(signed(paid));
      assert.equal(ok.status, 200);
      assert.equal((await ok.json()).duplicate, undefined);
      owner = await getSubscriber('owner@example.com');
      assert.equal(owner.trackingActive, true);
      assert.equal(owner.stripeCustomerId, 'cus_owner1');
      assert.equal(owner.stripeSubscriptionId, 'sub_owner1');
      assert.equal(owner.trackingBrand, 'Notion');
      assert.equal(owner.billingEventCount, 1);
      const other = await getSubscriber('other@example.com');
      assert.equal(other.trackingActive || false, false);
      assert.equal(other.billingEventCount, undefined);

      const again = await webhook(signed(paid));
      assert.equal(again.status, 200);
      assert.equal((await again.json()).duplicate, true);
      owner = await getSubscriber('owner@example.com');
      assert.equal(owner.billingEventCount, 1);
      assert.equal(owner.trackingActive, true);

      const renewal = event('evt_invoice_1', 'invoice.paid', {
        id: 'in_1', customer: 'cus_owner1',
        parent: { subscription_details: { subscription: 'sub_owner1', metadata: { brand: 'Notion', email: 'owner@example.com' } } },
      });
      const renewed = await webhook(signed(renewal));
      assert.equal(renewed.status, 200);
      owner = await getSubscriber('owner@example.com');
      assert.equal(owner.trackingActive, true);
      assert.equal(owner.billingEventCount, 2);

      const stillActive = event('evt_updated_active', 'customer.subscription.updated', {
        id: 'sub_owner1', customer: 'cus_owner1', status: 'active', metadata: { brand: 'Notion', email: 'owner@example.com' },
      });
      await webhook(signed(stillActive));
      owner = await getSubscriber('owner@example.com');
      assert.equal(owner.trackingActive, true);

      const failed = event('evt_failed_1', 'invoice.payment_failed', {
        id: 'in_2', customer: 'cus_owner1',
        parent: { subscription_details: { subscription: 'sub_owner1', metadata: { brand: 'Notion', email: 'owner@example.com' } } },
      });
      const failedRes = await webhook(signed(failed));
      assert.equal(failedRes.status, 200);
      owner = await getSubscriber('owner@example.com');
      assert.equal(owner.trackingActive, false);
      assert.equal((await listTrackingIds()).includes(hashKey('owner@example.com')), false);

      const reactivate = event('evt_invoice_2', 'invoice.paid', {
        id: 'in_3', customer: 'cus_owner1',
        parent: { subscription_details: { subscription: 'sub_owner1', metadata: { brand: 'Notion', email: 'owner@example.com' } } },
      });
      await webhook(signed(reactivate));
      const removed = event('evt_deleted_1', 'customer.subscription.deleted', {
        id: 'sub_owner1', customer: 'cus_owner1', status: 'canceled', metadata: { brand: 'Notion', email: 'owner@example.com' },
      });
      await webhook(signed(removed));
      owner = await getSubscriber('owner@example.com');
      assert.equal(owner.trackingActive, false);

      await webhook(signed(reactivate.id ? event('evt_invoice_3', 'invoice.paid', reactivate.data.object) : reactivate));
      const refund = event('evt_refund_1', 'charge.refunded', { id: 'ch_owner1', customer: 'cus_owner1' });
      await webhook(signed(refund));
      owner = await getSubscriber('owner@example.com');
      assert.equal(owner.trackingActive, false);
      const otherAfter = await getSubscriber('other@example.com');
      assert.equal(otherAfter.trackingActive || false, false);
      assert.equal(JSON.stringify(spy.logs).includes(SECRET), false);
      assert.equal(JSON.stringify(spy.logs).includes('owner@example.com'), false);
    } finally {
      spy.restore();
      resetStripeForTests();
      restoreEnv(prev);
    }
  });

  test('cron requires the secret, caps spend, and does not use the free-checker budget', async () => {
    const prev = saveEnv();
    const spy = silence();
    resetStoreForTests();
    resetPrivateStoreForTests();
    resetMailerForTests();
    resetStripeForTests();
    process.env.CRON_SECRET = CRON;
    process.env.TRACKING_MONTHLY_BUDGET_USD = '0.10';
    process.env.OPENAI_API_KEY = 'openai-key-not-used-in-this-test';
    const sent = [];
    setMailerForTests(async (message) => { sent.push(message); return { ok: true }; });
    let runs = 0;
    const run = async () => {
      runs += 1;
      return {
        cost: 0.087,
        result: {
          brand: 'Notion', category: 'docs', runs: 1, mentionedIn: 2, total: 3, score: 70, avgRank: 1,
          rows: [{ prompt: 'What are the best docs tools?', mentioned: true, rank: 1, brands: ['Notion'] }],
          topBrands: [], topSources: [], checkedAt: '2026-11-12T15:00:00.000Z',
        },
        rawAnswers: [{ prompt: 'What are the best docs tools?', text: RAW }],
      };
    };
    try {
      await setJSON('month/2026-11', { cost: 50, n: 9 });
      await confirmed('owner@example.com', 'Notion');
      await confirmed('second@example.com', 'Notion');
      const { activateTracking } = await import('./trackingRecords.js');
      await activateTracking('owner@example.com', { customerId: 'cus_owner1', subscriptionId: 'sub_owner1', brand: 'Notion', category: 'docs' });
      await activateTracking('second@example.com', { customerId: 'cus_second1', subscriptionId: 'sub_second1', brand: 'Notion', category: 'docs' });

      const denied = await cronGet(new Request(`https://${host}/api/cron/tracking`, { headers: { host } }));
      assert.equal(denied.status, 401);
      const wrong = await cronGet(new Request(`https://${host}/api/cron/tracking`, {
        headers: { host, authorization: 'Bearer not-the-secret' },
      }));
      assert.equal(wrong.status, 401);
      assert.equal(runs, 0);

      const first = await runTrackingCron(new Request(`https://${host}/api/cron/tracking`, {
        headers: { host, authorization: `Bearer ${CRON}` },
      }), { run, now: () => NOW });
      assert.equal(first.status, 200);
      const firstBody = await first.json();
      assert.equal(firstBody.ran, 1);
      assert.equal(firstBody.stopped, 'budget');
      assert.equal(runs, 1);
      assert.equal(JSON.stringify(firstBody).includes(RAW), false);
      assert.equal(JSON.stringify(firstBody).includes('owner@example.com'), false);
      assert.equal(JSON.stringify(firstBody).includes(CRON), false);

      const free = await getJSON('month/2026-11');
      assert.deepEqual(free, { cost: 50, n: 9 });
      const trackingSpend = await getJSON('tracking-spend/2026-11');
      assert.equal(trackingSpend.cost, 0.087);
      assert.ok(trackingSpend.cost < TRACKING_RESERVE_USD + 0.087);

      const owner = await getSubscriber('owner@example.com');
      const second = await getSubscriber('second@example.com');
      const ranOwner = owner.trackingRunCount === 1 ? owner : second;
      const skipped = owner.trackingRunCount === 1 ? second : owner;
      assert.equal(ranOwner.answers[0].text, RAW);
      assert.equal(ranOwner.trackingEmailPending, false);
      assert.equal(skipped.trackingRunCount || 0, 0);
      assert.equal(sent.length, 1);
      assert.equal(sent[0].text.includes(RAW), true);
      assert.equal(sent[0].text.includes('$24/month'), true);
      assert.equal(sent[0].text.includes('run count') || sent[0].text.includes('This score is based on 1 run'), true);
      assert.equal(sent[0].text.includes('/api/tracking/portal?token='), true);
      assert.equal(sent[0].text.includes('/tracking/manage?token='), true);
      assert.equal(sent[0].text.includes('Cancel the subscription and delete this address'), true);
      assert.equal(sent[0].to === 'owner@example.com' || sent[0].to === 'second@example.com', true);
      assert.equal(sent[0].idempotencyKey.startsWith('tracking/'), true);
      assert.equal(sent[0].idempotencyKey.includes(hashKey(sent[0].to)), true);

      process.env.TRACKING_MONTHLY_BUDGET_USD = '10';
      const secondPass = await runTrackingCron(new Request(`https://${host}/api/cron/tracking`, {
        headers: { host, authorization: `Bearer ${CRON}` },
      }), { run, now: () => NOW });
      const secondBody = await secondPass.json();
      assert.equal(secondBody.ran, 1);
      assert.equal(runs, 2);
      const ownerAfter = await getSubscriber('owner@example.com');
      const secondAfter = await getSubscriber('second@example.com');
      assert.equal(ownerAfter.trackingRunCount, 1);
      assert.equal(secondAfter.trackingRunCount, 1);
      const thirdPass = await runTrackingCron(new Request(`https://${host}/api/cron/tracking`, {
        headers: { host, authorization: `Bearer ${CRON}` },
      }), { run, now: () => NOW });
      assert.equal((await thirdPass.json()).ran, 0);
      assert.equal(runs, 2);
      const freeAfter = await getJSON('month/2026-11');
      assert.deepEqual(freeAfter, { cost: 50, n: 9 });
      assert.equal(JSON.stringify(spy.logs).includes(CRON), false);
      assert.equal(JSON.stringify(spy.logs).includes(RAW), false);
      assert.equal(JSON.stringify(spy.logs).includes('@'), false);
    } finally {
      spy.restore();
      resetMailerForTests();
      resetStripeForTests();
      restoreEnv(prev);
    }
  });

  test('unsubscribe cancels the subscription and the portal link is signed', async () => {
    const prev = saveEnv();
    resetStoreForTests();
    resetPrivateStoreForTests();
    resetStripeForTests();
    process.env.STRIPE_SECRET_KEY = STRIPE_KEY;
    process.env.STRIPE_WEBHOOK_SECRET = SECRET;
    let canceled = '';
    let portalCustomer = '';
    setStripeForTests({
      subscriptions: { cancel: async (id) => { canceled = id; return { id, status: 'canceled' }; } },
      billingPortal: { sessions: { create: async (input) => { portalCustomer = input.customer; return { url: 'https://billing.stripe.com/p/session/test_123' }; } } },
    });
    try {
      await confirmed('owner@example.com', 'Notion');
      const paid = event('evt_portal_1', 'checkout.session.completed', {
        id: 'cs_portal', mode: 'subscription', payment_status: 'paid',
        customer: 'cus_portal1', subscription: 'sub_portal1',
        metadata: { brand: 'Notion', email: 'owner@example.com' },
      });
      assert.equal((await webhook(signed(paid))).status, 200);
      const owner = await getSubscriber('owner@example.com');
      const portal = await portalGet(new Request(`https://${host}/api/tracking/portal?token=${owner.manageToken}`, { headers: { host } }));
      assert.equal(portal.status, 303);
      assert.equal(portal.headers.get('location'), 'https://billing.stripe.com/p/session/test_123');
      assert.equal(portalCustomer, 'cus_portal1');

      const removed = await unsubscribe(req('/api/unsubscribe', { token: owner.unsubToken }));
      assert.equal(removed.status, 200);
      assert.equal((await removed.json()).message, 'The subscription is canceled and this address is deleted.');
      assert.equal(canceled, 'sub_portal1');
      assert.equal(await getSubscriber('owner@example.com'), null);
      const again = await portalGet(new Request(`https://${host}/api/tracking/portal?token=${owner.manageToken}`, { headers: { host } }));
      assert.equal(again.status, 400);
    } finally {
      resetStripeForTests();
      restoreEnv(prev);
    }
  });
});
