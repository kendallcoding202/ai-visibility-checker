import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { GET } from '../app/api/flags/route.js';
import Home from '../app/page.js';
import Pricing from '../app/pricing/page.js';
import Result from '../app/Result.js';
import Success from '../app/tracking/success/page.js';
import { TrackingOffer, TrackingOfferBanner } from '../app/TrackingOffer.js';
import { resetStripeForTests, setStripeForTests, createTrackingCheckout, trackingCheckoutDiscount } from './stripeApi.js';
import {
  TRACKING_OFFER_BANNER,
  TRACKING_OFFER_HOME,
  TRACKING_OFFER_NOTE,
  TRACKING_OFFER_PRICE,
  trackingOfferActive,
  trackingPromotionCode,
  trackingSuccessBody,
} from './trackingOffer.js';
import { TRACKING_SUCCESS_BODY, TRACKING_TIER_PRICE, trackingTierCard } from './trackingTier.js';
import { trackingOfferElement, trackingTierElement } from './trackingTierView.js';

const PROMO = 'promo_testTrackingOffer';
const ENDS = '2026-12-01T06:59:59Z';
const ENDS_MS = Date.parse(ENDS);
const PRICE = 'price_testtracking';
const FORBIDDEN = ['hurry', 'limited', 'guarantee', 'only'];
const CLIENT_FILES = [
  'app/Checker.js',
  'app/Result.js',
  'app/ResultClient.js',
  'app/TrackingOffer.js',
  'app/TrackingCheckout.js',
  'lib/trackingTier.js',
  'lib/trackingTierView.js',
];

const ENV = ['STRIPE_TRACKING_PROMO_ID', 'TRACKING_OFFER_ENDS_AT', 'STRIPE_TRACKING_PRICE_ID', 'STRIPE_SECRET_KEY'];

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
  const prev = console.error;
  console.error = (...args) => { logs.push(args.join(' ')); };
  return { logs, restore() { console.error = prev; } };
}

function sampleResult() {
  return {
    id: 'abc123abc123abc123abc123',
    brand: 'Notion',
    category: 'project management',
    mentionedIn: 2,
    total: 3,
    score: 72,
    avgRank: 2,
    runs: 1,
    cached: false,
    checkedAt: '2026-11-23T18:00:00.000Z',
    topBrands: [{ name: 'Notion', n: 2 }],
    competitorHits: [],
    topSources: [{ domain: 'www.g2.com', n: 1 }],
    rows: [{ prompt: 'What is the best project management tool?', mentioned: true, rank: 1, brands: ['Notion'] }],
  };
}

function offerCopy() {
  return [
    TRACKING_OFFER_BANNER,
    TRACKING_OFFER_PRICE,
    TRACKING_OFFER_NOTE,
    TRACKING_OFFER_HOME,
    trackingSuccessBody(1200),
  ];
}

test('tracking offer is active only before the end, with a promotion code id and a parseable end', () => {
  const prev = saveEnv();
  try {
    delete process.env.STRIPE_TRACKING_PROMO_ID;
    delete process.env.TRACKING_OFFER_ENDS_AT;
    assert.equal(trackingOfferActive(ENDS_MS - 1), false);
    assert.equal(trackingPromotionCode(ENDS_MS - 1), '');

    process.env.STRIPE_TRACKING_PROMO_ID = PROMO;
    process.env.TRACKING_OFFER_ENDS_AT = ENDS;
    assert.equal(trackingOfferActive(ENDS_MS - 1), true);
    assert.equal(trackingOfferActive(ENDS_MS), false);
    assert.equal(trackingOfferActive(ENDS_MS + 1), false);
    assert.equal(trackingPromotionCode(ENDS_MS - 1), PROMO);
    assert.equal(trackingPromotionCode(ENDS_MS), '');

    process.env.STRIPE_TRACKING_PROMO_ID = `  ${PROMO}  `;
    process.env.TRACKING_OFFER_ENDS_AT = `  ${ENDS}  `;
    assert.equal(trackingOfferActive(ENDS_MS - 1), true);

    process.env.TRACKING_OFFER_ENDS_AT = '2099-01-01T00:00:00.000Z';
    assert.equal(trackingOfferActive(), true);
    process.env.TRACKING_OFFER_ENDS_AT = '2000-01-01T00:00:00.000Z';
    assert.equal(trackingOfferActive(), false);

    process.env.TRACKING_OFFER_ENDS_AT = ENDS;
    for (const id of ['', 'promo_', 'promo_has space', 'coupon_abc', 'PROMO_abc', 'promo_abc!', 'notpromo_abc']) {
      process.env.STRIPE_TRACKING_PROMO_ID = id;
      assert.equal(trackingOfferActive(ENDS_MS - 1), false, id);
    }
    process.env.STRIPE_TRACKING_PROMO_ID = PROMO;
    for (const date of ['', 'not-a-date', 'tomorrow', '06:59:59Z']) {
      process.env.TRACKING_OFFER_ENDS_AT = date;
      assert.equal(trackingOfferActive(ENDS_MS - 1), false, date);
    }
    delete process.env.STRIPE_TRACKING_PROMO_ID;
    process.env.TRACKING_OFFER_ENDS_AT = ENDS;
    assert.equal(trackingOfferActive(ENDS_MS - 1), false);
    process.env.STRIPE_TRACKING_PROMO_ID = PROMO;
    delete process.env.TRACKING_OFFER_ENDS_AT;
    assert.equal(trackingOfferActive(ENDS_MS - 1), false);
  } finally {
    restoreEnv(prev);
  }
});

