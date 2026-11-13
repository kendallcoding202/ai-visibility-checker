// Atomic reservations for the free checker.
// Each counter is one Blob object updated with ifMatch (or create-if-absent).
// IP, then the global day cap, then the month budget. A later denial rolls back
// the earlier holds. A failed read or write denies the request and leaves any
// hold that could not be released in place, which blocks further spend.

import { mutateJSON, readJSON } from './store.js';
import {
  ipLimitMessage, LIMIT_GLOBAL, LIMIT_MONTH, LIMIT_UNAVAILABLE, money, spendDecision,
} from './limits.js';

const RESERVE_ATTEMPTS = 16;
const ADJUST_ATTEMPTS = 4;

function countOf(cur) {
  const n = Number(cur?.n ?? 0);
  return Number.isFinite(n) ? n : null;
}

function unavailable() {
  return { ok: false, status: 503, error: LIMIT_UNAVAILABLE };
}

async function takeCount(key, limit) {
  return mutateJSON(key, (cur) => {
    const n = countOf(cur);
    if (n == null) return { abort: true };
    if (n >= limit) return { deny: 'count' };
    return { value: { n: n + 1 } };
  }, { attempts: RESERVE_ATTEMPTS });
}

async function takeMoney(key, budget, reserve) {
  return mutateJSON(key, (cur) => {
    const n = countOf(cur);
    const spent = money(cur?.cost ?? 0);
    const hold = money(reserve);
    const ceiling = money(budget);
    if (n == null || !Number.isFinite(spent) || !Number.isFinite(hold) || !Number.isFinite(ceiling)) {
      return { abort: true };
    }
    if (money(spent + hold) > ceiling) return { deny: 'month' };
    return { value: { cost: money(spent + hold), n: n + 1 } };
  }, { attempts: RESERVE_ATTEMPTS });
}

async function releaseCount(key) {
  await mutateJSON(key, (cur) => {
    const n = countOf(cur);
    if (n == null) return { abort: true };
    return { value: { n: Math.max(0, n - 1) } };
  }, { attempts: ADJUST_ATTEMPTS });
}

async function releaseMonth(key, reserve, cost) {
  await mutateJSON(key, (cur) => {
    const prev = cur && typeof cur === 'object' ? cur : {};
    const n = countOf(prev);
    const spent = money(prev.cost ?? 0);
    const hold = money(reserve);
    const measured = money(cost);
    if (n == null || !Number.isFinite(spent) || !Number.isFinite(hold) || !Number.isFinite(measured)) {
      return { abort: true };
    }
    return {
      value: {
        ...prev,
        cost: money(Math.max(0, spent - hold + measured)),
        n: Math.max(0, n - 1),
      },
    };
  }, { attempts: ADJUST_ATTEMPTS });
}

/**
 * Reserve one free check or lookup. `ok: false` means do not call the model.
 * The error strings are the existing limit copy.
 */
export async function reserveSpend({ ipKey, dayKey, monthKey, perIp, cap, budget, reserve }) {
  const [ipRead, dayRead, monthRead] = await Promise.all([
    readJSON(ipKey), readJSON(dayKey), readJSON(monthKey),
  ]);
  if (!ipRead.ok || !dayRead.ok || !monthRead.ok) return unavailable();
  const preview = spendDecision({
    ipCount: ipRead.value?.n ?? 0,
    dayCount: dayRead.value?.n ?? 0,
    monthCost: monthRead.value?.cost ?? 0,
    perIp,
    cap,
    budget,
    reserve,
  });
  if (!preview.ok) return { ok: false, status: preview.status, error: preview.error };

  const held = [];
  const rollback = async () => {
    for (const key of held.reverse()) await releaseCount(key);
  };

  const ip = await takeCount(ipKey, perIp);
  if (!ip.ok) return ip.deny ? { ok: false, status: 429, error: ipLimitMessage(perIp) } : unavailable();
  held.push(ipKey);

  const day = await takeCount(dayKey, cap);
  if (!day.ok) {
    await rollback();
    return day.deny ? { ok: false, status: 429, error: LIMIT_GLOBAL } : unavailable();
  }
  held.push(dayKey);

  const month = await takeMoney(monthKey, budget, reserve);
  if (!month.ok) {
    await rollback();
    return month.deny ? { ok: false, status: 429, error: LIMIT_MONTH } : unavailable();
  }
  return { ok: true };
}

/** Re-read the reserved month. A missing or over-budget counter denies the call. */
export async function heldWithinBudget(monthKey, budget) {
  const held = await readJSON(monthKey);
  const spent = money(held.ok ? held.value?.cost : Number.NaN);
  const ceiling = money(budget);
  if (!held.ok || !Number.isFinite(spent) || !Number.isFinite(ceiling)) return unavailable();
  if (spent > ceiling) return { ok: false, status: 429, error: LIMIT_MONTH };
  return { ok: true };
}

/** Replace this call's reserve with the measured cost. A failed update keeps the reserve. */
export async function settleMonthCost(monthKey, reserve, cost) {
  const result = await mutateJSON(monthKey, (cur) => {
    const prev = cur && typeof cur === 'object' ? cur : null;
    if (!prev) return { abort: true };
    const spent = money(prev.cost ?? 0);
    const hold = money(reserve);
    const measured = money(cost);
    if (!Number.isFinite(spent) || !Number.isFinite(hold) || !Number.isFinite(measured)) return { abort: true };
    return { value: { ...prev, cost: money(Math.max(0, spent - hold + measured)) } };
  }, { attempts: ADJUST_ATTEMPTS });
  return result.ok;
}

/** Give back a reservation. Each key is released on its own; a failed key stays reserved. */
export async function refundSpend(ipKey, dayKey, monthKey, cost, reserve) {
  await releaseCount(ipKey);
  await releaseCount(dayKey);
  await releaseMonth(monthKey, reserve, cost);
}
