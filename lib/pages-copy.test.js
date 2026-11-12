import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name === '.git') continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (/\.(js|txt|md|css|mjs)$/.test(name)) out.push(path);
  }
  return out;
}

test('public copy does not use the forbidden product name or the old tracker price', () => {
  const files = walk(new URL(root).pathname);
  const hits = [];
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    const forbidden = ['ChatGPT Business', 'Hub'].join(' ');
    const oldDollar = ['$0.', '04'].join('');
    const oldPhrase = ['0.04', ' per'].join('');
    if (text.includes(forbidden)) hits.push(`${file} forbidden name`);
    if (text.includes(oldDollar) || text.includes(oldPhrase)) hits.push(`${file} old price`);
  }
  assert.deepEqual(hits, []);
});

test('the comparison page has metadata, citations, the new price, and a sitemap entry', () => {
  const page = readFileSync(new URL('../app/business-hub-vs-ai-visibility-tracker/page.js', import.meta.url), 'utf8');
  assert.equal(page.includes("canonical: '/business-hub-vs-ai-visibility-tracker'"), true);
  assert.equal(page.includes('dateModified: UPDATED'), true);
  assert.equal(page.includes("const UPDATED = '2026-11-11'"), true);
  for (const url of [
    'https://openai.com/index/introducing-businesses-chatgpt',
    'https://help.openai.com/en/articles/20001635-setting-up-your-business-on-chatgpt',
    'https://openai.com/business/businesses-in-chatgpt/',
    'https://ppc.land/businesses-gain-chatgpt-click-and-mention-counts-in-openais-business-hub/',
    'https://apify.com/crunchy_galaxy_qcr/ai-visibility-tracker',
  ]) {
    assert.equal(page.includes(url), true, url);
  }
  assert.equal(page.includes('$0.0375'), true);
  assert.equal(page.includes('$0.05 per answer'), true);
  const sitemap = readFileSync(new URL('../app/sitemap.js', import.meta.url), 'utf8');
  assert.equal(sitemap.includes('/business-hub-vs-ai-visibility-tracker'), true);
  const article = readFileSync(new URL('../app/what-chatgpt-business-dashboard-wont-tell-you/page.js', import.meta.url), 'utf8');
  assert.equal(article.includes('/business-hub-vs-ai-visibility-tracker'), true);
  const home = readFileSync(new URL('../app/page.js', import.meta.url), 'utf8');
  assert.equal(home.includes('/business-hub-vs-ai-visibility-tracker'), true);
  const result = readFileSync(new URL('../app/ResultClient.js', import.meta.url), 'utf8');
  assert.equal(result.includes('answers = about $'), true);
});

test('favicon.ico is a real icon file', () => {
  const buf = readFileSync(new URL('../public/favicon.ico', import.meta.url));
  assert.equal(buf.readUInt16LE(0), 0);
  assert.equal(buf.readUInt16LE(2), 1);
  assert.equal(buf.readUInt16LE(4) >= 1, true);
  const layout = readFileSync(new URL('../app/layout.js', import.meta.url), 'utf8');
  assert.equal(layout.includes("'/favicon.ico'"), true);
});

test('new comparison pages cite sources and do not price Business Hub', () => {
  const profound = readFileSync(new URL('../app/profound-alternatives/page.js', import.meta.url), 'utf8');
  const hub = readFileSync(new URL('../app/business-hub-vs-free-ai-visibility-checker/page.js', import.meta.url), 'utf8');
  const keyword = readFileSync(new URL('../app/ai-visibility-tracker-vs-keyword/page.js', import.meta.url), 'utf8');
  for (const url of [
    'https://www.tryprofound.com/pricing',
    'https://otterly.ai/pricing',
    'https://peec.ai/pricing',
    'https://www.semrush.com/pricing/ai/',
    'https://keyword.com/pricing/',
    'https://rankscale.ai/pricing',
    'https://writesonic.com/pricing',
    'https://scrunch.com/pricing',
    'https://www.athenahq.ai/pricing',
    'https://apify.com/crunchy_galaxy_qcr/ai-visibility-tracker',
  ]) {
    assert.equal(profound.includes(url), true, url);
  }
  assert.equal(profound.includes('Custom'), true);
  assert.equal(/Profound[^.]{0,80}\$[\d]/.test(profound), false);
  assert.equal(hub.includes('Not stated on the OpenAI pages cited here'), true);
  assert.equal(hub.toLowerCase().includes('business hub is free'), false);
  assert.equal(hub.toLowerCase().includes('free business hub'), false);
  assert.equal(keyword.includes('https://keyword.com/pricing/'), true);
  assert.equal(keyword.includes('$9.80/month'), true);
  const sitemap = readFileSync(new URL('../app/sitemap.js', import.meta.url), 'utf8');
  for (const path of ['/profound-alternatives', '/business-hub-vs-free-ai-visibility-checker', '/ai-visibility-tracker-vs-keyword']) {
    assert.equal(sitemap.includes(path), true, path);
  }
});
