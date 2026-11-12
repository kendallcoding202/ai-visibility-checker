import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { GET } from '../app/api/flags/route.js';
import { tracker } from './costCompare.js';
import {
  planColumnClass, trackingTierCard, trackingTierEnabled, TRACKING_OFFER_CTA,
} from './trackingTier.js';
import { trackingOfferElement, trackingTierElement } from './trackingTierView.js';

const BLOCKED = ['Gemini', 'Perplexity', 'daily', 'Stripe', 'dashboard', '$29'];

async function withFlag(value, fn) {
  const prev = process.env.TRACKING_TIER_ENABLED;
  if (value === undefined) delete process.env.TRACKING_TIER_ENABLED;
  else process.env.TRACKING_TIER_ENABLED = value;
  try {
    return await fn();
  } finally {
    if (prev === undefined) delete process.env.TRACKING_TIER_ENABLED;
    else process.env.TRACKING_TIER_ENABLED = prev;
  }
}

function htmlFor(show, brand) {
  return renderToStaticMarkup(createElement('div', null,
    trackingOfferElement(show, brand, 'abc'),
    trackingTierElement(show, brand)));
}

test('tracking tier stays hidden unless TRACKING_TIER_ENABLED is exactly 1', async () => {
  await withFlag(undefined, async () => {
    assert.equal(trackingTierEnabled(), false);
    const res = await GET();
    const body = await res.json();
    assert.equal(body.trackingTier, false);
    assert.equal(JSON.stringify(body).includes('$29'), false);
    assert.equal(JSON.stringify(body).includes('$24'), false);
    assert.equal(JSON.stringify(body).includes('Monthly tracking'), false);
    const hidden = htmlFor(trackingTierEnabled(), 'Notion');
    assert.equal(hidden.includes('Monthly tracking'), false);
    assert.equal(hidden.includes('$24/month'), false);
    assert.equal(hidden.includes('$29/month'), false);
    assert.equal(hidden.includes('plan'), false);
    assert.equal(hidden.includes(TRACKING_OFFER_CTA), false);
    assert.equal(hidden.includes('monthly-tracking'), false);
    assert.equal(hidden.includes('tracking-offer'), false);
  });

  for (const off of ['', '0', 'true', 'yes', 'on']) {
    await withFlag(off, () => {
      assert.equal(trackingTierEnabled(), false, off);
      assert.equal(htmlFor(trackingTierEnabled(), 'Notion').includes('$24/month'), false);
    });
  }

  await withFlag('1', async () => {
    assert.equal(trackingTierEnabled(), true);
    const res = await GET();
    const body = await res.json();
    assert.equal(body.trackingTier, true);
    assert.equal(typeof body.paidReport, 'boolean');
    const html = htmlFor(trackingTierEnabled(), 'Notion');
    assert.equal(html.includes('<h3>Monthly tracking</h3>'), true);
    assert.equal(html.includes('$24/month'), true);
    assert.equal(html.includes('$29/month'), false);
    assert.equal(html.includes('One saved brand is re-checked weekly on ChatGPT with web search.'), true);
    assert.equal(html.includes('Each result is emailed with the run count and the raw answers.'), true);
    assert.equal(html.includes('Cancel anytime.'), true);
    assert.equal(html.includes('This offer is for the Notion check on this page.'), true);
    assert.equal(html.includes('Continue to checkout'), true);
    assert.equal(html.includes('Checkout is not open yet.'), false);
    assert.equal(html.includes(TRACKING_OFFER_CTA), true);
    assert.equal(html.includes('href="#monthly-tracking"'), true);
    assert.equal(html.includes('id="monthly-tracking"'), true);
    assert.equal(html.includes('id="tracking-offer"'), true);
    assert.equal(html.split('Continue to checkout').length - 1, 1);
    assert.equal(html.split('One saved brand is re-checked weekly on ChatGPT with web search.').length - 1, 1);
    const card = trackingTierCard('Notion');
    const blob = `${card.heading} ${card.price} ${card.body} ${card.note}`;
    assert.equal(blob.split('Cancel anytime').length - 1, 1);
    for (const phrase of BLOCKED) assert.equal(blob.includes(phrase), false, phrase);
  });
});

test('tracking tier copy escapes the brand and the Apify price stays $0.0375', () => {
  const html = htmlFor(true, 'A<b> & "C"\nBcc');
  assert.equal(html.includes('<b>'), false);
  assert.equal(html.includes('A&lt;b&gt;'), true);
  assert.equal(html.includes('\n'), false);
  assert.equal(html.includes('Bcc'), true);
  assert.equal(tracker.pricePerAnswer, 0.0375);
  assert.equal(planColumnClass(false, false), 'plans one');
  assert.equal(planColumnClass(true, false), 'plans');
  assert.equal(planColumnClass(false, true), 'plans');
  assert.equal(planColumnClass(true, true), 'plans three');
});
