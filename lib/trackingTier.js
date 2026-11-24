// Monthly tracking. The card and checkout stay hidden unless TRACKING_TIER_ENABLED=1.

export const TRACKING_TIER_HEADING = 'Monthly tracking';
export const TRACKING_TIER_PRICE = '$24/month';
export const TRACKING_TIER_BODY = 'One saved brand is re-checked weekly on ChatGPT with web search. Each result is emailed with the run count and the raw answers. Cancel anytime.';
export const TRACKING_OFFER_MONTHLY = 15;
export const TRACKING_OFFER_MONTHS = 3;

function offerMonthWord(count) {
  return count === 1 ? 'month' : 'months';
}

const offerMonthlyLabel = `$${TRACKING_OFFER_MONTHLY}/month`;
const offerSpan = `the first ${TRACKING_OFFER_MONTHS} ${offerMonthWord(TRACKING_OFFER_MONTHS)}`;
export const TRACKING_OFFER_PRICE = `${offerMonthlyLabel} for ${offerSpan}, then ${TRACKING_TIER_PRICE}`;
export const TRACKING_OFFER_BANNER = `Black Friday: weekly tracking is ${TRACKING_OFFER_PRICE}. Cancel anytime. Offer ends Nov 30, 11:59 PM MT.`;
export const TRACKING_OFFER_NOTE = `The ${offerMonthlyLabel} price for ${offerSpan} applies automatically at checkout for new subscribers until Nov 30, 2026, 11:59 PM MT.`;
export const TRACKING_OFFER_HOME = `Black Friday: weekly tracking is ${TRACKING_OFFER_PRICE}, until Nov 30, 11:59 PM MT.`;
export const TRACKING_CHECKOUT_BUTTON = 'Continue to checkout';
export const TRACKING_OFFER_CHECKOUT = `Continue to checkout at ${offerMonthlyLabel} for ${offerSpan}`;
export const TRACKING_OFFER_CTA = 'Track this brand weekly';
export const TRACKING_SUCCESS_TITLE = 'Monthly tracking checkout complete';
export const TRACKING_SUCCESS_BODY = 'Checkout is complete for monthly tracking at $24/month. Weekly tracking starts when the payment is confirmed. One saved brand is re-checked weekly on ChatGPT with web search. Each result is emailed to the confirmed address with the run count and the raw answers. Cancel anytime from the link in those emails.';
export const TRACKING_CANCELED_BODY = 'Checkout was canceled. You have not been charged for monthly tracking.';
export const TRACKING_PORTAL_LINK = 'Open the billing portal to cancel';
export const TRACKING_MANAGE_LINK = 'Manage this subscription';
export const TRACKING_UNSUB_LINK = 'Cancel the subscription and delete this address';

export function trackingTierEnabled() {
  return process.env.TRACKING_TIER_ENABLED === '1';
}

export function brandLabel(brand) {
  return String(brand ?? '').replace(/[\r\n\u0000]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
}

export function trackingCheckoutLabel(offerActive = false) {
  return offerActive === true ? TRACKING_OFFER_CHECKOUT : TRACKING_CHECKOUT_BUTTON;
}

export function trackingReportLine(offerActive = false) {
  const price = offerActive === true ? TRACKING_OFFER_PRICE : TRACKING_TIER_PRICE;
  return `Weekly re-checks of this saved brand on ChatGPT with web search are ${price}. Each result includes the run count and the raw answers. Cancel anytime.`;
}

export function trackingIncludedAnswer(offerActive = false) {
  const list = `${TRACKING_TIER_HEADING} is ${TRACKING_TIER_PRICE} when that plan is offered. ${TRACKING_TIER_BODY}`;
  if (offerActive !== true) return list;
  return `${list} ${TRACKING_OFFER_NOTE}`;
}

export function trackingTierCard(brand, offerActive = false) {
  const name = brandLabel(brand);
  const active = offerActive === true;
  return {
    heading: TRACKING_TIER_HEADING,
    price: active ? TRACKING_OFFER_PRICE : TRACKING_TIER_PRICE,
    body: TRACKING_TIER_BODY,
    note: name ? `This offer is for the ${name} check on this page.` : '',
    offerNote: active ? TRACKING_OFFER_NOTE : '',
  };
}

export function trackingManageCopy(brand, active) {
  const name = brandLabel(brand) || 'this brand';
  if (active) {
    return `Monthly tracking for ${name} is active at $24/month. One saved brand is re-checked weekly on ChatGPT with web search. Each result is emailed with the run count and the raw answers. Cancel anytime in the billing portal.`;
  }
  return `Monthly tracking for ${name} is not active.`;
}

/** Class for the plans row. The Apify card is always present, so each offer adds a column. */
export function planColumnClass(showPaidReport, showTrackingTier) {
  const offers = (showPaidReport ? 1 : 0) + (showTrackingTier ? 1 : 0);
  if (offers >= 2) return 'plans three';
  if (offers === 1) return 'plans';
  return 'plans one';
}
