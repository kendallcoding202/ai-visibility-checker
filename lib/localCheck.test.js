import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseLocalInput, buildLocalPrompts, normalizeWebsite } from './localCheck.js';

test('parseLocalInput accepts valid inputs', () => {
  const result = parseLocalInput({
    businessName: 'Smith Plumbing',
    service: 'plumber',
    city: 'Denver',
    state: 'CO',
    website: 'https://example.com',
  });
  assert.equal(result.error, undefined);
  assert.equal(result.businessName, 'Smith Plumbing');
  assert.equal(result.service, 'plumber');
  assert.equal(result.city, 'Denver');
  assert.equal(result.state, 'CO');
  assert.equal(result.website, 'https://example.com/');
});

test('parseLocalInput rejects missing business name', () => {
  const result = parseLocalInput({ businessName: '', service: 'plumber', city: 'Denver', state: 'CO' });
  assert.ok(result.error);
  assert.match(result.error, /business name/i);
});

test('parseLocalInput rejects missing service', () => {
  const result = parseLocalInput({ businessName: 'Smith Plumbing', service: '', city: 'Denver', state: 'CO' });
  assert.ok(result.error);
  assert.match(result.error, /service/i);
});

test('parseLocalInput rejects missing city', () => {
  const result = parseLocalInput({ businessName: 'Smith Plumbing', service: 'plumber', city: '', state: 'CO' });
  assert.ok(result.error);
  assert.match(result.error, /city/i);
});

test('parseLocalInput rejects invalid state', () => {
  const result = parseLocalInput({ businessName: 'Smith Plumbing', service: 'plumber', city: 'Denver', state: 'XX' });
  assert.ok(result.error);
  assert.match(result.error, /state/i);
});

test('parseLocalInput rejects junk characters', () => {
  const result = parseLocalInput({ businessName: 'Smith<script>', service: 'plumber', city: 'Denver', state: 'CO' });
  assert.ok(result.error);
  assert.match(result.error, /plain letters/i);
});

test('parseLocalInput accepts empty website', () => {
  const result = parseLocalInput({ businessName: 'Smith Plumbing', service: 'plumber', city: 'Denver', state: 'CO', website: '' });
  assert.equal(result.error, undefined);
  assert.equal(result.website, '');
});

test('parseLocalInput normalizes website URL', () => {
  const result = parseLocalInput({ businessName: 'Smith Plumbing', service: 'plumber', city: 'Denver', state: 'CO', website: 'example.com' });
  assert.equal(result.error, undefined);
  assert.equal(result.website, 'https://example.com/');
});

test('parseLocalInput rejects website with credentials', () => {
  const result = parseLocalInput({ businessName: 'Smith Plumbing', service: 'plumber', city: 'Denver', state: 'CO', website: 'https://user:pass@example.com' });
  assert.equal(result.error, undefined);
  assert.equal(result.website, '');
});

test('parseLocalInput rejects non-http(s) website', () => {
  const result = parseLocalInput({ businessName: 'Smith Plumbing', service: 'plumber', city: 'Denver', state: 'CO', website: 'ftp://example.com' });
  assert.equal(result.error, undefined);
  assert.equal(result.website, '');
});

test('buildLocalPrompts returns city-based questions', () => {
  const prompts = buildLocalPrompts('plumber', 'Denver', 'CO', 'Smith Plumbing');
  assert.equal(prompts.length, 3);
  assert.match(prompts[0], /Denver.*CO/);
  assert.match(prompts[1], /Denver/);
  assert.match(prompts[2], /Denver.*CO/);
});

test('normalizeWebsite lowercases hostname', () => {
  assert.equal(normalizeWebsite('https://Example.COM/Path'), 'https://example.com/Path');
});

test('normalizeWebsite returns empty for invalid URL', () => {
  assert.equal(normalizeWebsite('not-a-url'), '');
});

test('normalizeWebsite returns empty for empty input', () => {
  assert.equal(normalizeWebsite(''), '');
});
