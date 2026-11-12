import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import sitemap from '../app/sitemap.js';
import HowTo, { metadata as howToMeta } from '../app/how-to-check-if-chatgpt-mentions-your-brand/page.js';
import Otterly, { metadata as otterlyMeta } from '../app/otterly-alternatives/page.js';
import Saas, { metadata as saasMeta } from '../app/ai-visibility-for-saas/page.js';

const pages = [
  ['/how-to-check-if-chatgpt-mentions-your-brand', HowTo, howToMeta, 'How to check if ChatGPT mentions your brand'],
  ['/otterly-alternatives', Otterly, otterlyMeta, 'Otterly alternatives with public prices'],
  ['/ai-visibility-for-saas', Saas, saasMeta, 'AI visibility for SaaS'],
];

test('sitemap lists the three landing pages', () => {
  const urls = sitemap().map((entry) => entry.url);
  for (const [path] of pages) {
    assert.equal(urls.includes(`https://aivisibilitychecker.app${path}`), true, path);
  }
});

test('landing pages render metadata, copy, and JSON-LD', () => {
  for (const [path, Page, meta, heading] of pages) {
    assert.equal(meta.alternates.canonical, path);
    assert.equal(meta.description.length > 40, true);
    assert.equal(meta.openGraph.title, meta.title);
    assert.equal(meta.openGraph.type, 'article');
    assert.deepEqual(meta.openGraph.images, ['/opengraph-image']);
    const html = renderToStaticMarkup(createElement(Page));
    assert.equal(html.includes(`<h1>${heading}</h1>`), true, path);
    assert.equal(html.includes('application/ld+json'), true, path);
    assert.equal(html.includes('FAQPage'), true, path);
    assert.equal(html.includes('"@type":"Article"'), true, path);
    assert.equal(html.includes('Nov 12, 2026'), true, path);
    const forbiddenName = ['ChatGPT Business', 'Hub'].join(' ');
    assert.equal(html.includes(forbiddenName), false, path);
    assert.equal(html.toLowerCase().includes('business hub is free'), false, path);
    assert.equal(html.includes('does not state a price for Business Hub'), true, path);
    assert.equal(html.includes('$24/month'), true, path);
  }
});

test('the mentions guide renders the checker form and the real questions', () => {
  const html = renderToStaticMarkup(createElement(HowTo));
  assert.equal(html.includes('Check my AI visibility, free'), true);
  assert.equal(html.includes('What are the best CRM tools right now?'), true);
  assert.equal(html.includes('id="check"'), true);
  assert.equal(html.includes('HowTo'), true);
});

test('the Otterly page cites the pricing pages that were read', () => {
  const html = renderToStaticMarkup(createElement(Otterly));
  for (const url of [
    'https://otterly.ai/pricing',
    'https://peec.ai/pricing',
    'https://www.semrush.com/pricing/ai/',
    'https://keyword.com/pricing/',
    'https://rankscale.ai/pricing',
    'https://scrunch.com/pricing',
    'https://www.tryprofound.com/pricing',
    'https://apify.com/crunchy_galaxy_qcr/ai-visibility-tracker',
  ]) {
    assert.equal(html.includes(url), true, url);
  }
  assert.equal(html.includes('€29/month'), true);
  assert.equal(html.includes('Last checked'), true);
});
