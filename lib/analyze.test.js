import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeBrand, brandCore, brandsMatch, findMention, findBrandMention, buildPrompts } from './analyze.js';

test('normalizeBrand strips TLDs, punctuation, and descriptor suffixes', () => {
  assert.equal(normalizeBrand('Monday.com'), 'monday');
  assert.equal(normalizeBrand('monday AI Work Platform'), 'monday');
  assert.equal(normalizeBrand('HubSpot Inc.'), 'hubspot');
  assert.equal(normalizeBrand('Notion HQ'), 'notion');
  assert.equal(normalizeBrand('Asana'), 'asana');
  assert.equal(normalizeBrand('ClickUp'), 'clickup');
  assert.equal(normalizeBrand('www.example.io'), 'example');
});

test('brandCore returns the first significant token', () => {
  assert.equal(brandCore('Monday.com'), 'monday');
  assert.equal(brandCore('monday AI Work Platform'), 'monday');
});

test('Monday.com soft-matches extracted "monday AI Work Platform"', () => {
  assert.equal(brandsMatch('Monday.com', 'monday AI Work Platform'), true);
  assert.equal(brandsMatch('monday AI Work Platform', 'Monday.com'), true);
});

test('exact and near-exact brand matches', () => {
  assert.equal(brandsMatch('Asana', 'Asana'), true);
  assert.equal(brandsMatch('ClickUp', 'ClickUp'), true);
  assert.equal(brandsMatch('Click Up', 'ClickUp'), true);
  assert.equal(brandsMatch('HubSpot', 'HubSpot CRM'), true);
  assert.equal(brandsMatch('Notion', 'notion'), true);
});

test('does not false-positive on prefix-inside-word (Notion vs Notional)', () => {
  assert.equal(brandsMatch('Notion', 'Notional'), false);
  assert.equal(brandsMatch('Notional', 'Notion'), false);
  assert.equal(brandsMatch('Cat', 'Catalyst'), false);
  assert.equal(brandsMatch('Ada', 'Adaptive'), false);
});

test('short names do not fuzzy-match broadly', () => {
  assert.equal(brandsMatch('AI', 'OpenAI'), false);
  assert.equal(brandsMatch('Go', 'Golang'), false);
  assert.equal(brandsMatch('AI', 'AI'), true);
});

test('distinct competitors do not match each other', () => {
  assert.equal(brandsMatch('Asana', 'ClickUp'), false);
  assert.equal(brandsMatch('Monday.com', 'Asana'), false);
  assert.equal(brandsMatch('Monday.com', 'ClickUp'), false);
  assert.equal(brandsMatch('Notion', 'Asana'), false);
});

test('findBrandMention finds core token when TLD form is absent', () => {
  const text = 'Teams often pick Monday for roadmaps, then Asana for tasks.';
  assert.equal(findMention(text, 'Monday.com') < 0, true);
  assert.ok(findBrandMention(text, 'Monday.com') >= 0);
  assert.ok(findBrandMention(text, 'Asana') >= 0);
  assert.equal(findBrandMention(text, 'ClickUp') < 0, true);
});

test('findBrandMention keeps word boundaries (no Notion→Notional)', () => {
  const text = 'Notional Finance is unrelated to docs software.';
  assert.equal(findBrandMention(text, 'Notion') < 0, true);
  assert.ok(findBrandMention('I use Notion every day.', 'Notion') >= 0);
});

test('replay: competitorHits logic on cached Notion extraction', () => {
  // From live E2E 2026-11-05: Monday.com was 0/3 under exact findMention;
  // extracted brands listed "monday AI Work Platform" in answers 0 and 2.
  const competitors = ['Asana', 'Monday.com', 'ClickUp'];
  const rows = [
    { brands: ['Asana', 'monday AI Work Platform', 'ClickUp', 'Smartsheet', 'Jira'], text: 'Asana and ClickUp lead.' },
    { brands: ['Asana', 'ClickUp', 'Trello'], text: 'Asana, ClickUp, Trello.' },
    { brands: ['Asana', 'Jira', 'Smartsheet', 'monday AI Work Platform', 'ClickUp', 'Wrike'], text: 'Asana and ClickUp again.' },
  ];
  const hits = competitors.map((c) => ({
    name: c,
    mentionedIn: rows.filter((r) => findBrandMention(r.text, c) >= 0 || r.brands.some((b) => brandsMatch(c, b))).length,
  }));
  assert.deepEqual(hits, [
    { name: 'Asana', mentionedIn: 3 },
    { name: 'Monday.com', mentionedIn: 2 },
    { name: 'ClickUp', mentionedIn: 3 },
  ]);
});

test('buildPrompts uses the category, or the brand alone when the category is blank', () => {
  const withCategory = buildPrompts('project management', 'Notion');
  assert.equal(withCategory.length, 3);
  assert.equal(withCategory[0].includes('project management'), true);
  assert.equal(withCategory[0].includes('Notion'), false);
  const brandOnly = buildPrompts('', 'Notion');
  assert.equal(brandOnly.length, 3);
  assert.equal(brandOnly.every((p) => p.includes('Notion')), true);
  assert.equal(brandOnly.some((p) => p.includes('project management')), false);
});
