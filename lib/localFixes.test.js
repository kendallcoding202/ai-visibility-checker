import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateLocalBusinessSchema, generateFAQQuestions, generateLlmsTxt, generateRobotsTxt } from './localFixes.js';

test('generateLocalBusinessSchema includes business name and city', () => {
  const schema = generateLocalBusinessSchema('Smith Plumbing', 'plumber', 'Denver', 'CO');
  assert.equal(schema['@type'], 'LocalBusiness');
  assert.equal(schema.name, 'Smith Plumbing');
  assert.match(schema.description, /plumber.*Denver/);
  assert.equal(schema.address.addressLocality, 'Denver');
  assert.equal(schema.address.addressRegion, 'CO');
});

test('generateLocalBusinessSchema uses placeholders for unknown data', () => {
  const schema = generateLocalBusinessSchema('Smith Plumbing', 'plumber', 'Denver', 'CO');
  assert.match(schema.address.streetAddress, /YOUR_/);
  assert.match(schema.address.postalCode, /YOUR_/);
  assert.match(schema.telephone, /YOUR_/);
  assert.match(schema.openingHours, /YOUR_/);
});

test('generateLocalBusinessSchema does not invent ratings or reviews', () => {
  const schema = generateLocalBusinessSchema('Smith Plumbing', 'plumber', 'Denver', 'CO');
  assert.equal(schema.aggregateRating, undefined);
  assert.equal(schema.review, undefined);
});

test('generateFAQQuestions returns service and city-specific questions', () => {
  const questions = generateFAQQuestions('Smith Plumbing', 'plumber', 'Denver', 'CO');
  assert.ok(Array.isArray(questions));
  assert.ok(questions.length >= 3);
  assert.ok(questions.some((q) => q.includes('Smith Plumbing')));
  assert.ok(questions.some((q) => q.includes('Denver')));
});

test('generateFAQQuestions does not invent facts', () => {
  const questions = generateFAQQuestions('Smith Plumbing', 'plumber', 'Denver', 'CO');
  questions.forEach((q) => {
    assert.ok(!q.match(/\d+ years/), 'Should not invent years in business');
    assert.ok(!q.match(/\$\d+/), 'Should not invent prices');
    assert.ok(!q.match(/24\/7|24-7/), 'Should not invent hours');
  });
});

test('generateLlmsTxt includes business name and service', () => {
  const txt = generateLlmsTxt('Smith Plumbing', 'plumber', 'Denver', 'CO');
  assert.match(txt, /Smith Plumbing/);
  assert.match(txt, /plumber/);
  assert.match(txt, /Denver.*CO/);
});

test('generateLlmsTxt uses placeholders for contact info', () => {
  const txt = generateLlmsTxt('Smith Plumbing', 'plumber', 'Denver', 'CO');
  assert.match(txt, /YOUR_PHONE_NUMBER_HERE/);
  assert.match(txt, /YOUR_ADDRESS_HERE/);
  assert.match(txt, /YOUR_HOURS_HERE/);
});

test('generateRobotsTxt allows AI crawlers', () => {
  const txt = generateRobotsTxt();
  assert.match(txt, /User-agent: GPTBot/);
  assert.match(txt, /User-agent: ClaudeBot/);
  assert.match(txt, /User-agent: PerplexityBot/);
  assert.match(txt, /User-agent: OAI-SearchBot/);
  assert.match(txt, /User-agent: ChatGPT-User/);
  assert.match(txt, /Allow: \//);
});

test('generateRobotsTxt marks Google-Extended as optional', () => {
  const txt = generateRobotsTxt();
  assert.match(txt, /Google-Extended/);
  assert.match(txt, /Optional.*training/i);
});

test('generateRobotsTxt does not block any bots', () => {
  const txt = generateRobotsTxt();
  assert.ok(!txt.includes('Disallow'), 'Should not include any Disallow lines');
});
