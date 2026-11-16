import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reserveLocalAudit, refundLocalAudit } from './counters.js';

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
    assert.ok(r.error.includes('used up') || r.error.includes('busy'));
    assert.ok(!r.error.includes('temporarily unavailable'), 'Should not use generic unavailable message');
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

test('reserveLocalAudit returns helpful error message on conflict/busy', async () => {
  const day = `2026-11-16-${Date.now()}`;
  const baseKey = `test-conflict-${Date.now()}`;
  
  const results = await Promise.all(
    Array.from({ length: 20 }, (_, i) => 
      reserveLocalAudit(
        `local-audit-ip/${day}/${baseKey}-${i}`,
        `local-audit-day/${day}`,
        10,
        2
      )
    )
  );
  
  const succeeded = results.filter((r) => r.ok);
  const failed = results.filter((r) => !r.ok);
  
  assert.ok(succeeded.length >= 2, 'At least some should succeed');
  assert.ok(failed.length > 0, 'Some should fail due to cap or concurrency');
  
  failed.forEach((r) => {
    if (r.status === 503) {
      assert.match(r.error, /busy.*try again/i, 'Busy error should suggest retry');
    } else if (r.status === 429) {
      assert.match(r.error, /used up|Come back/i, 'Limit error should explain cap');
    }
  });
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
