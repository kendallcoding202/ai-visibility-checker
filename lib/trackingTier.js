// Proposed monthly tracking offer. Hidden unless TRACKING_TIER_ENABLED=1.
// No Stripe price, payment link, or subscription is created here.

export const TRACKING_TIER_HEADING = 'Monthly tracking';
export const TRACKING_TIER_PRICE = '$29/month';
export const TRACKING_TIER_BODY = 'The saved brand is re-checked on a schedule. Each result is emailed with the run count and the raw answers.';
export const TRACKING_TIER_NOTE = 'Checkout is not open yet.';

export function trackingTierEnabled() {
  return process.env.TRACKING_TIER_ENABLED === '1';
}

function brandLabel(brand) {
  return String(brand ?? '').replace(/[\r\n\u0000]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
}

export function trackingTierCard(brand) {
  const name = brandLabel(brand);
  const offer = name ? ` This offer is for the ${name} check on this page.` : '';
  return {
    heading: TRACKING_TIER_HEADING,
    price: TRACKING_TIER_PRICE,
    body: `${TRACKING_TIER_BODY}${offer}`,
    note: TRACKING_TIER_NOTE,
  };
}

/** Class for the plans row. The Apify card is always present, so each offer adds a column. */
export function planColumnClass(showPaidReport, showTrackingTier) {
  const offers = (showPaidReport ? 1 : 0) + (showTrackingTier ? 1 : 0);
  if (offers >= 2) return 'plans three';
  if (offers === 1) return 'plans';
  return 'plans one';
}