test('offer copy uses the list price and avoids pressure words', () => {
  assert.equal(TRACKING_OFFER_PRICE, `$12 for the first month, then ${TRACKING_TIER_PRICE}`);
  assert.equal(TRACKING_OFFER_BANNER, 'Black Friday: your first month of weekly tracking is $12, then $24/month. Cancel anytime. Offer ends Nov 30, 11:59 PM MT.');
  assert.equal(TRACKING_OFFER_PRICE, '$12 for the first month, then $24/month');
  assert.equal(TRACKING_OFFER_NOTE, 'The $12 first-month price applies automatically at checkout for new subscribers until Nov 30, 2026, 11:59 PM MT.');
  assert.equal(TRACKING_OFFER_HOME, 'Black Friday: weekly tracking is $12 for the first month, then $24/month, until Nov 30, 11:59 PM MT.');
  assert.equal(TRACKING_TIER_PRICE, '$24/month');
  assert.equal(trackingSuccessBody(0), TRACKING_SUCCESS_BODY);
  assert.equal(trackingSuccessBody(1200).startsWith('Checkout is complete for monthly tracking: $12 for the first month, then $24/month.'), true);
  assert.equal(trackingSuccessBody(1200).includes('Weekly tracking starts when the payment is confirmed.'), true);
  assert.equal(trackingSuccessBody(1200).includes('Cancel anytime from the link in those emails.'), true);
  const card = trackingTierCard('Notion', true);
  assert.equal(card.price, TRACKING_OFFER_PRICE);
  assert.equal(card.offerNote, TRACKING_OFFER_NOTE);
  assert.equal(trackingTierCard('Notion').price, TRACKING_TIER_PRICE);
  assert.equal(trackingTierCard('Notion').offerNote, '');
  for (const copy of offerCopy()) {
    for (const word of FORBIDDEN) assert.equal(copy.toLowerCase().includes(word), false, word);
  }
});

