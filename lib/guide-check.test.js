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
