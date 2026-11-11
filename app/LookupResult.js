'use client';
import { TRACKER } from './links.js';
import TrackLink from './TrackLink.js';
import { EVENTS } from '../lib/analyticsEvents.js';

export default function LookupResult({ d }) {
  const brands = Array.isArray(d?.brands) ? d.brands : [];
  return (<div className="result" id="lookup-result">
    <h3>Brands ChatGPT named for “{d.market}”</h3>
    {brands.length
      ? <ol className="lookup-brands">{brands.map((b) => <li key={`${b.rank}-${b.name}`}>{b.name}</li>)}</ol>
      : <p>ChatGPT did not name specific brands for this market.</p>}
    {d.excerpt ? <p>{d.excerpt}</p> : null}
    <p className="muted">One ChatGPT answer with web search{d.cached ? ' (cached result, refreshed every 24h)' : ''}. Checked {d.checkedAt ? new Date(d.checkedAt).toUTCString() : ''}. Answers vary by run.</p>
    <p>
      <TrackLink className="cta" href={TRACKER('lookup')} event={EVENTS.LOOKUP_CTA_CLICK} location="lookup-tracker" target="_blank" rel="noopener">Track these prompts weekly →</TrackLink>
      {' '}
      <TrackLink className="cta" href="/#checker" event={EVENTS.LOOKUP_CTA_CLICK} location="lookup-checker">Check your brand</TrackLink>
    </p>
    <p className="muted">The weekly tracker runs your own prompts on ChatGPT, Gemini, and Perplexity. $0.0375 per answer on the Apify Free tier.</p>
  </div>);
}
