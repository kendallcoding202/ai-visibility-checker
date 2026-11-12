'use client';
import { createElement, useRef, useState } from 'react';
import { TRACKING_CHECKOUT_BUTTON } from '../lib/trackingTier.js';

function checkoutUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || parsed.hostname !== 'checkout.stripe.com') return '';
    return parsed.toString();
  } catch {
    return '';
  }
}

export function TrackingCheckoutForm({ brand }) {
  const start = useRef(Date.now());
  const [state, setState] = useState({ loading: false, error: '' });
  async function submit(e) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    if (form.get('company')) return;
    setState({ loading: true, error: '' });
    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          email: form.get('email'),
          brand,
          company: form.get('company') || '',
          elapsed: Date.now() - start.current,
        }),
      });
      const data = await response.json().catch(() => ({}));
      const url = checkoutUrl(data.url);
      if (!response.ok || !url) {
        setState({ loading: false, error: data.error || 'Checkout could not be started.' });
        return;
      }
      window.location.assign(url);
    } catch {
      setState({ loading: false, error: 'Network error. Please try again.' });
    }
  }
  return createElement('form', { onSubmit: submit },
    createElement('label', null, 'Confirmed email',
      createElement('input', { name: 'email', type: 'email', required: true, autoComplete: 'email', maxLength: 254, placeholder: 'you@company.com' })),
    createElement('p', { className: 'muted' }, 'Uses the email you confirmed for this brand.'),
    createElement('input', { className: 'hp', name: 'company', tabIndex: -1, autoComplete: 'off', 'aria-hidden': true }),
    createElement('button', { disabled: state.loading }, state.loading ? 'Opening checkout…' : TRACKING_CHECKOUT_BUTTON),
    state.error ? createElement('p', { className: 'err', role: 'alert' }, state.error) : null);
}
