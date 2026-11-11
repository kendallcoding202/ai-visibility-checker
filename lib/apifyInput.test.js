import test from 'node:test';
import assert from 'node:assert/strict';
import { trackerInput, citationInput, runCost, trackerCtaUrl, urlField, VIS_PRICE, CIT_PRICE, VIS_ENGINES, CIT_ENGINES } from './apifyInput.js';
import { TRACKER, CITATION, CITATIONS } from '../app/links.js';

const d = { brand: 'Mywa', category: 'WhatsApp Business API platform', rows: [{ prompt: 'a?' }, { prompt: 'b?' }, { prompt: 'c?' }],
  competitorHits: [], topBrands: [{ name: 'WATI', n: 3 }, { name: 'respond.io', n: 3 }] };

test('tracker input matches the Visibility actor schema and costs about $0.34', () => {
  const i = trackerInput(d);
  assert.deepEqual(Object.keys(i).sort(), ['brand', 'category', 'competitors', 'engines', 'prompts', 'samplesPerPrompt', 'trackingName']);
  assert.deepEqual(i.engines, VIS_ENGINES);
  assert.ok(i.engines.every((e) => ['chatgpt-search', 'chatgpt-knowledge', 'gemini-knowledge', 'perplexity-search'].includes(e)));
  assert.equal(i.prompts.length, 3); // explicit prompts => actor does not auto-generate more
  assert.equal(runCost(i, VIS_PRICE), 0.34);
  assert.equal(i.trackingName, 'mywa-weekly');
  assert.equal(trackerInput({ ...d, brand: 'A'.repeat(80) }).trackingName, `${'a'.repeat(60)}-weekly`);
});

test('citation input matches the Citation actor schema and costs $0.30', () => {
  const i = citationInput(d);
  assert.deepEqual(Object.keys(i).sort(), ['engines', 'prompts', 'samplesPerPrompt', 'yourDomains']);
  assert.deepEqual(i.engines, CIT_ENGINES);
  assert.deepEqual(i.engines, ['chatgpt', 'perplexity']);
  assert.ok(i.engines.every((e) => ['chatgpt', 'perplexity', 'google-ai-overview', 'google-ai-mode'].includes(e)));
  assert.equal(i.prompts.length, 3);
  assert.deepEqual(i.yourDomains, []);
  assert.equal(runCost(i, CIT_PRICE), 0.30);
});

test('CTA links are fixed apify.com URLs with UTM only, never user data', () => {
  for (const u of [TRACKER('result-cta'), CITATION('result-sources'), CITATIONS]) {
    const url = new URL(u);
    assert.equal(url.origin, 'https://apify.com');
    assert.ok(url.pathname.startsWith('/crunchy_galaxy_qcr/'));
    assert.deepEqual([...url.searchParams.keys()].sort(), ['utm_campaign', 'utm_content', 'utm_medium', 'utm_source']);
    assert.equal(url.searchParams.get('utm_source'), 'ai-visibility-checker');
    assert.equal(url.searchParams.get('utm_medium'), 'referral');
    assert.equal(url.searchParams.get('utm_campaign'), 'free-checker');
    assert.ok(!u.includes('Mywa'));
    assert.ok(!u.includes('WATI'));
  }
  assert.equal(CITATIONS, CITATION('footer'));
  assert.equal(new URL(CITATION('result-sources')).pathname, '/crunchy_galaxy_qcr/ai-citation-tracker');
  assert.equal(new URL(TRACKER('result-cta')).pathname, '/crunchy_galaxy_qcr/ai-visibility-tracker');
  assert.ok(VIS_ENGINES.length && CIT_ENGINES.length);
});

