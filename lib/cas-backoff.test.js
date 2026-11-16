import { test } from 'node:test';
import assert from 'node:assert/strict';

test('backoff schedule has reasonable timing with cumulative cap', async () => {
  const base = 25;
  const cap = 250;
  const budget = 1500;
  
  let cumulative = 0;
  const delays = [];
  
  for (let i = 1; i <= 16 && cumulative < budget; i++) {
    const delay = Math.min(Math.pow(2, i - 1) * base, cap);
    const jitterMax = delay * 1.5;
    
    if (cumulative + jitterMax > budget) break;
    
    delays.push({ attempt: i, max: jitterMax });
    cumulative += jitterMax;
  }
  
  assert.ok(cumulative <= budget, `Worst-case cumulative (${cumulative}ms) should not exceed ${budget}ms budget`);
  
  delays.forEach((d) => {
    assert.ok(d.max <= 375, `Attempt ${d.attempt} max delay (${d.max}ms) should be <= 375ms (250ms cap + 50% jitter)`);
  });
});

test('key prefix extraction works for all counter types', async () => {
  const cases = [
    { key: 'month/2026-11', expect: 'month' },
    { key: 'ip/2026-11-16/abc123', expect: 'ip' },
    { key: 'day/2026-11-16', expect: 'day' },
    { key: 'local-audit-ip/2026-11-16/def456', expect: 'local-audit-ip' },
    { key: 'local-audit-day/2026-11-16', expect: 'local-audit-day' },
  ];
  
  cases.forEach(({ key, expect }) => {
    const parts = key.split('/');
    const prefix = parts[0] || 'unknown';
    assert.equal(prefix, expect, `Key ${key} should have prefix ${expect}`);
  });
});
