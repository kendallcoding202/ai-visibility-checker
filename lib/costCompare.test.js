import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPrompts } from './analyze.js';
import {
  COST_AS_OF, freeChecker, tracker, otterlyPremium, keywordCredits, per, usd,
} from './costCompare.js';

test('comparison date and sources are the pages checked on 2026-11-10', () => {
  assert.equal(COST_AS_OF, '2026-11-10');
  assert.equal(tracker.source, 'https://apify.com/crunchy_galaxy_qcr/ai-visibility-tracker');
  assert.equal(otterlyPremium.source, 'https://otterly.ai/pricing');
  assert.equal(keywordCredits.source, 'https://keyword.com/pricing/');
});

test('free checker and tracker units stay the published ones', () => {
  assert.equal(freeChecker.price, 0);
  assert.equal(freeChecker.checksPerIpPerDay, 3);
  assert.equal(freeChecker.questionsPerCheck, buildPrompts('crm').length);
  assert.equal(tracker.pricePerAnswer, 0.04);
  assert.equal(usd(tracker.pricePerAnswer), '$0.04');
  assert.equal(tracker.currency, 'USD');
  assert.equal(per(tracker.storeFromPrice, tracker.storeFromAnswers), 0.028);
});

test('Otterly Premium per-prompt and per-credit figures are price divided by the plan', () => {
  assert.equal(otterlyPremium.price, 489);
  assert.equal(otterlyPremium.prompts, 403);
  assert.equal(otterlyPremium.credits, 50000);
  assert.equal(per(otterlyPremium.price, otterlyPremium.prompts), 489 / 403);
  assert.equal(usd(per(otterlyPremium.price, otterlyPremium.prompts)), '$1.21');
  assert.equal(per(otterlyPremium.price, otterlyPremium.credits), 489 / 50000);
  assert.equal(usd(per(otterlyPremium.price, otterlyPremium.credits)), '$0.0098');
  const creditsPerPrompt = otterlyPremium.credits / otterlyPremium.prompts;
  const dailyFour = otterlyPremium.dailyCreditsPerEngine * otterlyPremium.enginesOnCard;
  assert.ok(Math.abs(creditsPerPrompt - dailyFour) < 1);
  assert.equal(otterlyPremium.claudeCredits, 3);
});

test('Keyword.com 1,000-credit tier converts ChatGPT runs at 0.25 credits', () => {
  assert.equal(keywordCredits.price, 57);
  assert.equal(keywordCredits.credits, 1000);
  assert.equal(keywordCredits.billing, 'monthly');
  assert.equal(keywordCredits.chatgptCreditsPerRun, 0.25);
  const checks = per(keywordCredits.credits, keywordCredits.chatgptCreditsPerRun);
  assert.equal(checks, 4000);
  assert.equal(per(keywordCredits.price, checks), 57 / 4000);
  assert.equal(usd(per(keywordCredits.price, checks)), '$0.0143');
});

test('hearsay figures that were not on the vendor pages are not in the data', () => {
  const blob = JSON.stringify({ freeChecker, tracker, otterlyPremium, keywordCredits });
  assert.equal(blob.includes('0.91'), false);
  assert.equal(blob.includes('"price":15'), false);
  assert.equal(keywordCredits.price === 15, false);
});
