import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reserveSpend, refundSpend, settleMonthCost } from './counters.js';

test('failed check refunds per-IP count allowing full allowance', async () => {
  const day = `2026-11-16-${Date.now()}`;
  const month = day.slice(0, 7);
  const ipKey = `ip/${day}/test-refund-ip-${Date.now()}`;
  const dayKey = `day/${day}`;
  const monthKey = `month/${month}`;
  
  const perIp = 3;
  const reserve = 0.05;
  const budget = 1.0;
  const cap = 100;
  
  const r1 = await reserveSpend({ ipKey, dayKey, monthKey, perIp, cap, budget, reserve });
  assert.equal(r1.ok, true, 'First reservation should succeed');
  await refundSpend(ipKey, dayKey, monthKey, 0, reserve);
  
  const r2 = await reserveSpend({ ipKey, dayKey, monthKey, perIp, cap, budget, reserve });
  assert.equal(r2.ok, true, 'After refund, second reservation should succeed');
  await refundSpend(ipKey, dayKey, monthKey, 0, reserve);
  
  const r3 = await reserveSpend({ ipKey, dayKey, monthKey, perIp, cap, budget, reserve });
  assert.equal(r3.ok, true, 'After second refund, third should succeed (failed attempts dont count)');
  await settleMonthCost(monthKey, reserve, 0.03);
  
  const r4 = await reserveSpend({ ipKey, dayKey, monthKey, perIp, cap, budget, reserve });
  assert.equal(r4.ok, true, 'Fourth should succeed (only 1 successful so far)');
  await settleMonthCost(monthKey, reserve, 0.03);
  
  const r5 = await reserveSpend({ ipKey, dayKey, monthKey, perIp, cap, budget, reserve });
  assert.equal(r5.ok, true, 'Fifth should succeed (2 successful so far)');
  await settleMonthCost(monthKey, reserve, 0.03);
  
  const r6 = await reserveSpend({ ipKey, dayKey, monthKey, perIp, cap, budget, reserve });
  assert.equal(r6.ok, false, 'Sixth should fail (hit per-IP limit of 3)');
  assert.equal(r6.status, 429);
});

test('multiple failed attempts do not consume allowance', async () => {
  const day = `2026-11-16-${Date.now()}`;
  const month = day.slice(0, 7);
  const base = `test-multiple-${Date.now()}`;
  const ipKey = `ip/${day}/${base}`;
  const dayKey = `day/${day}`;
  const monthKey = `month/${month}`;
  
  const perIp = 2;
  
  for (let i = 0; i < 5; i++) {
    const r = await reserveSpend({ ipKey, dayKey, monthKey, perIp, cap: 100, budget: 1.0, reserve: 0.05 });
    assert.equal(r.ok, true, `Attempt ${i + 1} should succeed after previous refunds`);
    await refundSpend(ipKey, dayKey, monthKey, 0, 0.05);
  }
  
  const finalReserve = await reserveSpend({ ipKey, dayKey, monthKey, perIp, cap: 100, budget: 1.0, reserve: 0.05 });
  assert.equal(finalReserve.ok, true, 'Final attempt should succeed (no failed attempts counted)');
});
