'use client';
import { createElement, useEffect, useRef } from 'react';
import { brandLabel, TRACKING_OFFER_BANNER, TRACKING_OFFER_CTA, TRACKING_OFFER_PRICE, TRACKING_TIER_PRICE } from '../lib/trackingTier.js';

function postOffer(event) {
  try {
    fetch('/api/tracking/offer', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      keepalive: true,
      body: JSON.stringify({ event }),
    }).catch(() => {});
  } catch {
    // The offer count must not break the result page.
  }
}

export function TrackingOffer({ brand = '', resultId = '', offerActive = false }) {
  const seen = useRef('');
  useEffect(() => {
    const token = `${resultId}\n${brandLabel(brand)}`;
    if (seen.current === token) return;
    seen.current = token;
    postOffer('impression');
  }, [brand, resultId]);

  const name = brandLabel(brand);
  const price = offerActive === true ? TRACKING_OFFER_PRICE : TRACKING_TIER_PRICE;
  function onClick(event) {
    postOffer('click');
    const card = document.getElementById('monthly-tracking');
    if (!card) return;
    event.preventDefault();
    card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const email = card.querySelector('input[type="email"]');
    if (email && typeof email.focus === 'function') email.focus({ preventScroll: true });
  }

  return createElement('div', { className: 'track-offer', id: 'tracking-offer', role: 'region', 'aria-label': 'Monthly tracking' },
    createElement('p', null,
      name ? createElement('span', null, name) : null,
      createElement('span', { className: 'muted' }, name ? ` · ${price}` : price)),
    createElement('a', { className: 'cta', href: '#monthly-tracking', onClick }, TRACKING_OFFER_CTA));
}

export function TrackingOfferBanner({ offerActive = false }) {
  if (offerActive !== true) return null;
  return createElement('p', { className: 'track-offer-banner', id: 'tracking-offer-banner' }, TRACKING_OFFER_BANNER);
}
