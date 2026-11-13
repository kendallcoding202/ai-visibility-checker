// Keep model work, Blob retries, and the JSON response inside maxDuration.
// A platform kill returns an HTML 504 and cannot refund the reserved check.

function envMs(name, fallback, max) {
  const n = Number(process.env[name]);
  const ms = Number.isFinite(n) && n > 0 ? n : fallback;
  return Math.min(ms, max);
}

export const CHECK_MAX_DURATION_SEC = 120;
export const CHECK_TAIL_MS = 22_000;
export const CHECK_MARGIN_MS = 8_000;

export const LOOKUP_MAX_DURATION_SEC = 90;
export const LOOKUP_TAIL_MS = 16_000;
export const LOOKUP_MARGIN_MS = 8_000;

export function requestWindow({ started = Date.now(), maxDurationSec, budgetMs, tailMs, marginMs }) {
  const limit = started + maxDurationSec * 1000;
  const hardStop = limit - marginMs;
  const modelDeadline = Math.min(started + budgetMs, hardStop - tailMs);
  return { limit, hardStop, modelDeadline };
}

export function checkSchedule(started = Date.now()) {
  const budgetMs = envMs('CHECK_BUDGET_MS', 100_000, 100_000);
  const reserveMs = envMs('REFUND_RESERVE_MS', 12_000, 15_000);
  return {
    ...requestWindow({
      started,
      maxDurationSec: CHECK_MAX_DURATION_SEC,
      budgetMs,
      tailMs: CHECK_TAIL_MS,
      marginMs: CHECK_MARGIN_MS,
    }),
    budgetMs,
    reserveMs,
    tailMs: CHECK_TAIL_MS,
    marginMs: CHECK_MARGIN_MS,
    maxDurationSec: CHECK_MAX_DURATION_SEC,
  };
}

export function lookupSchedule(started = Date.now()) {
  const budgetMs = envMs('LOOKUP_DEADLINE_MS', 70_000, 70_000);
  const reserveMs = 8_000;
  return {
    ...requestWindow({
      started,
      maxDurationSec: LOOKUP_MAX_DURATION_SEC,
      budgetMs,
      tailMs: LOOKUP_TAIL_MS,
      marginMs: LOOKUP_MARGIN_MS,
    }),
    budgetMs,
    reserveMs,
    tailMs: LOOKUP_TAIL_MS,
    marginMs: LOOKUP_MARGIN_MS,
    maxDurationSec: LOOKUP_MAX_DURATION_SEC,
  };
}
