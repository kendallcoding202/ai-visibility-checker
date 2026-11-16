// Separate rate limits for local business website audits.

function numEnv(name, fallback) {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function localAuditPerIpDaily() {
  return numEnv('LOCAL_AUDIT_PER_IP_DAILY', 2);
}

export function localAuditGlobalDaily() {
  return numEnv('LOCAL_AUDIT_GLOBAL_DAILY', 30);
}

export function estCostPerLocalCheck() {
  return numEnv('EST_COST_PER_LOCAL_CHECK', 0.12);
}

export function localServiceBusinessEnabled() {
  return process.env.LOCAL_SERVICE_BUSINESS_ENABLED === '1';
}

export const LIMIT_LOCAL_AUDIT_IP = "You've used your free website audits for today. Come back tomorrow!";
export const LIMIT_LOCAL_AUDIT_GLOBAL = 'Website audits are used up for today. Please come back tomorrow!';