test('tracker CTA encodes a valid brand and category and ignores injection', () => {
  const href = trackerCtaUrl(d);
  const url = new URL(href);
  assert.equal(url.origin, 'https://apify.com');
  assert.equal(url.pathname, '/crunchy_galaxy_qcr/ai-visibility-tracker');
  assert.equal(url.searchParams.get('utm_source'), 'ai-visibility-checker');
  assert.equal(url.searchParams.get('utm_medium'), 'referral');
  assert.equal(url.searchParams.get('utm_campaign'), 'free-checker');
  assert.equal(url.searchParams.get('utm_content'), 'result-cta');
  assert.equal(url.searchParams.get('brand'), 'Mywa');
  assert.equal(url.searchParams.get('category'), 'WhatsApp Business API platform');
  assert.deepEqual([...url.searchParams.keys()].sort(), ['brand', 'category', 'utm_campaign', 'utm_content', 'utm_medium', 'utm_source']);
  assert.equal(href.includes('WATI'), false);
  assert.equal(href.includes('a?'), false);
  assert.equal(href.includes('respond.io'), false);

  const spaced = new URL(trackerCtaUrl({ brand: 'Acme & Co', category: "O'Reilly CRM" }));
  assert.equal(spaced.searchParams.get('brand'), 'Acme & Co');
  assert.equal(spaced.searchParams.get('category'), "O'Reilly CRM");
  assert.equal(spaced.href.includes('Acme & Co'), false);
  assert.equal(spaced.href.includes('&category'), true);
  assert.equal(spaced.origin, 'https://apify.com');
  assert.ok(spaced.href.includes('%26'));
  assert.ok(spaced.href.includes('%27'));

  const attacks = [
    'javascript:alert(1)',
    'https://evil.example',
    'Mywa&utm_source=evil',
    'Mywa?redirect=https://evil.example',
    '"><script>alert(1)</script>',
    'Mywa\nhttps://evil.example',
    'Mywa\r\nSet-Cookie: a=b',
    'Mywa#@evil.example',
    'A'.repeat(61),
    '  Mywa',
    'Mywa  Inc',
  ];
  for (const brand of attacks) {
    const attacked = new URL(trackerCtaUrl({ brand, category: 'project management', prompts: ['secret prompt'], competitors: ['WATI'] }));
    assert.equal(attacked.origin, 'https://apify.com');
    assert.equal(attacked.pathname, '/crunchy_galaxy_qcr/ai-visibility-tracker');
    assert.equal(attacked.searchParams.get('utm_source'), 'ai-visibility-checker');
    assert.equal(attacked.searchParams.get('brand'), null);
    assert.equal(attacked.searchParams.get('category'), 'project management');
    assert.equal(attacked.href.includes('evil'), false);
    assert.equal(attacked.href.includes('script'), false);
    assert.equal(attacked.href.includes('secret'), false);
    assert.equal(attacked.href.includes('WATI'), false);
    assert.equal([...attacked.searchParams.keys()].some((k) => !['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'brand', 'category'].includes(k)), false);
  }

  const traversal = new URL(trackerCtaUrl({ brand: '../admin', category: 'project management' }));
  assert.equal(traversal.origin, 'https://apify.com');
  assert.equal(traversal.pathname, '/crunchy_galaxy_qcr/ai-visibility-tracker');
  assert.equal(traversal.searchParams.get('brand'), '../admin');
  assert.equal(traversal.href.includes('../admin'), false);

  const dropped = new URL(trackerCtaUrl({ brand: 'Mywa', category: 'bad<script>' }));
  assert.equal(dropped.searchParams.get('brand'), 'Mywa');
  assert.equal(dropped.searchParams.get('category'), null);

  const fallback = new URL(trackerCtaUrl(d, 'result-cta&brand=evil'));
  assert.equal(fallback.searchParams.get('utm_content'), 'result-cta');
  assert.equal(fallback.searchParams.get('brand'), 'Mywa');
  assert.equal(urlField('Naïve', 60), 'Naïve');
  assert.equal(urlField({ brand: 'Mywa' }, 60), '');
  assert.equal(urlField('ab', 60), 'ab');
  assert.equal(urlField('', 60), '');
});
