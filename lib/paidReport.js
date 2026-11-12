export const PAID_REPORT_PRICE = '$19';
export const PAID_REPORT_HEADING = 'One-time report';
export const PAID_REPORT_BODY = 'A written report of this check: the score, the three raw answers, the brands ChatGPT named, the cited sources, and what to fix. Pay once. No subscription.';
export const PAID_REPORT_NOTE = 'Checkout is not open yet.';

export function paidReportEnabled() {
  return process.env.PAID_REPORT_ENABLED === '1';
}
