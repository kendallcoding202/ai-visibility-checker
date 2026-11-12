'use client';
import { useState } from 'react';

export default function UnsubscribeForm({ token, paid = false }) {
  const [state, setState] = useState({ loading: false, error: '', done: '' });
  async function go() {
    setState({ loading: true, error: '', done: '' });
    try {
      const r = await fetch('/api/unsubscribe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ token }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setState({ loading: false, error: data.error || 'This unsubscribe link is not valid.', done: '' });
        return;
      }
      setState({ loading: false, error: '', done: data.message || 'This address is unsubscribed and deleted.' });
    } catch {
      setState({ loading: false, error: 'Network error. Please try again.', done: '' });
    }
  }
  return (<div>
    <p>{paid
      ? 'This cancels the $24/month tracking subscription and deletes the email address and the stored report.'
      : 'This deletes the email address and the stored report.'}</p>
    <button type="button" onClick={go} disabled={state.loading}>{state.loading ? 'Removing…' : (paid ? 'Cancel subscription and delete this address' : 'Unsubscribe and delete this address')}</button>
    {state.error && <p className="err" role="alert">{state.error}</p>}
    {state.done && <p role="status">{state.done}</p>}
  </div>);
}
