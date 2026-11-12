import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import Stripe from 'stripe';
import { GET as adminGet } from '../app/api/admin/tracking-metrics/route.js';
import { POST as offerPost } from '../app/api/tracking/offer/route.js';
import { POST as checkout } from '../app/api/checkout/route.js';
import { POST as webhook } from '../app/api/stripe/webhook/route.js';
import { getJSON, resetStoreForTests, setJSON, setReadJSONForTests } from './store.js';
import { resetPrivateStoreForTests } from './privateStore.js';
import { resetStripeForTests, setStripeForTests } from './stripeApi.js';
import { getSubscriber, makeToken, saveSubscriber } from './subscribers.js';
import { applyStripeEvent } from './trackingEvents.js';
import {
  ADMIN_METRICS_LIMIT,
  MAX_STORED_BYTES,
  METRIC_COUNTER_CAP,
  METRIC_WRITE_CAP,
  METRICS_WINDOW_DAYS,
  metricsAuthorized,
  metricsStorageKey,
  offerLimiterStateForTests,
  readTrackingMetrics,
  recordTrackingMetric,
  resetTrackingMetricsForTests,
  setMetricsClockForTests,
  setMetricsWriterForTests,
} from './trackingMetrics.js';
import {
  TRACKING_CHECKOUT_BUTTON,
  TRACKING_OFFER_CTA,
  TRACKING_TIER_BODY,
  TRACKING_TIER_HEADING,
  TRACKING_TIER_PRICE,
} from './trackingTier.js';

const host = 'aivisibilitychecker.app';
const DAY = '2026-11-12T15:00:00.000Z';
const CRON = 'cron-secret-test-value';
const ADMIN = 'admin-secret-test-value';
const STRIPE_KEY = 'sk_test_tracking_secret_value';
const PRICE = 'price_testtracking';
const WEBHOOK_SECRET = 'whsec_tracking_test_secret_value';
const EMAIL = 'owner@example.com';

