import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  EVENTS, MAX_PROPS, categoryBucket, referrerHost, eventProps,
  errorTypeFromStatus, limitReason, trackEvent,
} from './analyticsEvents.js';

test('categoryBucket maps coarse industries and never returns raw input', () => {
  assert.equal(categoryBucket('project management software'), 'productivity');
  assert.equal(categoryBucket('CRM for realtors'), 'sales');
  assert.equal(categoryBucket('ecommerce checkout'), 'ecommerce');
  assert.equal(categoryBucket('SEO agency'), 'marketing');
  assert.equal(categoryBucket('personal injury law firm'), 'legal');
  assert.equal(categoryBucket(''), 'other');
  const raw = 'Acme Dental of Denver — secret brand 555-0100 user@example.com';
  const bucket = categoryBucket(raw);
  assert.equal(bucket, 'other');
  assert.equal(bucket.includes('Acme'), false);
  assert.equal(bucket.includes('Denver'), false);
  assert.equal(bucket.includes('user@example.com'), false);
});

test('eventProps drops raw brand, email, IP, and unknown keys', () => {
  const props = eventProps({
    named: true,
    engine: 'chatgpt',
    brand: 'Notion',
    category: 'project management',
    email: 'owner@example.com',
    ip: '203.0.113.44',
    input: 'free text from the form',
    id: 'abcdef123456abcdef123456',
  });
  assert.deepEqual(props, { named: true, engine: 'chatgpt' });
  const serialized = JSON.stringify(props);
  assert.equal(serialized.includes('Notion'), false);
  assert.equal(serialized.includes('owner@example.com'), false);
  assert.equal(serialized.includes('203.0.113.44'), false);
  assert.equal(serialized.includes('project management'), false);
  assert.equal(serialized.includes('abcdef'), false);
});

test('eventProps caps at MAX_PROPS and allowlists values', () => {
  assert.equal(MAX_PROPS, 8);
  const props = eventProps({
    named: 1,
    engine: 'not-an-engine',
    cached: 0,
    source: 'home',
    has_competitors: 'yes',
    category_bucket: categoryBucket('project management'),
    reason: 'ip_daily',
    type: 'network',
    location: 'result-cta',
    channel: 'x',
    extra: 'nope',
  });
  assert.equal(Object.keys(props).length, 8);
  assert.equal(props.engine, 'unknown');
  assert.equal(props.named, true);
  assert.equal(props.cached, false);
  assert.equal(props.has_competitors, true);
  assert.equal(props.category_bucket, 'productivity');
  assert.equal(props.reason, 'ip_daily');
  assert.equal(props.type, 'network');
  assert.equal('location' in props, false);
  assert.equal('channel' in props, false);
  assert.equal('extra' in props, false);
});

test('referrerHost keeps only hostnames', () => {
  assert.equal(referrerHost(''), 'direct');
  assert.equal(referrerHost('https://www.producthunt.com/posts/ai-visibility-checker-9?utm_source=ph'), 'www.producthunt.com');
  assert.equal(referrerHost('https://t.co/abc?foo=bar'), 't.co');
  assert.equal(referrerHost('not a url'), 'other');
  assert.equal(referrerHost('https://localhost/secret'), 'direct');
});

test('utm_source is sanitized', () => {
  assert.equal(eventProps({ utm_source: 'producthunt' }).utm_source, 'producthunt');
  assert.equal(eventProps({ utm_source: 'PH Launch!' }).utm_source, 'other');
  assert.equal(eventProps({ utm_source: '' }).utm_source, 'none');
  assert.equal(eventProps({ utm_source: 'https://evil.example/steal' }).utm_source, 'other');
});

test('limitReason and errorTypeFromStatus use coarse codes', () => {
  assert.equal(limitReason(429, "You've used your 3 free checks for today. Come back tomorrow!"), 'ip_daily');
  assert.equal(limitReason(429, 'Free checks are used up for today. Please come back tomorrow!'), 'global_daily');
  assert.equal(limitReason(429, 'The free checker has hit its monthly limit. Please come back next month, or use the full tracker below.'), 'monthly_budget');
  assert.equal(limitReason(400, 'Enter a brand name and a category.'), null);
  assert.equal(errorTypeFromStatus(400), 'validation');
  assert.equal(errorTypeFromStatus(403), 'forbidden');
  assert.equal(errorTypeFromStatus(502), 'failed');
  assert.equal(errorTypeFromStatus(503), 'unavailable');
  assert.equal(errorTypeFromStatus(429), null);
});

test('trackEvent only sends allowlisted names and props, and swallows errors', async () => {
  const calls = [];
  await trackEvent((name, props) => { calls.push({ name, props }); }, EVENTS.RESULT_VIEWED, {
    named: false, engine: 'chatgpt', brand: 'SecretCo',
  });
  assert.deepEqual(calls, [{ name: 'result_viewed', props: { named: false, engine: 'chatgpt' } }]);
  await trackEvent(() => { throw new Error('network'); }, EVENTS.CHECK_ERROR, { type: 'network' });
  await trackEvent((name, props) => { calls.push({ name, props }); }, 'not_a_real_event', { type: 'network' });
  assert.equal(calls.length, 1);
});
