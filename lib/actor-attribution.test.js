import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { actorTrackingUrl, ACTOR_ORIGIN, ACTOR_PATH } from './actorLink.js';
import { captureFirstTouch, channelProps, CHANNEL_KEY } from './attribution.js';
import { eventProps, EVENTS, trackEvent } from './analyticsEvents.js';
import ApifyActorLink from '../app/ApifyActorLink.js';
import Footer from '../app/Footer.js';

function memoryStorage(initial) {
  const map = new Map(initial ? [[CHANNEL_KEY, initial]] : []);
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    dump: () => map.get(CHANNEL_KEY),
  };
}

const PII = {
  brand: 'Secret Brand',
  email: 'owner@example.com',
  ip: '203.0.113.44',
  website: 'https://customer.example/private?q=1',
  url: 'https://customer.example/path',
  input: 'typed prompt text',
  category: 'project management for Acme',
};

function assertNoPersonalData(props) {
  const serialized = JSON.stringify(props);
  for (const value of Object.values(PII)) {
    assert.equal(serialized.includes(value), false, serialized);
  }
  assert.equal(serialized.includes('owner@example.com'), false);
  assert.equal(serialized.includes('203.0.113.44'), false);
  assert.equal(serialized.includes('customer.example'), false);
  assert.equal(serialized.includes('Secret Brand'), false);
  assert.equal(serialized.includes('?'), false);
}

test('actor links use the fixed store URL and placement campaign', () => {
  for (const campaign of ['result', 'home', 'footer']) {
    const href = actorTrackingUrl(campaign);
    const url = new URL(href);
    assert.equal(url.origin, ACTOR_ORIGIN);
    assert.equal(url.pathname, ACTOR_PATH);
    assert.equal(url.searchParams.get('utm_source'), 'aivisibilitychecker');
    assert.equal(url.searchParams.get('utm_medium'), 'referral');
    assert.equal(url.searchParams.get('utm_campaign'), campaign);
    assert.deepEqual([...url.searchParams.keys()].sort(), ['utm_campaign', 'utm_medium', 'utm_source']);
    assert.equal(href.includes('!'), false);
  }
  assert.equal(new URL(actorTrackingUrl('result-cta&brand=evil')).searchParams.get('utm_campaign'), 'home');
});

test('first landing keeps campaign tags and the referrer hostname only', () => {
  const storage = memoryStorage();
  const referrer = 'https://www.producthunt.com/posts/ai-visibility-checker-9?utm_source=ph&email=owner@example.com';
  const first = captureFirstTouch({
    search: '?utm_source=newsletter&utm_medium=email&utm_campaign=launch&brand=Secret%20Brand',
    referrer,
    storage,
  });
  assert.deepEqual(first, {
    utm_source: 'newsletter',
    utm_medium: 'email',
    utm_campaign: 'launch',
    referrer_host: 'www.producthunt.com',
  });
  const stored = storage.dump();
  assert.equal(stored.includes('producthunt.com/posts'), false);
  assert.equal(stored.includes('owner@example.com'), false);
  assert.equal(stored.includes('Secret'), false);
  const second = captureFirstTouch({
    search: '?utm_source=later&utm_medium=cpc&utm_campaign=other',
    referrer: 'https://news.ycombinator.com/item?id=1',
    storage,
  });
  assert.equal(second.utm_source, 'newsletter');
  assert.equal(second.referrer_host, 'www.producthunt.com');
});

test('check, result, checkout, and actor click payloads drop personal data', async () => {
  const storage = memoryStorage();
  const channel = captureFirstTouch({
    search: '?utm_source=partner&utm_medium=referral&utm_campaign=result',
    referrer: 'https://news.example/item?id=9&email=owner@example.com',
    storage,
  });
  const channelFields = channelProps(channel);
  const cases = [
    [EVENTS.CHECK_SUBMITTED, {
      source: 'home',
      has_competitors: false,
      category_bucket: 'software',
      engine: 'chatgpt',
      ...channelFields,
      ...PII,
    }],
    [EVENTS.RESULT_VIEWED, {
      named: true,
      source: 'home',
      engine: 'chatgpt',
      cached: false,
      ...channelFields,
      ...PII,
    }],
    [EVENTS.CHECKOUT_STARTED, {
      checkout_type: 'paid_report',
      ...channelFields,
      ...PII,
    }],
    [EVENTS.CHECKOUT_STARTED, {
      checkout_type: 'tracking_subscription',
      ...channelFields,
      ...PII,
    }],
    [EVENTS.TRACKER_CTA_CLICK, {
      location: 'result-top',
      ...channelFields,
      ...PII,
    }],
  ];
  for (const [name, input] of cases) {
    const props = eventProps(input);
    assert.equal(props.utm_source, 'partner');
    assert.equal(props.utm_medium, 'referral');
    assert.equal(props.utm_campaign, 'result');
    assert.equal(props.referrer_host, 'news.example');
    assertNoPersonalData(props);
    assert.ok(Object.keys(props).length <= 8);
    const calls = [];
    await trackEvent((eventName, eventPropsSent) => { calls.push({ eventName, eventPropsSent }); }, name, input);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].eventName, name);
    assertNoPersonalData(calls[0].eventPropsSent);
  }
});

test('unsafe campaign tags and referrer values are coarsened', () => {
  const props = eventProps(channelProps({
    utm_source: 'https://evil.example/steal?email=owner@example.com',
    utm_medium: 'PH Launch!',
    utm_campaign: 'Secret Brand',
    referrer_host: 'https://customer.example/private?q=1',
  }));
  assert.equal(props.utm_source, 'other');
  assert.equal(props.utm_medium, 'other');
  assert.equal(props.utm_campaign, 'other');
  assert.equal(props.referrer_host, 'other');
  assertNoPersonalData(props);
  const direct = eventProps(channelProps({ referrer_host: 'direct' }));
  assert.equal(direct.utm_source, 'none');
  assert.equal(direct.referrer_host, 'direct');
});

test('result, home, and footer render the actor link with rel noopener', () => {
  for (const campaign of ['result', 'home', 'footer']) {
    const html = renderToStaticMarkup(createElement(ApifyActorLink, { campaign }));
    const href = actorTrackingUrl(campaign).replaceAll('&', '&amp;');
    assert.equal(html.includes(href), true, campaign);
    assert.equal(html.includes('rel="noopener"'), true, campaign);
    assert.equal(html.includes('target="_blank"'), true, campaign);
    assert.equal(html.includes('pay per answer'), true, campaign);
    assert.equal(html.includes('!'), false, campaign);
  }
  const footer = renderToStaticMarkup(createElement(Footer));
  assert.equal(footer.includes(actorTrackingUrl('footer').replaceAll('&', '&amp;')), true);
  assert.equal(footer.includes('rel="noopener"'), true);
});
