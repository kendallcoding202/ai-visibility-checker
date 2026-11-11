import { test } from 'node:test';
import assert from 'node:assert/strict';
import { monthBudget, money, spendDecision, NOVEMBER_2026_HARD_CAP_USD, estCostPerLookup } from './limits.js';

const KEYS = ['LAUNCH_MONTHLY_BUDGET_USD', 'MONTHLY_BUDGET_USD', 'LAUNCH_MONTH', 'EST_COST_PER_LOOKUP'];

async function withEnv(overrides, fn) {
  const prev = new Map(KEYS.map((key) => [key, process.env[key]]));
  for (const key of KEYS) {
    if (!Object.hasOwn(overrides, key) || overrides[key] == null) delete process.env[key];
    else process.env[key] = overrides[key];
  }
  try {
    return await fn();
  } finally {
    for (const key of KEYS) {
      const value = prev.get(key);
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test('November 2026 budget cannot exceed $50', async () => {
  assert.equal(NOVEMBER_2026_HARD_CAP_USD, 50);
  await withEnv({ LAUNCH_MONTHLY_BUDGET_USD: '50', LAUNCH_MONTH: '2026-11' }, async () => {
    assert.equal(monthBudget('2026-11'), 50);
  });
  await withEnv({ LAUNCH_MONTHLY_BUDGET_USD: '80', MONTHLY_BUDGET_USD: '100', LAUNCH_MONTH: '2026-11' }, async () => {
    assert.equal(monthBudget('2026-11'), 50);
  });
  await withEnv({ LAUNCH_MONTHLY_BUDGET_USD: '20', LAUNCH_MONTH: '2026-11' }, async () => {
    assert.equal(monthBudget('2026-11'), 20);
  });
  await withEnv({ LAUNCH_MONTH: '2026-11', MONTHLY_BUDGET_USD: '10' }, async () => {
    assert.equal(monthBudget('2026-12'), 10);
  });
});

test('spendDecision fails closed on limits, budget, and bad numbers', () => {
  const base = { ipCount: 0, dayCount: 0, monthCost: 0, perIp: 3, cap: 150, budget: 50, reserve: 0.12 };
  assert.equal(spendDecision(base).ok, true);
  assert.equal(spendDecision({ ...base, ipCount: 3 }).status, 429);
  assert.equal(spendDecision({ ...base, dayCount: 150 }).status, 429);
  assert.equal(spendDecision({ ...base, monthCost: 49.9 }).status, 429);
  assert.equal(spendDecision({ ...base, monthCost: 49.88 }).ok, true);
  assert.equal(money(49.88) + money(0.12) > 50 || spendDecision({ ...base, monthCost: 49.88 }).ok, true);
  assert.equal(spendDecision({ ...base, monthCost: 50 }).status, 429);
  assert.equal(spendDecision({ ...base, monthCost: Number.NaN }).status, 503);
  assert.equal(spendDecision({ ...base, budget: Number.NaN }).status, 503);
  assert.equal(estCostPerLookup() > 0, true);
});
