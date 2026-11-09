import test from 'node:test';
import assert from 'node:assert/strict';
import { trackerInput, citationInput, runCost, VIS_PRICE, CIT_PRICE, VIS_ENGINES, CIT_ENGINES } from './apifyInput.js';
import { TRACKER, CITATION, CITATIONS } from '../app/links.js';

const d = { brand: 'Mywa', category: 'WhatsApp Business API platform', rows: [{ prompt: 'a?' }, { prompt: 'b?' }, { prompt: 'c?' }],
  competitorHits: [], topBrands: [{ name: 'WATI', n: 3 }, { name: 'respond.io', n: 3 }] };

test('tracker input matches the Visibility actor schema and costs $0.36', () => {
  const i = trackerInput(d);
  assert.deepEqual(Object.keys(i).sort(), ['brand', 'category', 'competitors', 'engines', 'prompts', 'samplesPerPrompt', 'trackingName']);
  assert.deepEqual(i.engines, VIS_ENGINES);
  assert.ok(i.engines.every((e) => ['chatgpt-search', 'chatgpt-knowledge', 'gemini-knowledge', 'perplexity-search'].includes(e)));
  assert.equal(i.prompts.length, 3); // explicit prompts => actor does not auto-generate more
  assert.equal(runCost(i, VIS_PRICE), 0.36);
  assert.equal(i.trackingName, 'mywa-weekly');
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
