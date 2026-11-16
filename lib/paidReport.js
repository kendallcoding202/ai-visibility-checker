export const PAID_REPORT_PRICE = '$19';
export const PAID_REPORT_HEADING = 'One-time report';
export const PAID_REPORT_BODY = 'A written report of this check: the score, the three raw answers, the brands ChatGPT named, the cited sources, and what to fix. Pay once. No subscription.';
export const PAID_REPORT_NOTE = 'Payment powered by Stripe. Report delivered to the email you provide at checkout.';

export function paidReportEnabled() {
  return process.env.PAID_REPORT_ENABLED === '1';
}

export function paidReportPriceId() {
  const price = String(process.env.STRIPE_PAID_REPORT_PRICE_ID ?? '').trim();
  return /^price_[A-Za-z0-9]+$/.test(price) ? price : '';
}
