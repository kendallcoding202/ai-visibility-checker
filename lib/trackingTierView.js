import { createElement } from 'react';
import { TrackingCheckoutForm } from '../app/TrackingCheckout.js';
import { TrackingOffer } from '../app/TrackingOffer.js';
import { trackingTierCard } from './trackingTier.js';

export function TrackingTierCard({ brand, offerActive = false }) {
  const card = trackingTierCard(brand, offerActive === true);
  return createElement('div', { className: 'plan', id: 'monthly-tracking' },
    createElement('h3', null, card.heading),
    createElement('p', { className: card.offerNote ? 'price offer' : 'price' }, card.price),
    createElement('p', null, card.body),
    card.offerNote ? createElement('p', { className: 'muted' }, card.offerNote) : null,
    card.note ? createElement('p', { className: 'muted' }, card.note) : null,
    createElement(TrackingCheckoutForm, { brand: card.note ? brand : '', offerActive: offerActive === true }));
}

/** Nothing when the flag is off. */
export function trackingTierElement(show, brand, offerActive = false) {
  if (!show) return null;
  return createElement(TrackingTierCard, { brand, offerActive: offerActive === true });
}

/** Score-row banner. Nothing when the flag is off. The card below stays as it is. */
export function trackingOfferElement(show, brand, resultId = '', offerActive = false) {
  if (!show) return null;
  return createElement(TrackingOffer, { brand, resultId, offerActive: offerActive === true });
}
