'use client';
import { createElement, useEffect, useRef } from 'react';
import { brandLabel, TRACKING_OFFER_CTA, TRACKING_TIER_PRICE } from '../lib/trackingTier.js';

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

export function TrackingOffer({ brand = '', resultId = '' }) {
  const seen = useRef('');
  useEffect(() => {
    const token = `${resultId}\n${brandLabel(brand)}`;
    if (seen.current === token) return;
    seen.current = token;
    postOffer('impression');
  }, [brand, resultId]);

  const name = brandLabel(brand);
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
      createElement('span', { className: 'muted' }, name ? ` · ${TRACKING_TIER_PRICE}` : TRACKING_TIER_PRICE)),
    createElement('a', { className: 'cta', href: '#monthly-tracking', onClick }, TRACKING_OFFER_CTA));
}