test('checkout adds the promotion code only while the offer is active and retries once without it', async () => {
  const prev = saveEnv();
  const spy = silence();
  resetStripeForTests();
  try {
    process.env.STRIPE_TRACKING_PRICE_ID = PRICE;
    delete process.env.STRIPE_TRACKING_PROMO_ID;
    delete process.env.TRACKING_OFFER_ENDS_AT;
    const idle = [];
    setStripeForTests({
      checkout: { sessions: { create: async (input) => { idle.push(JSON.parse(JSON.stringify(input))); return { url: 'https://checkout.stripe.com/c/pay/cs_test_idle' }; } } },
    });
    const plain = await createTrackingCheckout({
      email: 'owner@example.com', brand: 'Notion', successUrl: 'https://aivisibilitychecker.app/tracking/success', cancelUrl: 'https://aivisibilitychecker.app/tracking/canceled',
    });
    assert.equal(plain.ok, true);
    assert.equal(idle.length, 1);
    assert.equal(idle[0].discounts, undefined);
    assert.equal(idle[0].allow_promotion_codes, undefined);
    assert.equal(JSON.stringify(idle[0]).includes(PROMO), false);

    process.env.STRIPE_TRACKING_PROMO_ID = PROMO;
    process.env.TRACKING_OFFER_ENDS_AT = '2099-01-01T00:00:00.000Z';
    try {
      for (const code of ['resource_missing', 'promotion_code_max_redemptions', 'coupon_expired']) {
        const calls = [];
        setStripeForTests({
          checkout: { sessions: { create: async (input) => {
            calls.push(JSON.parse(JSON.stringify(input)));
            if (calls.length === 1) {
              const error = new Error(`No such promotion code: ${PROMO}`);
              error.code = code;
              throw error;
            }
            return { url: 'https://checkout.stripe.com/c/pay/cs_test_retry' };
          } } },
        });
        const retried = await createTrackingCheckout({
          email: 'owner@example.com', brand: 'Notion', successUrl: 'https://aivisibilitychecker.app/tracking/success', cancelUrl: 'https://aivisibilitychecker.app/tracking/canceled',
        });
        assert.equal(retried.ok, true, code);
        assert.equal(calls.length, 2, code);
        assert.deepEqual(calls[0].discounts, [{ promotion_code: PROMO }]);
        assert.equal(calls[0].allow_promotion_codes, undefined, code);
        assert.equal(calls[1].discounts, undefined, code);
        assert.equal(calls[1].allow_promotion_codes, undefined, code);
        assert.equal(calls[1].line_items[0].price, PRICE);
      }
      const calls = [];
      setStripeForTests({
        checkout: { sessions: { create: async (input) => {
          calls.push(JSON.parse(JSON.stringify(input)));
          return { url: 'https://checkout.stripe.com/c/pay/cs_test_discount' };
        } } },
      });
      const discounted = await createTrackingCheckout({
        email: 'owner@example.com', brand: 'Notion', successUrl: 'https://aivisibilitychecker.app/tracking/success', cancelUrl: 'https://aivisibilitychecker.app/tracking/canceled',
      });
      assert.equal(discounted.ok, true);
      assert.equal(calls.length, 1);
      assert.deepEqual(calls[0].discounts, [{ promotion_code: PROMO }]);
      assert.equal(calls[0].allow_promotion_codes, undefined);
      assert.equal(JSON.stringify(discounted).includes(PROMO), false);
    } finally {
      process.env.TRACKING_OFFER_ENDS_AT = ENDS;
    }

    const logged = spy.logs.join('\n');
    assert.match(logged, /stripe checkout discount failed code=resource_missing/);
    assert.match(logged, /stripe checkout discount failed code=promotion_code_max_redemptions/);
    assert.match(logged, /stripe checkout discount failed code=coupon_expired/);
    assert.equal(logged.includes(PROMO), false);
    assert.equal(logged.includes('No such promotion code'), false);
  } finally {
    spy.restore();
    resetStripeForTests();
    restoreEnv(prev);
  }
});

