'use client';
import { useState } from 'react';
import { TRACKING_PORTAL_LINK, trackingManageCopy } from '../../../lib/trackingTier.js';

function portalUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || parsed.hostname !== 'billing.stripe.com') return '';
    return parsed.toString();
  } catch {
    return '';
  }
}

export default function ManageForm({ token, brand, active, canPortal, unsubToken }) {
  const [state, setState] = useState({ loading: false, error: '' });
  async function openPortal() {
    setState({ loading: true, error: '' });
    try {
      const response = await fetch('/api/tracking/portal', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ token }),
      });
      const data = await response.json().catch(() => ({}));
      const url = portalUrl(data.url);
      if (!response.ok || !url) {
        setState({ loading: false, error: data.error || 'The billing portal could not be opened.' });
        return;
      }
      window.location.assign(url);
    } catch {
      setState({ loading: false, error: 'Network error. Please try again.' });
    }
  }
  return (<div>
    <p>{trackingManageCopy(brand, active)}</p>
    {canPortal && <p><button type="button" onClick={openPortal} disabled={state.loading}>{state.loading ? 'Opening…' : TRACKING_PORTAL_LINK}</button></p>}
    {state.error && <p className="err" role="alert">{state.error}</p>}
    {unsubToken && <p><a href={`/email/unsubscribe?token=${encodeURIComponent(unsubToken)}`}>Cancel the subscription and delete this address</a></p>}
  </div>);
}
