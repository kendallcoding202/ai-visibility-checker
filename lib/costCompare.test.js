import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COST_AS_OF, COST_AS_OF_LABEL, freeChecker, tracker, otterly, keyword } from './costCompare.js';

test('comparison date and sources are the pages checked on Nov 10 2026', () => {
  assert.equal(COST_AS_OF, '2026-11-10');
  assert.equal(COST_AS_OF_LABEL, 'Nov 10 2026');
  assert.equal(tracker.source, 'https://apify.com/crunchy_galaxy_qcr/ai-visibility-tracker');
  assert.equal(otterly.source, 'https://otterly.ai/pricing');
  assert.equal(keyword.source, 'https://keyword.com/pricing/');
});

test('our side is free or pay per answer, with no monthly fee', () => {
  assert.equal(freeChecker.price, 0);
  assert.equal(freeChecker.checksPerIpPerDay, 3);
  assert.equal(tracker.pricePerAnswer, 0.04);
  assert.equal(tracker.currency, 'USD');
});

test('competitor rows are each vendor cheapest paid monthly plan', () => {
  assert.equal(otterly.plan, 'Lite');
  assert.equal(otterly.monthlyPrice, 29);
  assert.equal(otterly.currency, 'USD');
  assert.equal(keyword.plan, 'AI Visibility');
  assert.equal(keyword.monthlyPrice, 9.8);
  assert.equal(keyword.currency, 'USD');
  assert.equal(otterly.monthlyPrice < 489, true);
  assert.equal(keyword.monthlyPrice < 57, true);
  assert.equal(keyword.monthlyPrice === 4, false);
});

test('competitor data has no per-check, per-credit, or per-prompt math', () => {
  const blob = JSON.stringify({ otterly, keyword });
  for (const gone of ['0.91', '0.0143', '0.0098', '403', '50000', 'credits', 'prompts', 'chatgptCredits']) {
    assert.equal(blob.includes(gone), false, gone);
  }
  assert.equal(otterly.monthlyPrice === 489, false);
  assert.equal(keyword.monthlyPrice === 57, false);
  assert.equal(keyword.monthlyPrice === 15, false);
});
