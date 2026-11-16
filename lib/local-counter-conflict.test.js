import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reserveLocalAudit, refundLocalAudit } from './counters.js';
import { mutateJSON } from './store.js';

test('sequential mutateJSON calls on same key succeed with cache-busting', async () => {
  const monthKey = `month/2026-11-sequential-${Date.now()}`;
  
  const first = await mutateJSON(monthKey, (cur) => {
    const n = Number(cur?.n ?? 0);
    return { value: { n: n + 1, cost: 0.05 } };
  }, { attempts: 16 });
  assert.equal(first.ok, true, 'First write should succeed');
  
  const second = await mutateJSON(monthKey, (cur) => {
    const spent = Number(cur?.cost ?? 0);
    return { value: { ...cur, cost: spent + 0.03 } };
  }, { attempts: 16 });
  
  assert.equal(second.ok, true, 'Sequential mutate should succeed with cache-busting fix');
});

test('parallel local audit reservations handle concurrency correctly', async () => {
  const day = `2026-11-16-${Date.now()}`;
  const baseKey = `test-parallel-${Date.now()}`;
  const cap = 5;
  
  const reservations = await Promise.all(
    Array.from({ length: 10 }, (_, i) => 
      reserveLocalAudit(
        `local-audit-ip/${day}/${baseKey}-${i}`,
        `local-audit-day/${day}`,
        10,
        cap
      )
    )
  );
  
  const succeeded = reservations.filter((r) => r.ok);
  assert.ok(succeeded.length <= cap, `Should not exceed cap of ${cap}, got ${succeeded.length}`);
  
  const failed = reservations.filter((r) => !r.ok);
  assert.ok(failed.length > 0, 'Some reservations should fail when cap is reached');
  
  failed.forEach((r) => {
    assert.ok(r.status === 429 || r.status === 503);
    assert.ok(!r.error.includes('!'), 'Error messages should not have exclamation marks');
  });
});

test('refundLocalAudit does not throw on error', async () => {
  const day = `2026-11-16-${Date.now()}`;
  const auditIpKey = `local-audit-ip/${day}/test-refund-${Date.now()}`;
  const auditDayKey = `local-audit-day/${day}-refund-${Date.now()}`;

  const result = await reserveLocalAudit(auditIpKey, auditDayKey, 10, 100);
  assert.equal(result.ok, true);

  let didThrow = false;
  try {
    await refundLocalAudit(auditIpKey, auditDayKey);
  } catch (err) {
    didThrow = true;
  }
  
  assert.equal(didThrow, false, 'refundLocalAudit should not throw');
});

test('audit reservation failure does not leave counters incremented', async () => {
  const day = `2026-11-16-${Date.now()}`;
  const baseKey = `test-rollback-${Date.now()}`;
  const auditIpKey = `local-audit-ip/${day}/${baseKey}`;
  const auditDayKey = `local-audit-day/${day}`;
  
  const result1 = await reserveLocalAudit(auditIpKey, auditDayKey, 1, 100);
  assert.equal(result1.ok, true, 'First should succeed');
  
  const result2 = await reserveLocalAudit(auditIpKey, auditDayKey, 1, 100);
  assert.equal(result2.ok, false, 'Second should fail (IP limit)');
  assert.equal(result2.status, 429);
  
  await refundLocalAudit(auditIpKey, auditDayKey);
  
  const result3 = await reserveLocalAudit(auditIpKey, auditDayKey, 1, 100);
  assert.equal(result3.ok, true, 'After refund, should succeed again');
});