test('the promotion code stays off the client props, flags, and rendered pages', async () => {
  const prev = saveEnv();
  const spy = silence();
  resetStripeForTests();
  try {
    process.env.STRIPE_TRACKING_PROMO_ID = PROMO;
    process.env.TRACKING_OFFER_ENDS_AT = '2099-01-01T00:00:00.000Z';
    try {
      const flags = await GET();
      const body = await flags.json();
      assert.equal(body.trackingOffer, true);
      assert.equal(typeof body.trackingTier, 'boolean');
      assert.equal(typeof body.paidReport, 'boolean');
      assert.equal(typeof body.emailCapture, 'boolean');
      assert.equal(JSON.stringify(body).includes(PROMO), false);
      assert.equal(JSON.stringify(body).includes('promo_'), false);
      assert.equal(JSON.stringify(body).includes('STRIPE_TRACKING_PROMO_ID'), false);

      const offer = createElement(TrackingOffer, { brand: 'Notion', resultId: 'abc', offerActive: true });
      const banner = createElement(TrackingOfferBanner, { offerActive: true });
      const tier = trackingTierElement(true, 'Notion', true);
      assert.equal(JSON.stringify(offer.props).includes(PROMO), false);
      assert.equal(JSON.stringify(offer.props).includes('promo_'), false);
      assert.equal(JSON.stringify(banner.props).includes('promo_'), false);
      assert.equal(JSON.stringify(tier.props).includes(PROMO), false);
      assert.equal(tier.props.offerActive, true);
      assert.equal(offer.props.offerActive, true);

      const html = renderToStaticMarkup(createElement('div', null,
        offer,
        banner,
        tier,
        trackingOfferElement(true, 'Notion', 'abc', true),
        createElement(Result, { d: sampleResult(), showTrackingTier: true, trackingOffer: true }),
        createElement(Home),
        createElement(Pricing),
      ));
      assert.equal(html.includes(TRACKING_OFFER_BANNER), true);
      assert.equal(html.includes(TRACKING_OFFER_PRICE), true);
      assert.equal(html.includes(TRACKING_OFFER_NOTE), true);
      assert.equal(html.includes(TRACKING_OFFER_HOME), true);
      assert.equal(html.includes(`>${TRACKING_TIER_PRICE}</p>`), true);
      assert.equal(html.includes(PROMO), false);
      assert.equal(html.includes('promo_'), false);
      assert.equal(html.includes('STRIPE_TRACKING_PROMO_ID'), false);
      for (const word of FORBIDDEN) {
        assert.equal(TRACKING_OFFER_BANNER.toLowerCase().includes(word), false, word);
        assert.equal(TRACKING_OFFER_NOTE.toLowerCase().includes(word), false, word);
        assert.equal(TRACKING_OFFER_PRICE.toLowerCase().includes(word), false, word);
      }

      setStripeForTests({
        checkout: { sessions: { retrieve: async (id) => {
          assert.equal(id, 'cs_test_discounted1');
          return { total_details: { amount_discount: 1200 } };
        } } },
      });
      const discounted = renderToStaticMarkup(await Success({ searchParams: Promise.resolve({ session_id: 'cs_test_discounted1' }) }));
      assert.equal(discounted.includes('Checkout is complete for monthly tracking: $12 for the first month, then $24/month.'), true);
      assert.equal(discounted.includes(PROMO), false);

      let retrieved = 0;
      setStripeForTests({
        checkout: { sessions: { retrieve: async () => { retrieved += 1; return { total_details: { amount_discount: 0 } }; } } },
      });
      const fullPrice = renderToStaticMarkup(await Success({ searchParams: Promise.resolve({ session_id: 'cs_test_fullprice1' }) }));
      assert.equal(fullPrice.includes(TRACKING_SUCCESS_BODY), true);
      assert.equal(fullPrice.includes('$12 for the first month'), false);
      const ignored = renderToStaticMarkup(await Success({ searchParams: Promise.resolve({ session_id: 'https://evil.example/cs_test_x' }) }));
      assert.equal(ignored.includes(TRACKING_SUCCESS_BODY), true);
      assert.equal(retrieved, 1);

      const error = new Error(`missing ${PROMO}`);
      error.code = 'resource_missing';
      setStripeForTests({
        checkout: { sessions: { retrieve: async () => { throw error; } } },
      });
      const failed = renderToStaticMarkup(await Success({ searchParams: Promise.resolve({ session_id: 'cs_test_missing1' }) }));
      assert.equal(failed.includes(TRACKING_SUCCESS_BODY), true);
      assert.equal(spy.logs.join('\n').includes(PROMO), false);
      assert.match(spy.logs.join('\n'), /stripe checkout session failed code=resource_missing/);
    } finally {
      process.env.TRACKING_OFFER_ENDS_AT = ENDS;
    }

    delete process.env.STRIPE_TRACKING_PROMO_ID;
    const hidden = renderToStaticMarkup(createElement('div', null,
      trackingOfferElement(true, 'Notion', 'abc', false),
      trackingTierElement(true, 'Notion', false),
      createElement(TrackingOfferBanner, { offerActive: false }),
      createElement(Result, { d: sampleResult(), showTrackingTier: true, trackingOffer: false }),
      createElement(Home),
      createElement(Pricing),
    ));
    assert.equal(hidden.includes('Black Friday:'), false);
    assert.equal(hidden.includes('$12 for the first month'), false);
    assert.equal(hidden.includes(TRACKING_OFFER_NOTE), false);
    assert.equal(hidden.includes(TRACKING_TIER_PRICE), true);
    assert.equal(hidden.includes('<h3>Monthly tracking</h3>'), true);

    for (const file of CLIENT_FILES) {
      const text = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
      assert.equal(text.includes('STRIPE_TRACKING_PROMO_ID'), false, file);
      assert.equal(text.includes("lib/trackingOffer.js"), false, file);
      assert.equal(text.includes(PROMO), false, file);
    }
    const webhook = readFileSync(new URL('../app/api/stripe/webhook/route.js', import.meta.url), 'utf8');
    assert.equal(webhook.includes('trackingOffer'), false);
    assert.equal(webhook.includes('STRIPE_TRACKING_PROMO_ID'), false);
  } finally {
    spy.restore();
    resetStripeForTests();
    restoreEnv(prev);
  }
});
