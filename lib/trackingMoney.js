// Spend guard for paid weekly re-checks. This counter is not the free-checker budget.
import { money } from './limits.js';

/** Above one measured ChatGPT web-search check (about $0.087). Replaced with the measured cost. */
export const TRACKING_RESERVE_USD = 0.1;
export const TRACKING_WEEK_MS = 6 * 24 * 60 * 60 * 1000;

export function trackingMonthlyBudgetUsd() {
  const n = Number(process.env.TRACKING_MONTHLY_BUDGET_USD);
  return Number.isFinite(n) && n > 0 ? n : 10;
}

/** True when spent + reserve is within the tracking budget. Equal to the budget is allowed. */
export function trackingSpendAllowed(spent, reserve = TRACKING_RESERVE_USD, budget = trackingMonthlyBudgetUsd()) {
  const spentM = money(spent ?? 0);
  const hold = money(reserve);
  const ceiling = money(budget);
  if (!Number.isFinite(spentM) || !Number.isFinite(hold) || !Number.isFinite(ceiling)) return false;
  return money(spentM + hold) <= ceiling;
}

/** One successful re-check per subscriber per 6 days. */
export function weeklyRunAllowed(lastRunAt, now = Date.now()) {
  const t = Date.parse(lastRunAt ?? '');
  if (!Number.isFinite(t)) return true;
  return now - t >= TRACKING_WEEK_MS;
}

export function trackingSpendKey(month) {
  return `tracking-spend/${month}`;
}
