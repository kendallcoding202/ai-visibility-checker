import { test } from 'node:test';
import assert from 'node:assert/strict';
import { localAuditPerIpDaily, localAuditGlobalDaily, estCostPerLocalCheck, localServiceBusinessEnabled } from './localLimits.js';

test('localAuditPerIpDaily returns default when env var not set', () => {
  const orig = process.env.LOCAL_AUDIT_PER_IP_DAILY;
  delete process.env.LOCAL_AUDIT_PER_IP_DAILY;
  assert.equal(localAuditPerIpDaily(), 2);
  if (orig !== undefined) process.env.LOCAL_AUDIT_PER_IP_DAILY = orig;
});

test('localAuditGlobalDaily returns default when env var not set', () => {
  const orig = process.env.LOCAL_AUDIT_GLOBAL_DAILY;
  delete process.env.LOCAL_AUDIT_GLOBAL_DAILY;
  assert.equal(localAuditGlobalDaily(), 10);
  if (orig !== undefined) process.env.LOCAL_AUDIT_GLOBAL_DAILY = orig;
});

test('estCostPerLocalCheck returns default when env var not set', () => {
  const orig = process.env.EST_COST_PER_LOCAL_CHECK;
  delete process.env.EST_COST_PER_LOCAL_CHECK;
  assert.equal(estCostPerLocalCheck(), 0.12);
  if (orig !== undefined) process.env.EST_COST_PER_LOCAL_CHECK = orig;
});

test('localServiceBusinessEnabled returns false when flag not set', () => {
  const orig = process.env.LOCAL_SERVICE_BUSINESS_ENABLED;
  delete process.env.LOCAL_SERVICE_BUSINESS_ENABLED;
  assert.equal(localServiceBusinessEnabled(), false);
  if (orig !== undefined) process.env.LOCAL_SERVICE_BUSINESS_ENABLED = orig;
});

test('localServiceBusinessEnabled returns true when flag is exactly 1', () => {
  const orig = process.env.LOCAL_SERVICE_BUSINESS_ENABLED;
  process.env.LOCAL_SERVICE_BUSINESS_ENABLED = '1';
  assert.equal(localServiceBusinessEnabled(), true);
  if (orig !== undefined) process.env.LOCAL_SERVICE_BUSINESS_ENABLED = orig;
  else delete process.env.LOCAL_SERVICE_BUSINESS_ENABLED;
});

test('localServiceBusinessEnabled returns false when flag is not 1', () => {
  const orig = process.env.LOCAL_SERVICE_BUSINESS_ENABLED;
  process.env.LOCAL_SERVICE_BUSINESS_ENABLED = 'true';
  assert.equal(localServiceBusinessEnabled(), false);
  if (orig !== undefined) process.env.LOCAL_SERVICE_BUSINESS_ENABLED = orig;
  else delete process.env.LOCAL_SERVICE_BUSINESS_ENABLED;
});

test('localAuditPerIpDaily reads env var', () => {
  const orig = process.env.LOCAL_AUDIT_PER_IP_DAILY;
  process.env.LOCAL_AUDIT_PER_IP_DAILY = '5';
  assert.equal(localAuditPerIpDaily(), 5);
  if (orig !== undefined) process.env.LOCAL_AUDIT_PER_IP_DAILY = orig;
  else delete process.env.LOCAL_AUDIT_PER_IP_DAILY;
});

test('localAuditGlobalDaily reads env var', () => {
  const orig = process.env.LOCAL_AUDIT_GLOBAL_DAILY;
  process.env.LOCAL_AUDIT_GLOBAL_DAILY = '20';
  assert.equal(localAuditGlobalDaily(), 20);
  if (orig !== undefined) process.env.LOCAL_AUDIT_GLOBAL_DAILY = orig;
  else delete process.env.LOCAL_AUDIT_GLOBAL_DAILY;
});
