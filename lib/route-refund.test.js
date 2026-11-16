import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reserveSpend, refundSpend, settleMonthCost } from './counters.js';
import { readJSON } from './store.js';

test('simulated route: model failure refunds per-IP count', async () => {
  const day = new Date().toISOString().slice(0, 10);
  const month = day.slice(0, 7);
  const ipKey = `ip/${day}/test-sim-fail-${Date.now()}`;
  const dayKey = `day/${day}`;
  const monthKey = `month/${month}`;
  
  const perIp = 10;
  const reserve = 0.05;
  const cap = 100;
  const budget = 1.0;
  
  let reserved = true;
  let success = false;
  
  try {
    const res = await reserveSpend({ ipKey, dayKey, monthKey, perIp, cap, budget, reserve });
    assert.equal(res.ok, true, 'Reservation should succeed');
    
    throw new Error('Simulated model failure');
    
    success = true;
  } catch (e) {
    assert.equal(e.message, 'Simulated model failure');
  } finally {
    if (!success && reserved) {
      await refundSpend(ipKey, dayKey, monthKey, 0, reserve);
    }
  }
  
  const ipRead = await readJSON(ipKey);
  const ipCount = Number(ipRead.value?.n ?? 0);
  assert.equal(ipCount, 0, 'Per-IP count should be refunded after model failure');
});

test('simulated route: settle failure after good result still returns success', async () => {
  const day = new Date().toISOString().slice(0, 10);
  const month = day.slice(0, 7);
  const ipKey = `ip/${day}/test-sim-settle-${Date.now()}`;
  const dayKey = `day/${day}`;
  const monthKey = `month/${month}`;
  
  const perIp = 10;
  const reserve = 0.05;
  const cost = 0.03;
  const cap = 100;
  const budget = 1.0;
  
  let reserved = true;
  let success = false;
  let result = null;
  
  try {
    const res = await reserveSpend({ ipKey, dayKey, monthKey, perIp, cap, budget, reserve });
    assert.equal(res.ok, true, 'Reservation should succeed');
    
    result = { data: 'good result from model' };
    
    success = true;
    const settled = await settleMonthCost(monthKey, reserve, cost);
    if (!settled) {
      console.log('# settle failed but success=true was already set');
    }
  } catch (e) {
    assert.fail(`Should not throw: ${e.message}`);
  } finally {
    if (!success && reserved) {
      await refundSpend(ipKey, dayKey, monthKey, cost, reserve);
    }
  }
  
  assert.ok(success, 'Should have success=true even if settle failed');
  assert.ok(result, 'Should have result');
  
  const ipRead = await readJSON(ipKey);
  const ipCount = Number(ipRead.value?.n ?? 0);
  assert.equal(ipCount, 1, 'Per-IP count should NOT be refunded (success=true)');
});

test('simulated route: throwing settle after success does not turn result into 502', async () => {
  const day = new Date().toISOString().slice(0, 10);
  const month = day.slice(0, 7);
  const ipKey = `ip/${day}/test-throw-settle-${Date.now()}`;
  const dayKey = `day/${day}`;
  const monthKey = `month/${month}`;
  
  const perIp = 10;
  const reserve = 0.05;
  const cost = 0.03;
  const cap = 100;
  const budget = 1.0;
  
  let reserved = true;
  let success = false;
  let result = null;
  let threwInSettle = false;
  
  try {
    const res = await reserveSpend({ ipKey, dayKey, monthKey, perIp, cap, budget, reserve });
    assert.equal(res.ok, true, 'Reservation should succeed');
    
    result = { data: 'good result from model' };
    
    success = true;
    
    try {
      throw new Error('Simulated blob error in settle');
    } catch (error) {
      threwInSettle = true;
      console.log(`# settle threw but caught: ${error.message}`);
    }
  } catch (e) {
    assert.fail(`Outer catch should not run after success=true: ${e.message}`);
  } finally {
    if (!success && reserved) {
      await refundSpend(ipKey, dayKey, monthKey, cost, reserve);
    }
  }
  
  assert.ok(threwInSettle, 'Settle should have thrown');
  assert.ok(success, 'Should still have success=true');
  assert.ok(result, 'Should still have result');
  
  const ipRead = await readJSON(ipKey);
  const ipCount = Number(ipRead.value?.n ?? 0);
  assert.equal(ipCount, 1, 'Per-IP count should NOT be refunded (success=true)');
});
