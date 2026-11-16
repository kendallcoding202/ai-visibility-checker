import { test } from 'node:test';
import assert from 'node:assert/strict';
import { actionsFor, buildFixList } from './fixList.js';

test('actionsFor returns brand actions by default', () => {
  const actions = actionsFor('directory');
  assert.ok(actions.some((a) => a.includes('product')));
});

test('actionsFor returns local actions when mode is local', () => {
  const actions = actionsFor('directory', 'local');
  assert.ok(actions.some((a) => a.includes('Claim')));
  assert.ok(!actions.some((a) => a.includes('product')));
});

test('actionsFor returns local review actions', () => {
  const actions = actionsFor('review', 'local');
  assert.ok(actions.some((a) => a.includes('Claim')));
});

test('buildFixList with local mode returns local actions', () => {
  const result = {
    rows: [
      { mentioned: false, prompt: 'Test question', citations: [{ url: 'https://yelp.com/biz/test', title: 'Yelp' }] },
      { mentioned: true, prompt: 'Another question', citations: [] },
    ],
  };
  const fix = buildFixList(result, 'local');
  assert.ok(fix);
  assert.ok(fix.sites.length > 0);
  assert.ok(fix.sites[0].actions.some((a) => a.includes('Claim') || a.includes('listing')));
});

test('buildFixList with brand mode returns brand actions', () => {
  const result = {
    rows: [
      { mentioned: false, prompt: 'Test question', citations: [{ url: 'https://directory.com/test' }] },
      { mentioned: true, prompt: 'Another question', citations: [] },
    ],
  };
  const fix = buildFixList(result, 'brand');
  assert.ok(fix);
  assert.ok(fix.sites.length > 0);
  assert.ok(!fix.sites[0].actions.some((a) => a.includes('Claim your business listing')));
});
