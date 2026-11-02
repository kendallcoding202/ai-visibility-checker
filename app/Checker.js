'use client';
import { useRef, useState } from 'react';
import Result from './Result.js';

export default function Checker() {
  const start = useRef(Date.now());
  const [state, setState] = useState({ loading: false, error: null, data: null });
  async function submit(e) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setState({ loading: true, error: null, data: null });
    try {
      const r = await fetch('/api/check', { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...Object.fromEntries(f), elapsed: Date.now() - start.current }) });
      const j = await r.json();
      setState({ loading: false, error: r.ok ? null : j.error, data: r.ok ? j : null });
      if (r.ok) setTimeout(() => document.getElementById('result')?.scrollIntoView({ behavior: 'smooth' }), 50);
    } catch { setState({ loading: false, error: 'Network error. Please try again.', data: null }); }
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
      <button disabled={state.loading}>{state.loading ? 'Asking ChatGPT… (about 30 seconds)' : 'Check my AI visibility, free'}</button>
      <span className="muted">3 free checks per day. We ask ChatGPT (with web search) 3 buyer-style questions about your category.</span>
    </form>
    {state.error && <p className="err" role="alert">{state.error}</p>}
    {d && <Result d={d} />}
  </>);
}
