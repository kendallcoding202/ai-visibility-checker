'use client';
import { useRef, useState } from 'react';
import { track } from '@vercel/analytics';
import LocalResult from './LocalResult.js';
import { EVENTS, trackEvent } from '../lib/analyticsEvents.js';
import { messageFromFailedCheck } from '../lib/checkError.js';

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY',
  'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND',
  'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC',
];

export default function LocalChecker() {
  const start = useRef(Date.now());
  const [state, setState] = useState({ loading: false, error: null, data: null });

  async function submit(e) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const businessName = String(f.get('businessName') ?? '').trim();
    const service = String(f.get('service') ?? '').trim();
    const city = String(f.get('city') ?? '').trim();
    const stateCode = String(f.get('state') ?? '').trim();
    const website = String(f.get('website') ?? '').trim();

    trackEvent(track, EVENTS.CHECK_SUBMITTED, {
      category_bucket: 'local',
      engine: 'chatgpt',
    });

    setState({ loading: true, error: null, data: null });
    try {
      const r = await fetch('/api/local', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ businessName, service, city, state: stateCode, website, honeypot: f.get('honeypot') || '', elapsed: Date.now() - start.current }),
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
    <form className="card" onSubmit={submit}>
      <label>Business name
        <input name="businessName" required minLength={2} maxLength={60} placeholder="e.g. Smith Plumbing" />
      </label>
      <label>Service
        <input name="service" required minLength={2} maxLength={60} placeholder="e.g. plumber, dentist" />
      </label>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '1rem' }}>
        <label>City
          <input name="city" required minLength={2} maxLength={60} placeholder="e.g. Denver" />
        </label>
        <label>State
          <select name="state" required>
            <option value="">Select</option>
            {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
      </div>
      <label>Website (optional)
        <input name="website" type="url" maxLength={200} placeholder="https://example.com" />
        <span className="muted">If provided, we'll audit your site for local SEO signals.</span>
      </label>
      <input className="hp" name="honeypot" tabIndex={-1} autoComplete="off" aria-hidden="true" />
      <button disabled={state.loading}>{state.loading ? 'Checking…' : 'Check AI visibility'}</button>
      {state.loading && <p className="muted" role="status">Still working. This can take up to a minute.</p>}
      <span className="muted">Free. 3 checks per day. Results cached 24 hours.</span>
    </form>
    {state.error && <p className="err" role="alert">{state.error}</p>}
    {state.data && <LocalResult d={state.data} />}
  </>);
}