const ENV = [
  'TRACKING_TIER_ENABLED', 'STRIPE_SECRET_KEY', 'STRIPE_TRACKING_PRICE_ID',
  'STRIPE_WEBHOOK_SECRET', 'CRON_SECRET', 'ADMIN_SECRET', 'VERCEL_ENV', 'HASH_SALT',
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

function at(iso) {
  const t = Date.parse(iso);
  setMetricsClockForTests(() => t);
  return t;
}

function offerReq(body, { origin = `https://${host}`, ip = '203.0.113.10', type = 'application/json' } = {}) {
  const raw = typeof body === 'string' ? body : JSON.stringify(body);
  return new Request(`https://${host}/api/tracking/offer`, {
    method: 'POST',
    headers: {
      origin,
      host,
      'content-type': type,
      'content-length': String(Buffer.byteLength(raw)),
      'x-forwarded-for': ip,
    },
    body: raw,
  });
}

function adminReq(secret, query = '') {
  return new Request(`https://${host}/api/admin/tracking-metrics${query}`, {
    headers: {
      host,
      ...(secret ? { authorization: secret.startsWith('Bearer ') ? secret : `Bearer ${secret}` } : {}),
    },
  });
}

function checkoutReq(body) {
  return new Request(`https://${host}/api/checkout`, {
    method: 'POST',
    headers: { origin: `https://${host}`, host, 'content-type': 'application/json' },
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

function stripeEvent(id, type, object) {
  return { id, object: 'event', type, data: { object } };
}

function signed(evt, secret = WEBHOOK_SECRET) {
  const payload = JSON.stringify(evt);
  const header = Stripe.webhooks.generateTestHeaderString({ payload, secret });
  return new Request(`https://${host}/api/stripe/webhook`, {
    method: 'POST',
    headers: { host, 'content-type': 'application/json', 'stripe-signature': header },
    body: payload,
  });
}

async function counts() {
  const stored = await getJSON(metricsStorageKey('2026-11-12'));
  return stored;
}

describe('monthly tracking offer metrics', { concurrency: false }, () => {
  test('the score banner is flag-gated and the card copy is unchanged', () => {
    const result = readFileSync(new URL('../app/Result.js', import.meta.url), 'utf8');
    const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
    const offer = readFileSync(new URL('../app/TrackingOffer.js', import.meta.url), 'utf8');
    assert.match(result, /\{showTrackingTier \? <TrackingOffer/);
    assert.match(css, /\.track-offer\{/);
    assert.match(css, /@media\(max-width:620px\)\{\.track-offer\{flex-basis:100%\}/);
    assert.equal(offer.includes('JSON.stringify({ event })'), true);
    assert.equal(offer.includes('resultId'), true);
    assert.equal(offer.includes('email:'), false);
    assert.equal(offer.includes('input[type="email"]'), true);
    assert.equal(TRACKING_OFFER_CTA, 'Track this brand weekly');
    assert.equal(TRACKING_TIER_HEADING, 'Monthly tracking');
    assert.equal(TRACKING_TIER_PRICE, '$24/month');
    assert.equal(TRACKING_TIER_BODY, 'One saved brand is re-checked weekly on ChatGPT with web search. Each result is emailed with the run count and the raw answers. Cancel anytime.');
    assert.equal(TRACKING_CHECKOUT_BUTTON, 'Continue to checkout');
    for (const file of [
      'lib/trackingMetrics.js',
      'app/api/tracking/offer/route.js',
      'app/api/admin/tracking-metrics/route.js',
      'app/TrackingOffer.js',
    ]) {
      const text = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
      assert.equal(text.includes('cache=0'), false, file);
      assert.equal(text.includes('console.log'), false, file);
      assert.equal(text.includes('console.error'), false, file);
      assert.equal(text.includes('BLOB_READ_WRITE_TOKEN'), false, file);
    }
  });

  test('counters stay bounded, unguessable, and free of personal data', async () => {
    const prev = saveEnv();
    const spy = silence();
    resetStoreForTests();
    resetTrackingMetricsForTests();
    at(DAY);
    try {
      assert.throws(() => metricsStorageKey('../secret'));
      assert.throws(() => metricsStorageKey('2026-11-12/extra'));
      const key = metricsStorageKey('2026-11-12');
      assert.match(key, /^offer-metrics\/[a-f0-9]{24}\/2026-11-12$/);
      assert.equal(key.includes('tracking-offer'), false);
      assert.equal(key.includes(EMAIL), false);

      await setJSON('month/2026-11', { cost: 12, n: 3 });
      await setJSON('tracking-spend/2026-11', { cost: 1, n: 1 });
      await recordTrackingMetric('nope');
      await recordTrackingMetric('impression');
      await recordTrackingMetric('impression');
      await recordTrackingMetric('click');
      let stored = await counts();
      assert.deepEqual(stored, {
        impressions: 2, clicks: 1, checkouts: 0, subscriptions: 0, writes: 3,
      });
      assert.ok(Buffer.byteLength(JSON.stringify(stored)) <= MAX_STORED_BYTES);
      assert.deepEqual(await getJSON('month/2026-11'), { cost: 12, n: 3 });
      assert.deepEqual(await getJSON('tracking-spend/2026-11'), { cost: 1, n: 1 });

      await Promise.all(Array.from({ length: 20 }, () => recordTrackingMetric('checkout')));
      stored = await counts();
      assert.equal(stored.checkouts, 20);
      assert.equal(stored.writes, 23);

      await setJSON(key, {
        impressions: 2,
        clicks: -4,
        checkouts: 1.5,
        subscriptions: '9',
        writes: 3,
        email: EMAIL,
        ip: '203.0.113.8',
        brand: 'Notion',
        blob: 'x'.repeat(5000),
      });
      await recordTrackingMetric('click');
      stored = await counts();
      assert.equal(stored.impressions, 2);
      assert.equal(stored.clicks, 1);
      assert.equal(stored.checkouts, 0);
      assert.equal(stored.subscriptions, 0);
      assert.equal(stored.email, undefined);
      assert.equal(stored.ip, undefined);
      assert.equal(stored.brand, undefined);
      assert.equal(stored.blob, undefined);
      assert.ok(Buffer.byteLength(JSON.stringify(stored)) <= MAX_STORED_BYTES);
      assert.equal(JSON.stringify(stored).includes(EMAIL), false);

      await setJSON(key, {
        impressions: METRIC_COUNTER_CAP, clicks: 0, checkouts: 0, subscriptions: 0, writes: 4,
      });
      await recordTrackingMetric('impression');
      await recordTrackingMetric('click');
      stored = await counts();
      assert.equal(stored.impressions, METRIC_COUNTER_CAP);
      assert.equal(stored.clicks, 1);

      await setJSON(key, {
        impressions: 4, clicks: 1, checkouts: 0, subscriptions: 0, writes: METRIC_WRITE_CAP,
      });
      await recordTrackingMetric('impression');
      stored = await counts();
      assert.equal(stored.impressions, 4);
      assert.equal(stored.writes, METRIC_WRITE_CAP);

      const full = {
        impressions: METRIC_COUNTER_CAP,
        clicks: METRIC_COUNTER_CAP,
        checkouts: METRIC_COUNTER_CAP,
        subscriptions: METRIC_COUNTER_CAP,
        writes: METRIC_WRITE_CAP,
      };
      assert.ok(Buffer.byteLength(JSON.stringify(full)) <= MAX_STORED_BYTES);

      setMetricsWriterForTests(async () => { throw new Error('bearer SECRET_METRIC_TOKEN'); });
      await recordTrackingMetric('impression');
      assert.equal(spy.logs.join(' ').includes('SECRET_METRIC_TOKEN'), false);
      setMetricsWriterForTests(null);
      stored = await counts();
      assert.equal(stored.impressions, 4);

      setReadJSONForTests(async () => ({ ok: false, value: null }));
      await recordTrackingMetric('click');
      setReadJSONForTests(null);
      stored = await counts();
      assert.equal(stored.clicks, 1);

      at('2026-11-13T01:00:00.000Z');
      await recordTrackingMetric('subscription');
      const report = await readTrackingMetrics();
      assert.equal(report.ok, true);
      assert.equal(report.days.length, METRICS_WINDOW_DAYS);
      assert.equal(report.days[0].date, '2026-11-13');
      assert.equal(report.days[0].subscriptions, 1);
      assert.equal(report.days[0].impressions, 0);
      assert.equal(report.days[1].date, '2026-11-12');
      assert.equal(report.days[1].impressions, 4);
      assert.equal(report.days[1].limited, true);
      assert.equal(Object.hasOwn(report.days[0], 'writes'), false);
      assert.equal(Object.hasOwn(report.days[0], 'email'), false);
      assert.equal(report.days[2].impressions, 0);

      setReadJSONForTests(async () => ({ ok: false, value: null }));
      const failed = await readTrackingMetrics();
      assert.equal(failed.ok, false);
      assert.deepEqual(failed.days, []);
    } finally {
      spy.restore();
      setReadJSONForTests(null);
      resetTrackingMetricsForTests();
      resetStoreForTests();
      restoreEnv(prev);
    }
  });

  test('the offer endpoint counts impressions and clicks only while the flag is on', async () => {
    const prev = saveEnv();
    const spy = silence();
    resetStoreForTests();
    resetTrackingMetricsForTests();
    at(DAY);
    try {
      delete process.env.TRACKING_TIER_ENABLED;
      const hidden = await offerPost(offerReq({ event: 'impression' }));
      assert.equal(hidden.status, 404);
      assert.equal(await counts(), null);

      process.env.TRACKING_TIER_ENABLED = '1';
      const cross = await offerPost(offerReq({ event: 'impression' }, { origin: 'https://evil.example' }));
      assert.equal(cross.status, 403);
      const extra = await offerPost(offerReq({ event: 'impression', email: EMAIL, brand: 'Notion' }));
      assert.equal(extra.status, 400);
      const checkoutEvent = await offerPost(offerReq({ event: 'checkout' }));
      assert.equal(checkoutEvent.status, 400);
      const subscriptionEvent = await offerPost(offerReq({ event: 'subscription' }));
      assert.equal(subscriptionEvent.status, 400);
      const form = await offerPost(offerReq({ event: 'impression' }, { type: 'application/x-www-form-urlencoded' }));
      assert.equal(form.status, 400);
      const trap = await offerPost(offerReq({ event: 'click', company: 'acme' }));
      assert.equal(trap.status, 403);
      const badJson = await offerPost(offerReq('{', { type: 'application/json' }));
      assert.equal(badJson.status, 400);
      assert.equal(await counts(), null);

      const seen = await offerPost(offerReq({ event: 'impression' }));
      assert.equal(seen.status, 204);
      assert.equal(await seen.text(), '');
      assert.match(seen.headers.get('cache-control'), /no-store/);
      assert.equal(seen.headers.get('cdn-cache-control'), 'no-store');
      const clicked = await offerPost(offerReq({ event: 'click' }, { ip: '203.0.113.11' }));
      assert.equal(clicked.status, 204);
      const stored = await counts();
      assert.equal(stored.impressions, 1);
      assert.equal(stored.clicks, 1);
      assert.equal(stored.checkouts, 0);
      assert.equal(stored.subscriptions, 0);
      assert.equal(JSON.stringify(stored).includes('203.0.113'), false);
      assert.equal(JSON.stringify(stored).includes('Notion'), false);

      for (let i = 0; i < 12; i++) {
        const res = await offerPost(offerReq({ event: 'impression' }, { ip: '198.51.100.8' }));
        assert.equal(res.status, 204);
      }
      const blocked = await offerPost(offerReq({ event: 'impression' }, { ip: '198.51.100.8' }));
      assert.equal(blocked.status, 204);
      assert.equal((await counts()).impressions, 13);
      const limiter = offerLimiterStateForTests();
      assert.equal(limiter.keys.some((key) => key.includes('198.51.100')), false);
      assert.equal(limiter.keys.every((key) => /^[a-f0-9]{24}$/.test(key)), true);

      at('2026-11-12T15:11:00.000Z');
      const again = await offerPost(offerReq({ event: 'click' }, { ip: '198.51.100.8' }));
      assert.equal(again.status, 204);
      assert.equal((await counts()).clicks, 2);

      const before = await counts();
      const prevVercel = process.env.VERCEL_ENV;
      const prevSalt = process.env.HASH_SALT;
      process.env.VERCEL_ENV = 'production';
      delete process.env.HASH_SALT;
      const unsalted = await offerPost(offerReq({ event: 'impression' }, { ip: '198.51.100.9' }));
      assert.equal(unsalted.status, 204);
      if (prevVercel === undefined) delete process.env.VERCEL_ENV;
      else process.env.VERCEL_ENV = prevVercel;
      if (prevSalt === undefined) delete process.env.HASH_SALT;
      else process.env.HASH_SALT = prevSalt;
      assert.deepEqual(await counts(), before);
      assert.equal(spy.logs.join(' ').includes('HASH_SALT'), false);
    } finally {
      spy.restore();
      resetTrackingMetricsForTests();
      resetStoreForTests();
      restoreEnv(prev);
    }
  });

  test('the admin endpoint requires a bearer secret, is not cached, and is rate-limited', async () => {
    const prev = saveEnv();
    const spy = silence();
    resetStoreForTests();
    resetTrackingMetricsForTests();
    at(DAY);
    try {
      delete process.env.CRON_SECRET;
      delete process.env.ADMIN_SECRET;
      assert.equal(metricsAuthorized('Bearer cron-secret-test-value'), false);
      const open = await adminGet(adminReq(''));
      assert.equal(open.status, 401);
      assert.match(open.headers.get('cache-control'), /no-store/);
      assert.equal(open.headers.get('cdn-cache-control'), 'no-store');

      process.env.CRON_SECRET = 'short';
      process.env.ADMIN_SECRET = ADMIN;
      const short = await adminGet(adminReq('short'));
      assert.equal(short.status, 401);
      const wrong = await adminGet(adminReq('not-the-admin-secret-value'));
      assert.equal(wrong.status, 401);
      const prefixed = await adminGet(adminReq(`Token ${ADMIN}`));
      assert.equal(prefixed.status, 401);

      await setJSON(metricsStorageKey('2026-11-12'), {
        impressions: 3, clicks: 2, checkouts: 1, subscriptions: 0, writes: 6,
        email: EMAIL, ip: '203.0.113.8', brand: 'Notion',
      });
      const ok = await adminGet(adminReq(ADMIN, `?email=${encodeURIComponent(EMAIL)}&day=../secret`));
      assert.equal(ok.status, 200);
      assert.match(ok.headers.get('cache-control'), /no-store/);
      assert.equal(ok.headers.get('pragma'), 'no-cache');
      const body = await ok.json();
      assert.equal(body.days.length, METRICS_WINDOW_DAYS);
      assert.deepEqual(body.days[0], {
        date: '2026-11-12', impressions: 3, clicks: 2, checkouts: 1, subscriptions: 0, limited: false,
      });
      const text = JSON.stringify(body);
      assert.equal(text.includes(EMAIL), false);
      assert.equal(text.includes('203.0.113.8'), false);
      assert.equal(text.includes('Notion'), false);
      assert.equal(text.includes(ADMIN), false);
      assert.equal(text.includes('offer-metrics'), false);
      assert.equal(text.includes('writes'), false);
      assert.equal(Object.keys(body).join(), 'days');

      process.env.CRON_SECRET = CRON;
      const byCron = await adminGet(adminReq(CRON));
      assert.equal(byCron.status, 200);

      resetTrackingMetricsForTests();
      at(DAY);
      process.env.CRON_SECRET = CRON;
      process.env.ADMIN_SECRET = ADMIN;
      for (let i = 0; i < ADMIN_METRICS_LIMIT; i++) {
        const res = await adminGet(adminReq('wrong-secret-value-xxxx'));
        assert.equal(res.status, 401);
      }
      const limited = await adminGet(adminReq(CRON));
      assert.equal(limited.status, 429);
      assert.match(limited.headers.get('cache-control'), /no-store/);
      const limitedBody = await limited.json();
      assert.deepEqual(limitedBody, { error: 'Too many requests.' });
      assert.equal(JSON.stringify(limitedBody).includes(CRON), false);

      resetTrackingMetricsForTests();
      at(DAY);
      setReadJSONForTests(async () => ({ ok: false, value: null }));
      const down = await adminGet(adminReq(CRON));
      assert.equal(down.status, 503);
      assert.match(down.headers.get('cache-control'), /no-store/);
      setReadJSONForTests(null);

      process.env.VERCEL_ENV = 'production';
      delete process.env.HASH_SALT;
      const unsalted = await adminGet(adminReq(CRON));
      assert.equal(unsalted.status, 503);
      const unsaltedBody = await unsalted.json();
      assert.deepEqual(unsaltedBody, { error: 'Unavailable' });
      assert.equal(JSON.stringify(spy.logs).includes(CRON), false);
      assert.equal(JSON.stringify(spy.logs).includes(ADMIN), false);
      assert.equal(JSON.stringify(spy.logs).includes(EMAIL), false);
    } finally {
      spy.restore();
      setReadJSONForTests(null);
      resetTrackingMetricsForTests();
      resetStoreForTests();
      restoreEnv(prev);
    }
  });

  test('checkout counts a created session and the webhook counts one completed subscription', async () => {
    const prev = saveEnv();
    const spy = silence();
    resetStoreForTests();
    resetPrivateStoreForTests();
    resetStripeForTests();
    resetTrackingMetricsForTests();
    at(DAY);
    process.env.TRACKING_TIER_ENABLED = '1';
    process.env.STRIPE_SECRET_KEY = STRIPE_KEY;
    process.env.STRIPE_TRACKING_PRICE_ID = PRICE;
    process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
    try {
      await setJSON('month/2026-11', { cost: 49, n: 8 });
      await setJSON('tracking-spend/2026-11', { cost: 2, n: 1 });
      await confirmed(EMAIL, 'Notion');
      setStripeForTests({
        checkout: { sessions: { create: async () => ({ url: 'https://evil.example/pay' }) } },
      });
      const badUrl = await checkout(checkoutReq({ email: EMAIL, brand: 'Notion', elapsed: 1500 }));
      assert.equal(badUrl.status, 502);
      assert.equal((await counts())?.checkouts ?? 0, 0);

      setStripeForTests({
        checkout: { sessions: { create: async () => ({ url: 'https://checkout.stripe.com/c/pay/cs_test_abc' }) } },
      });
      setMetricsWriterForTests(async () => { throw new Error('bearer SECRET_METRIC_TOKEN'); });
      const startedAnyway = await checkout(checkoutReq({ email: EMAIL, brand: 'Notion', elapsed: 1500 }));
      assert.equal(startedAnyway.status, 200);
      assert.equal((await startedAnyway.json()).url, 'https://checkout.stripe.com/c/pay/cs_test_abc');
      assert.equal(await counts(), null);
      assert.equal(spy.logs.join(' ').includes('SECRET_METRIC_TOKEN'), false);
      assert.equal(spy.logs.join(' ').includes(STRIPE_KEY), false);

      setMetricsWriterForTests(null);
      const started = await checkout(checkoutReq({ email: EMAIL, brand: 'Notion', elapsed: 1500 }));
      assert.equal(started.status, 200);
      assert.equal((await counts()).checkouts, 1);
      assert.equal((await counts()).subscriptions, 0);
      const pending = await checkout(checkoutReq({ email: 'other@example.com', brand: 'Notion', elapsed: 1500 }));
      assert.equal(pending.status, 400);
      assert.equal((await counts()).checkouts, 1);
      assert.deepEqual(await getJSON('month/2026-11'), { cost: 49, n: 8 });
      assert.deepEqual(await getJSON('tracking-spend/2026-11'), { cost: 2, n: 1 });
      assert.equal(JSON.stringify(await counts()).includes(EMAIL), false);

      const unpaid = stripeEvent('evt_unpaid_1', 'checkout.session.completed', {
        id: 'cs_unpaid', mode: 'subscription', payment_status: 'unpaid',
        customer: 'cus_owner1', subscription: 'sub_owner1',
        metadata: { brand: 'Notion', email: EMAIL },
      });
      assert.equal((await applyStripeEvent(unpaid)).applied, false);
      assert.equal((await counts()).subscriptions, 0);

      const mismatch = stripeEvent('evt_mismatch_1', 'checkout.session.completed', {
        id: 'cs_mismatch', mode: 'subscription', payment_status: 'paid',
        customer: 'cus_owner1', subscription: 'sub_owner1',
        metadata: { brand: 'Other', email: EMAIL },
      });
      assert.equal((await applyStripeEvent(mismatch)).applied, false);
      assert.equal((await counts()).subscriptions, 0);

      const paid = stripeEvent('evt_paid_1', 'checkout.session.completed', {
        id: 'cs_paid', mode: 'subscription', payment_status: 'paid',
        customer: 'cus_owner1', subscription: 'sub_owner1',
        metadata: { brand: 'Notion', email: EMAIL },
      });
      const ok = await webhook(signed(paid));
      assert.equal(ok.status, 200);
      assert.equal((await counts()).subscriptions, 1);
      assert.equal((await getSubscriber(EMAIL)).trackingActive, true);
      const again = await webhook(signed(paid));
      assert.equal(again.status, 200);
      assert.equal((await again.json()).duplicate, true);
      assert.equal((await counts()).subscriptions, 1);

      const renewal = stripeEvent('evt_invoice_1', 'invoice.paid', {
        id: 'in_1', customer: 'cus_owner1',
        parent: { subscription_details: { subscription: 'sub_owner1', metadata: { brand: 'Notion', email: EMAIL } } },
      });
      assert.equal((await webhook(signed(renewal))).status, 200);
      assert.equal((await counts()).subscriptions, 1);

      const failed = stripeEvent('evt_failed_1', 'invoice.payment_failed', {
        id: 'in_2', customer: 'cus_owner1',
        parent: { subscription_details: { subscription: 'sub_owner1', metadata: { brand: 'Notion', email: EMAIL } } },
      });
      await webhook(signed(failed));
      const recovered = stripeEvent('evt_invoice_2', 'invoice.paid', {
        id: 'in_3', customer: 'cus_owner1',
        parent: { subscription_details: { subscription: 'sub_owner1', metadata: { brand: 'Notion', email: EMAIL } } },
      });
      await webhook(signed(recovered));
      assert.equal((await getSubscriber(EMAIL)).trackingActive, true);
      assert.equal((await counts()).subscriptions, 1);

      const removed = stripeEvent('evt_deleted_1', 'customer.subscription.deleted', {
        id: 'sub_owner1', customer: 'cus_owner1', status: 'canceled',
        metadata: { brand: 'Notion', email: EMAIL },
      });
      await webhook(signed(removed));
      assert.equal((await getSubscriber(EMAIL)).trackingActive, false);
      const resubscribed = stripeEvent('evt_paid_2', 'checkout.session.completed', {
        id: 'cs_paid_2', mode: 'subscription', payment_status: 'paid',
        customer: 'cus_owner1', subscription: 'sub_owner2',
        metadata: { brand: 'Notion', email: EMAIL },
      });
      assert.equal((await webhook(signed(resubscribed))).status, 200);
      assert.equal((await counts()).subscriptions, 2);

      const asyncPaid = stripeEvent('evt_async_1', 'checkout.session.async_payment_succeeded', {
        id: 'cs_async', mode: 'subscription', payment_status: 'paid',
        customer: 'cus_owner1', subscription: 'sub_owner2',
        metadata: { brand: 'Notion', email: EMAIL },
      });
      await webhook(signed(asyncPaid));
      assert.equal((await counts()).subscriptions, 2);

      assert.deepEqual(await getJSON('month/2026-11'), { cost: 49, n: 8 });
      assert.deepEqual(await getJSON('tracking-spend/2026-11'), { cost: 2, n: 1 });
      const blob = JSON.stringify(await counts());
      assert.equal(blob.includes(EMAIL), false);
      assert.equal(blob.includes('Notion'), false);
      assert.equal(spy.logs.join(' ').includes(EMAIL), false);
      assert.equal(spy.logs.join(' ').includes(WEBHOOK_SECRET), false);
      assert.equal(spy.logs.join(' ').includes(STRIPE_KEY), false);
    } finally {
      spy.restore();
      resetStripeForTests();
      resetTrackingMetricsForTests();
      resetStoreForTests();
      resetPrivateStoreForTests();
      restoreEnv(prev);
    }
  });
});
