'use client';
import { useState } from 'react';

export default function ConfirmForm({ token }) {
  const [state, setState] = useState({ loading: false, error: '', done: '' });
  async function confirm() {
    setState({ loading: true, error: '', done: '' });
    try {
      const r = await fetch('/api/subscribe/confirm', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ token }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setState({ loading: false, error: data.error || 'This confirmation link is not valid or it has expired.', done: '' });
        return;
      }
      setState({ loading: false, error: '', done: data.message || 'Confirmed. The report is on its way.' });
    } catch {
      setState({ loading: false, error: 'Network error. Please try again.', done: '' });
    }
  }
  return (<div>
    <p>Confirm to receive the report. The address is not added until you do this.</p>
    <button type="button" onClick={confirm} disabled={state.loading}>{state.loading ? 'Confirming…' : 'Confirm and email me the report'}</button>
    {state.error && <p className="err" role="alert">{state.error}</p>}
    {state.done && <p role="status">{state.done}</p>}
    <p><a href="/privacy">Privacy policy</a></p>
  </div>);
}
