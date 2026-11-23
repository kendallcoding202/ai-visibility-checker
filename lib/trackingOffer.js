// Server-only offer gate. Client components must not import this module.
// The promotion id is read at request time and is never returned to the browser.
import {
  TRACKING_OFFER_BANNER,
  TRACKING_OFFER_HOME,
  TRACKING_OFFER_NOTE,
  TRACKING_OFFER_PRICE,
  TRACKING_SUCCESS_BODY,
  TRACKING_TIER_PRICE,
} from './trackingTier.js';

export {
  TRACKING_OFFER_BANNER,
  TRACKING_OFFER_HOME,
  TRACKING_OFFER_NOTE,
  TRACKING_OFFER_PRICE,
};

const PROMO_ID = /^promo_[A-Za-z0-9]+$/;

function readEnv(name) {
  return String(process.env[name] ?? '').trim();
}

export function trackingOfferActive(now = Date.now()) {
  if (!PROMO_ID.test(readEnv('STRIPE_TRACKING_PROMO_ID'))) return false;
  const endsAt = Date.parse(readEnv('TRACKING_OFFER_ENDS_AT'));
  if (!Number.isFinite(endsAt)) return false;
  return Number(now) < endsAt;
}

export function trackingPromotionCode(now = Date.now()) {
  if (!trackingOfferActive(now)) return '';
  return readEnv('STRIPE_TRACKING_PROMO_ID');
}

export function trackingSuccessBody(amountDiscount) {
  const standardFirst = `Checkout is complete for monthly tracking at ${TRACKING_TIER_PRICE}.`;
  const offerFirst = `Checkout is complete for monthly tracking: ${TRACKING_OFFER_PRICE}.`;
  if (!(Number(amountDiscount) > 0)) return TRACKING_SUCCESS_BODY;
  if (!TRACKING_SUCCESS_BODY.startsWith(standardFirst)) return TRACKING_SUCCESS_BODY;
  return `${offerFirst}${TRACKING_SUCCESS_BODY.slice(standardFirst.length)}`;
}
