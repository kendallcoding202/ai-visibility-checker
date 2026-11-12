import { createElement } from 'react';
import { TrackingCheckoutForm } from '../app/TrackingCheckout.js';
import { trackingTierCard } from './trackingTier.js';

export function TrackingTierCard({ brand }) {
  const card = trackingTierCard(brand);
  return createElement('div', { className: 'plan' },
    createElement('h3', null, card.heading),
    createElement('p', { className: 'price' }, card.price),
    createElement('p', null, card.body),
    card.note ? createElement('p', { className: 'muted' }, card.note) : null,
    createElement(TrackingCheckoutForm, { brand: card.note ? brand : '' }));
}

/** Nothing when the flag is off. The card is the only place the offer is rendered. */
export function trackingTierElement(show, brand) {
  if (!show) return null;
  return createElement(TrackingTierCard, { brand });
}
