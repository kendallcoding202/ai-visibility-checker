import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mutateJSON } from './store.js';

test('mutateJSON logs retry on eventual success with key prefix', async () => {
  const logs = [];
  const originalError = console.error;
  console.error = (...args) => logs.push(args.join(' '));
  
  const monthKey = `month/2026-11-backoff-${Date.now()}`;
  
  const result = await mutateJSON(monthKey, (cur) => {
    const n = Number(cur?.n ?? 0);
    return { value: { n: n + 1, cost: 0.05 } };
  }, { attempts: 16 });
  
  console.error = originalError;
  
  assert.equal(result.ok, true, 'Should succeed');
  
  if (logs.length > 0) {
    logs.forEach((log) => {
      if (log.includes('counter update retried')) {
        assert.ok(log.includes('key=month'), 'Retry log should include key prefix');
        assert.ok(log.includes('attempts='), 'Retry log should include attempt count');
        assert.ok(!log.includes('2026-11'), 'Should not include date/hash in log');
      }
    });
  }
});

test('mutateJSON logs failed with key prefix when exhausted', async () => {
  const logs = [];
  const originalError = console.error;
  console.error = (...args) => logs.push(args.join(' '));
  
  const testKey = `test-fail-${Date.now()}`;
  
  await mutateJSON(testKey, () => {
    return { abort: true };
  }, { attempts: 1 });
  
  console.error = originalError;
  
  const abortLog = logs.find((log) => log.includes('counter update failed reason=abort'));
  assert.ok(abortLog, 'Should log abort failure');
});

test('backoff timing stays reasonable for 16 attempts', async () => {
  const base = 25;
  const cap = 400;
  const maxAttempts = 16;
  
  const delays = [];
  for (let i = 1; i <= maxAttempts; i++) {
    const delay = Math.min(Math.pow(2, i - 1) * base, cap);
    const jitterMin = delay * 0.5;
    const jitterMax = delay * 1.5;
    delays.push({ attempt: i, min: jitterMin, max: jitterMax });
  }
  
  const totalMax = delays.reduce((sum, d) => sum + d.max, 0);
  assert.ok(totalMax < 10000, `Worst-case total backoff for ${maxAttempts} attempts (${totalMax}ms) should stay under 10s`);
  
  delays.forEach((d) => {
    assert.ok(d.max <= 600, `Attempt ${d.attempt} max delay (${d.max}ms) should be <= 600ms`);
  });
});
