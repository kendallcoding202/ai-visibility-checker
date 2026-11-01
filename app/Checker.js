'use client';
import { useRef, useState } from 'react';
import { TRACKER } from './links.js';

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
    {d && <div className="result" id="result">
      <div className="score">
        <div><div className="big">{d.mentionedIn}/{d.total}</div><div className="muted">answers mention {d.brand}</div></div>
        <div><div className="big">{d.avgRank ? `#${d.avgRank}` : '–'}</div><div className="muted">average position when mentioned</div></div>
        <div><div className="big">{d.score}</div><div className="muted">visibility score (0–100)</div></div>
      </div>
      <p>{d.mentionedIn === 0 ? `ChatGPT didn't mention ${d.brand} for "${d.category}" questions. Buyers asking AI are seeing your competitors instead.`
        : d.mentionedIn < d.total ? `${d.brand} shows up in some answers, but not consistently.` : `${d.brand} shows up in every answer. Nice! Keep tracking it, since AI answers change weekly.`}</p>
      <div className="grid">
        <div><h3>Brands ChatGPT recommended</h3>{d.topBrands.length ? d.topBrands.map((b) => <span key={b.name} className="pill n">{b.name} · {b.n}/{d.total}</span>) : <span className="muted">None found</span>}
          {d.competitorHits.length > 0 && <><h3>Your competitors</h3>{d.competitorHits.map((c) => <span key={c.name} className={`pill ${c.mentionedIn ? 'yes' : 'no'}`}>{c.name}: {c.mentionedIn}/{d.total}</span>)}</>}</div>
        <div><h3>Top cited sources</h3>{d.topSources.length ? <ol>{d.topSources.map((s) => <li key={s.domain}>{s.domain} <span className="muted">({s.n})</span></li>)}</ol> : <span className="muted">No sources cited</span>}
          <p className="muted">Getting featured on these sites is the fastest way to show up in AI answers.</p></div>
      </div>
      <h3>The questions we asked</h3>
      {d.rows.map((r) => <div className="q" key={r.prompt}><strong>{r.prompt}</strong><br />
        <span className={`pill ${r.mentioned ? 'yes' : 'no'}`}>{r.mentioned ? `Mentioned${r.rank ? `, #${r.rank}` : ''}` : 'Not mentioned'}</span>
        {r.mentioned && <span className="pill n">sentiment: {r.sentiment}</span>}
        <p>Top picks: {r.brands.slice(0, 6).join(', ') || '–'}</p></div>)}
      <p className="muted">Checked {new Date(d.checkedAt).toLocaleString()}{d.cached ? ' (cached result, refreshed every 24h)' : ''}. One snapshot of ChatGPT; answers vary by run, wording and location.</p>
      <div className="ctabox"><h3 style={{ marginTop: 0 }}>Track this every week across ChatGPT &amp; Gemini, with share of voice, sentiment and reports</h3>
        <p>The AI Search Visibility Tracker runs your own prompts on a schedule, compares you to competitors, finds the prompts you're missing and builds a shareable HTML report. From $0.04 per answer, no API keys needed.</p>
        <a className="cta" href={TRACKER('result-cta')}>Start tracking on Apify →</a></div>
    </div>}
  </>);
}
