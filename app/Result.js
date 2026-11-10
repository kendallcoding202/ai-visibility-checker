import { TRACKER } from './links.js';
import { TrackerCTA, CitationCTA, ShareLink, ResultViewTracker } from './ResultClient.js';
import TrackLink from './TrackLink.js';
import { EVENTS } from '../lib/analyticsEvents.js';
import { buildFixList, shortUrl } from '../lib/fixList.js';

const KIND_LABEL = { review: 'Review site', directory: 'Directory', listicle: 'Listicle' };

// Shared result view, used on the homepage (after a check) and on /r/[id] share pages.
export default function Result({ d, shared = false }) {
  return (<div className="result" id="result">
    <ResultViewTracker d={d} shared={shared} />
    <div className="score">
      <div><div className="big">{d.mentionedIn}/{d.total}</div><div className="muted">answers mention {d.brand}</div></div>
      <div><div className="big">{d.avgRank ? `#${d.avgRank}` : '–'}</div><div className="muted">average position when mentioned</div></div>
      <div><div className="big">{d.score}</div><div className="muted">visibility score (0–100)</div></div>
    </div>
    <p>{d.mentionedIn === 0 ? `ChatGPT didn't mention ${d.brand} for "${d.category}" questions. Buyers asking AI are seeing your competitors instead.`
      : d.mentionedIn < d.total ? `${d.brand} shows up in some answers, but not consistently.` : `${d.brand} shows up in every answer. Nice! Keep tracking it, since AI answers change weekly.`}</p>
    <p className="weekly">This is one snapshot, and AI answers shift from week to week. To see whether {d.brand} is gaining or losing ground, <TrackLink href={TRACKER('result-top')} event={EVENTS.TRACKER_CTA_CLICK} location="result-top" target="_blank" rel="noopener">track it weekly on Apify</TrackLink>. The ready-made input is <a href="#track">below</a>.</p>
    {d.id && <ShareLink id={d.id} brand={d.brand} score={d.score} source={shared ? 'share' : 'home'} />}
    <h3>Engines</h3>
    <div className="engines">
      <div className="engine"><strong>ChatGPT (web search)</strong><span className={`pill ${d.mentionedIn ? 'yes' : 'no'}`}>{d.mentionedIn}/{d.total} answers</span></div>
      <TrackLink className="engine locked" href={TRACKER('gemini-locked')} event={EVENTS.TRACKER_CTA_CLICK} location="gemini-locked" target="_blank" rel="noopener"><strong>🔒 Gemini</strong><span className="muted">ChatGPT and Gemini often disagree (Gemini ranks Notion #1 for docs tools, ChatGPT picks Confluence). See Gemini's answer in the tracker →</span></TrackLink>
    </div>
    <div className="grid">
      <div><h3>Brands ChatGPT recommended</h3>{d.topBrands.length ? d.topBrands.map((b) => <span key={b.name} className="pill n">{b.name} · {b.n}/{d.total}</span>) : <span className="muted">None found</span>}
        {d.competitorHits.length > 0 && <><h3>Your competitors</h3>{d.competitorHits.map((c) => <span key={c.name} className={`pill ${c.mentionedIn ? 'yes' : 'no'}`}>{c.name}: {c.mentionedIn}/{d.total}</span>)}</>}</div>
      <div><h3>Top cited sources</h3>{d.topSources.length ? <ol>{d.topSources.map((s) => <li key={s.domain}>{s.domain} <span className="muted">({s.n})</span></li>)}</ol> : <span className="muted">No sources cited</span>}
        <p className="muted">Getting featured on these sites is the fastest way to show up in AI answers.</p>
        <CitationCTA d={d} /></div>
    </div>
    <h3>The questions we asked</h3>
    {d.rows.map((r) => <div className="q" key={r.prompt}><strong>{r.prompt}</strong><br />
      <span className={`pill ${r.mentioned ? 'yes' : 'no'}`}>{r.mentioned ? `Mentioned${r.rank ? `, #${r.rank}` : ''}` : 'Not mentioned'}</span>
      {r.mentioned && <span className="pill n">sentiment: {r.sentiment}</span>}
      <p>Top picks: {r.brands.slice(0, 6).join(', ') || '–'}</p></div>)}
    <FixList d={d} />
    <p className="muted">Checked {new Date(d.checkedAt).toUTCString()}{shared ? ' (shared snapshot)' : d.cached ? ' (cached result, refreshed every 24h)' : ''}. One snapshot of ChatGPT; answers vary by run, wording and location.</p>
    <TrackerCTA d={d} />
  </div>);
}

function FixList({ d }) {
  const fix = buildFixList(d);
  if (!fix) return null;
  return (<div className="fix">
    <h3>How to get into answers that skipped {d.brand}</h3>
    <p className="muted">Pages ChatGPT cited on the questions that did not name {d.brand}.</p>
    {fix.questions.map((q) => <div className="q" key={q.prompt}>
      <strong>{q.prompt}</strong>
      {q.stored ? (q.pages.length ? <ul>{q.pages.map((p) => <li key={p.url}><a href={p.url} target="_blank" rel="noopener noreferrer">{p.title || shortUrl(p.url)}</a></li>)}</ul>
        : <p>ChatGPT didn&apos;t cite any pages for this question.</p>)
        : <p className="muted">This snapshot doesn&apos;t include the cited pages.</p>}
    </div>)}
    {fix.questions.some((q) => q.stored) && <>
      <h3>Sites worth getting listed on</h3>
      {fix.sites.length ? <ol>{fix.sites.map((s) => <li key={s.domain}>
        <strong>{s.domain}</strong> <span className="muted">cited {s.n} {s.n === 1 ? 'time' : 'times'}</span>
        {s.kind ? <span className="pill n">{KIND_LABEL[s.kind]}</span> : null}
        <ul className="actions">{s.actions.map((a) => <li key={a}>{a}</li>)}</ul>
      </li>)}</ol> : <p className="muted">No cited sites on those questions.</p>}
    </>}
  </div>);
}
