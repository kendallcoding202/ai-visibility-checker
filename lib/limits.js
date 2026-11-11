// Shared spend controls for brand checks and market lookups.
// Counters live in the same Blob keys, so the two features cannot each spend the full cap.
// November 2026 is hard-capped at $50 even if an env var is set higher.

export const NOVEMBER_2026 = '2026-11';
export const NOVEMBER_2026_HARD_CAP_USD = 50;

function numEnv(name, fallback) {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function perIpDaily() {
  return numEnv('PER_IP_DAILY', 3);
}

export function globalDaily() {
  return numEnv('GLOBAL_DAILY', 25);
}

export function launchDays() {
  return (process.env.LAUNCH_DAYS ?? '2026-11-10,2026-11-11,2026-11-12')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function launchDaily() {
  return numEnv('LAUNCH_DAILY', 150);
}

export function dailyCap(day) {
  return launchDays().includes(day) ? launchDaily() : globalDaily();
}

export function monthlyBudgetUsd() {
  return numEnv('MONTHLY_BUDGET_USD', 10);
}

export function launchMonth() {
  return process.env.LAUNCH_MONTH ?? NOVEMBER_2026;
}

export function launchMonthlyBudgetUsd() {
  return numEnv('LAUNCH_MONTHLY_BUDGET_USD', 20);
}

/** USD reserved before a brand check. Replaced with the measured cost after success. */
export function estCostPerCheck() {
  return numEnv('EST_COST_PER_CHECK', 0.12);
}

/**
 * USD reserved before a market lookup. High enough that one web-search answer
 * plus brand extraction should land under it. Replaced with the measured cost.
 */
export function estCostPerLookup() {
  return numEnv('EST_COST_PER_LOOKUP', 0.12);
}

export function money(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return NaN;
  return Math.round(x * 1e6) / 1e6;
}

export function monthBudget(month) {
  const configured = month === launchMonth()
    ? Math.max(launchMonthlyBudgetUsd(), monthlyBudgetUsd())
    : monthlyBudgetUsd();
  if (month === NOVEMBER_2026) return Math.min(configured, NOVEMBER_2026_HARD_CAP_USD);
  return configured;
}

export const LIMIT_IP = "You've used your daily free checks. Come back tomorrow!";
export const LIMIT_GLOBAL = 'Free checks are used up for today. Please come back tomorrow!';
export const LIMIT_MONTH = 'The free checker has hit its monthly limit. Please come back next month, or use the full tracker below.';
export const LIMIT_UNAVAILABLE = 'The checker is temporarily unavailable. Please try again later.';

export function ipLimitMessage(perIp) {
  return `You've used your ${perIp} free checks for today. Come back tomorrow!`;
}

/**
 * Decide whether a paid call may start.
 * `spent`, `reserve`, and `budget` are USD. A non-finite number refuses the call.
 * The call is refused when spent + reserve would go over the budget (equal to the budget is allowed).
 */
export function spendDecision({ ipCount, dayCount, monthCost, perIp, cap, budget, reserve }) {
  const ip = Number(ipCount ?? 0);
  const day = Number(dayCount ?? 0);
  const spent = money(monthCost ?? 0);
  const hold = money(reserve);
  const ceiling = money(budget);
  if (!Number.isFinite(ip) || !Number.isFinite(day) || !Number.isFinite(spent) || !Number.isFinite(hold) || !Number.isFinite(ceiling)) {
    return { ok: false, status: 503, error: LIMIT_UNAVAILABLE };
  }
  if (ip >= perIp) return { ok: false, status: 429, error: ipLimitMessage(perIp) };
  if (day >= cap) return { ok: false, status: 429, error: LIMIT_GLOBAL };
  if (money(spent + hold) > ceiling) return { ok: false, status: 429, error: LIMIT_MONTH };
  return { ok: true, status: 200 };
}
