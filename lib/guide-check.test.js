import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { INLINE_CHECK_PATHS, checkBrandHref } from './checkLink.js';
import Privacy from '../app/privacy/page.js';

const LINE = 'Enter a brand name to see whether ChatGPT mentions it on three buyer-style questions.';

test('every guide renders one brand form and its own twitter title', async () => {
  const guides = INLINE_CHECK_PATHS.filter((path) => path !== '/');
  assert.equal(guides.length, 15);
  for (const path of guides) {
    const mod = await import(`../app${path}/page.js`);
    const html = renderToStaticMarkup(createElement(mod.default));
    assert.equal(html.includes('id="checker"'), true, path);
    assert.equal(/id="check"/.test(html), true, path);
    assert.equal(html.split('name="brand"').length - 1, 1, `${path} form count`);
    assert.equal(html.includes('>Check your brand<'), true, path);
    assert.equal(html.includes(LINE), true, path);
    assert.equal(html.includes('name="website"'), true, `${path} honeypot`);
    assert.equal(mod.metadata.twitter.title, mod.metadata.title, path);
    assert.equal(mod.metadata.twitter.description, mod.metadata.description, path);
    assert.equal(mod.metadata.twitter.title === 'Free AI Visibility Checker: Does ChatGPT Recommend Your Brand?', false, path);
    const forbiddenName = ['ChatGPT Business', 'Hub'].join(' ');
    assert.equal(html.includes(forbiddenName), false, path);
  }
});

test('privacy has no check form', () => {
  const html = renderToStaticMarkup(createElement(Privacy));
  assert.equal(html.includes('name="brand"'), false);
  assert.equal(html.includes('id="checker"'), false);
  assert.equal(html.includes(LINE), false);
});

test('header check link stays on pages with the form and leaves other pages', () => {
  for (const path of INLINE_CHECK_PATHS) {
    assert.equal(checkBrandHref(path), '#checker', path);
    assert.equal(checkBrandHref(`${path === '/' ? '' : path}/`), '#checker', path);
  }
  for (const path of ['/privacy', '/r/abc123', '/l/abc123', '/email/confirm', '/email/unsubscribe', '/tracking/manage', '/tracking/success', '/tracking/canceled']) {
    assert.equal(checkBrandHref(path), '/#checker', path);
  }
  const src = readFileSync(new URL('../app/CheckBrandLink.js', import.meta.url), 'utf8');
  assert.equal(src.includes('usePathname'), true);
  assert.equal(src.includes('checkBrandHref(usePathname())'), true);
});

test('the four-way comparison shows the Black Friday tracking offer only while it is active', async () => {
  const promoKey = 'STRIPE_TRACKING_PROMO_ID';
  const endsKey = 'TRACKING_OFFER_ENDS_AT';
  const prevPromo = process.env[promoKey];
  const prevEnds = process.env[endsKey];
  const mod = await import('../app/ai-visibility-tracker-vs-otterly-profound-peec-semrush/page.js');
  const { TRACKING_OFFER_HOME } = await import('./trackingOffer.js');
  const { TRACKING_OFFER_CTA } = await import('./trackingTier.js');
  const offer = 'Black Friday: weekly tracking is $15/month for the first 3 months, then $24/month, until Nov 30, 11:59 PM MT.';
  try {
    delete process.env[promoKey];
    delete process.env[endsKey];
    const off = renderToStaticMarkup(createElement(mod.default));
    assert.equal(off.includes(TRACKING_OFFER_HOME), false);
    assert.equal(off.includes('Black Friday:'), false);
    assert.equal(off.includes(offer), false);
    assert.equal((off.match(/<a class="cta" href="#checker">Run the free check<\/a>/g) || []).length, 2);
    assert.equal(off.split('After the free check, the full written report is $19.').length - 1, 2);

    process.env[promoKey] = 'promo_testTrackingOffer';
    process.env[endsKey] = '2099-01-01T00:00:00.000Z';
    const on = renderToStaticMarkup(createElement(mod.default));
    assert.equal(TRACKING_OFFER_HOME, offer);
    assert.equal(on.split(offer).length - 1, 2);
    assert.equal((on.match(/<a class="cta" href="\/pricing#monthly-tracking">Track this brand weekly<\/a>/g) || []).length, 2);
    assert.equal(on.includes(TRACKING_OFFER_CTA), true);
    assert.equal(offer.includes('\u2014'), false);
    assert.equal(offer.includes('\u2013'), false);
    assert.equal(on.includes('promo_'), false);
    assert.equal(on.includes(promoKey), false);
    assert.equal((on.match(/<a class="cta" href="#checker">Run the free check<\/a>/g) || []).length, 2);
    assert.equal(on.split('After the free check, the full written report is $19.').length - 1, 2);

    process.env[endsKey] = '2000-01-01T00:00:00.000Z';
    const expired = renderToStaticMarkup(createElement(mod.default));
    assert.equal(expired.includes(offer), false);
    assert.equal(expired.includes('Black Friday:'), false);
  } finally {
    if (prevPromo === undefined) delete process.env[promoKey];
    else process.env[promoKey] = prevPromo;
    if (prevEnds === undefined) delete process.env[endsKey];
    else process.env[endsKey] = prevEnds;
  }
});

test('the four-way comparison offers the free check twice and names the report price', async () => {
  const mod = await import('../app/ai-visibility-tracker-vs-otterly-profound-peec-semrush/page.js');
  const html = renderToStaticMarkup(createElement(mod.default));
  const ctas = html.match(/<a class="cta" href="#checker">Run the free check<\/a>/g) || [];
  assert.equal(ctas.length, 2);
  const note = 'After the free check, the full written report is $19.';
  assert.equal(html.split(note).length - 1, 2);
  assert.equal(note.includes('\u2014'), false);
  assert.equal(note.includes('\u2013'), false);
  assert.equal(html.includes('Run a free ChatGPT visibility check'), false);
  assert.equal(html.includes('Open AI Visibility Tracker on Apify'), true);
});

test('article checks pass source and do not send typed fields to analytics', () => {
  const checker = readFileSync(new URL('../app/Checker.js', import.meta.url), 'utf8');
  const call = checker.slice(checker.indexOf('EVENTS.CHECK_SUBMITTED'), checker.indexOf('setState({ loading: true'));
  assert.equal(call.includes('source,'), true);
  assert.equal(call.includes('brand'), false);
  assert.equal(call.includes('email'), false);
  assert.equal(call.includes('ip'), false);
  assert.equal(checker.includes("source = 'home'"), true);
  const inline = readFileSync(new URL('../app/InlineCheck.js', import.meta.url), 'utf8');
  assert.equal(inline.includes('source="article"'), true);
  assert.equal(inline.includes('paidReportEnabled()'), true);
  assert.equal(inline.includes('trackingTierEnabled()'), true);
  assert.equal(inline.includes('emailCaptureEnabled()'), true);
});
