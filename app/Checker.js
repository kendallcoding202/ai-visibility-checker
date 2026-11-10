'use client';
import { useRef, useState } from 'react';
import { track } from '@vercel/analytics';
import Result from './Result.js';
import { EVENTS, categoryBucket, trackEvent } from '../lib/analyticsEvents.js';
import { messageFromFailedCheck } from '../lib/checkError.js';

export default function Checker() {
  const start = useRef(Date.now());
  const [state, setState] = useState({ loading: false, error: null, data: null });
  async function submit(e) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const entries = Object.fromEntries(f);
    trackEvent(track, EVENTS.CHECK_SUBMITTED, {
      has_competitors: String(entries.competitors ?? '').split(',').map((s) => s.trim()).filter(Boolean).length > 0,
      category_bucket: categoryBucket(entries.category),
      engine: 'chatgpt',
    });
    setState({ loading: true, error: null, data: null });
    try {
      const r = await fetch('/api/check', { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...entries, elapsed: Date.now() - start.current }) });
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
      setTimeout(() => document.getElementById('result')?.scrollIntoView({ behavior: 'smooth' }), 50);
    } catch {
      trackEvent(track, EVENTS.CHECK_ERROR, { type: 'network', engine: 'chatgpt' });
      setState({ loading: false, error: 'Network error. Please try again.', data: null });
    }
  }
  const d = state.data;
  return (<>
    <form className="card" onSubmit={submit}>
      <div className="row">
        <label>Your brand<input name="brand" required minLength={2} maxLength={60} placeholder="e.g. Notion" /></label>
        <label>Category / industry<input name="category" required minLength={3} maxLength={80} placeholder="e.g. project management" /></label>
      </div>
      <label>Competitors (optional, comma-separated)<input name="competitors" maxLength={200} placeholder="e.g. Asana, Monday.com, ClickUp" /></label>
      <input className="hp" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" />
      <button disabled={state.loading}>{state.loading ? 'Asking ChatGPT…' : 'Check my AI visibility, free'}</button>
      {state.loading && <p className="muted" role="status">Still working, this can take up to a minute.</p>}
      <span className="muted">3 free checks per day. We ask ChatGPT (with web search) 3 buyer-style questions about your category.</span>
    </form>
    {state.error && <p className="err" role="alert">{state.error}</p>}
    {d && <Result d={d} />}
  </>);
}
