import { TRACKER } from './links.js';
import { TrackerCTA, ShareLink } from './ResultClient.js';

// Shared result view, used on the homepage (after a check) and on /r/[id] share pages.
export default function Result({ d, shared = false }) {
  return (<div className="result" id="result">
    <div className="score">
      <div><div className="big">{d.mentionedIn}/{d.total}</div><div className="muted">answers mention {d.brand}</div></div>
      <div><div className="big">{d.avgRank ? `#${d.avgRank}` : '–'}</div><div className="muted">average position when mentioned</div></div>
      <div><div className="big">{d.score}</div><div className="muted">visibility score (0–100)</div></div>
    </div>
    <p>{d.mentionedIn === 0 ? `ChatGPT didn't mention ${d.brand} for "${d.category}" questions. Buyers asking AI are seeing your competitors instead.`
      : d.mentionedIn < d.total ? `${d.brand} shows up in some answers, but not consistently.` : `${d.brand} shows up in every answer. Nice! Keep tracking it, since AI answers change weekly.`}</p>
    <p className="weekly">This is one snapshot, and AI answers shift from week to week. To see whether {d.brand} is gaining or losing ground, <a href={TRACKER('result-top')} target="_blank" rel="noopener">track it weekly on Apify</a>. The ready-made input is <a href="#track">below</a>.</p>
    {d.id && <ShareLink id={d.id} brand={d.brand} score={d.score} />}
    <h3>Engines</h3>
    <div className="engines">
      <div className="engine"><strong>ChatGPT (web search)</strong><span className={`pill ${d.mentionedIn ? 'yes' : 'no'}`}>{d.mentionedIn}/{d.total} answers</span></div>
      <a className="engine locked" href={TRACKER('gemini-locked')}><strong>🔒 Gemini</strong><span className="muted">ChatGPT and Gemini often disagree (Gemini ranks Notion #1 for docs tools, ChatGPT picks Confluence). See Gemini's answer in the tracker →</span></a>
    </div>
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
    <p className="muted">Checked {new Date(d.checkedAt).toUTCString()}{shared ? ' (shared snapshot)' : d.cached ? ' (cached result, refreshed every 24h)' : ''}. One snapshot of ChatGPT; answers vary by run, wording and location.</p>
    <TrackerCTA d={d} />
  </div>);
}
