'use client';
import { useRef, useState } from 'react';
import { track } from '@vercel/analytics';
import LookupResult from './LookupResult.js';
import { EVENTS, categoryBucket, trackEvent } from '../lib/analyticsEvents.js';
import { messageFromFailedCheck } from '../lib/checkError.js';

export default function Lookup() {
  const start = useRef(Date.now());
  const [state, setState] = useState({ loading: false, error: null, data: null });
  async function submit(e) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const market = String(f.get('market') ?? '');
    trackEvent(track, EVENTS.LOOKUP_SUBMITTED, {
      category_bucket: categoryBucket(market),
      engine: 'chatgpt',
    });
    setState({ loading: true, error: null, data: null });
    try {
      const r = await fetch('/api/lookup', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ market, website: f.get('website') || '', elapsed: Date.now() - start.current }),
      });
      const text = await r.text();
      if (!r.ok) {
        setState({ loading: false, error: messageFromFailedCheck(text), data: null });
        return;
      }
      let data = null;
      try { data = JSON.parse(text); } catch { data = null; }
      if (!data || typeof data !== 'object') {
        setState({ loading: false, error: messageFromFailedCheck(''), data: null });
        return;
      }
      setState({ loading: false, error: null, data });
    } catch {
      trackEvent(track, EVENTS.CHECK_ERROR, { type: 'network', engine: 'chatgpt' });
      setState({ loading: false, error: 'Network error. Please try again.', data: null });
    }
  }
  return (<>
    <form id="market" className="card" onSubmit={submit}>
      <label>Category or market
        <input name="market" required minLength={3} maxLength={80} placeholder="e.g. CRM for small agencies, or dentist in Denver" />
      </label>
      <input className="hp" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" />
      <button disabled={state.loading}>{state.loading ? 'Asking ChatGPT…' : 'See who ChatGPT recommends'}</button>
      {state.loading && <p className="muted" role="status">Still working. This can take up to a minute.</p>}
      <span className="muted">Free. No signup. One ChatGPT answer with web search. Counts toward the same 3 free checks per day as a brand check. Repeat the same market within 24 hours and the cached result is free.</span>
    </form>
    {state.error && <p className="err" role="alert">{state.error}</p>}
    {state.data && <LookupResult d={state.data} />}
  </>);
}
