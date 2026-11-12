import { createElement } from 'react';
import { trackingTierCard } from './trackingTier.js';

export function TrackingTierCard({ brand }) {
  const card = trackingTierCard(brand);
  return createElement('div', { className: 'plan' },
    createElement('h3', null, card.heading),
    createElement('p', { className: 'price' }, card.price),
    createElement('p', null, card.body),
    createElement('p', { className: 'muted' }, card.note));
}

/** Nothing when the flag is off. The card is the only place the offer is rendered. */
export function trackingTierElement(show, brand) {
  if (!show) return null;
  return createElement(TrackingTierCard, { brand });
}
