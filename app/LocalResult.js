import { buildFixList, shortUrl } from '../lib/fixList.js';
import { runLine } from '../lib/publicResult.js';

export default function LocalResult({ d }) {
  const fix = buildFixList(d, 'local');
  return (<div className="result" id="result">
    <div className="score">
      <div><div className="big">{d.mentionedIn}/{d.total}</div><div className="muted">answers mention {d.businessName}</div></div>
      <div><div className="big">{d.avgRank ? `#${d.avgRank}` : '–'}</div><div className="muted">average position when mentioned</div></div>
      <div><div className="big">{d.score}</div><div className="muted">visibility score (0–100)</div></div>
    </div>
    <p className="runs">{runLine(d.runs, d.total)}</p>
    <p>{d.mentionedIn === 0 ? `ChatGPT didn't mention ${d.businessName} when asked about ${d.service} in ${d.city}, ${d.state}. Customers asking AI are seeing your competitors instead.`
      : d.mentionedIn < d.total ? `${d.businessName} shows up in some answers, but not consistently.` : `${d.businessName} shows up in every answer. Keep tracking it, since AI answers change weekly.`}</p>

    {d.audit && !d.audit.skipped && <WebsiteAudit audit={d.audit} businessName={d.businessName} />}

    <h3>Brands ChatGPT recommended</h3>
    <div className="grid">
      <div>{d.topBrands.length ? d.topBrands.map((b) => <span key={b.name} className="pill n">{b.name} · {b.n}/{d.total}</span>) : <span className="muted">None found</span>}</div>
      <div><h3>Top cited sources</h3>{d.topSources.length ? <ol>{d.topSources.map((s) => <li key={s.domain}>{s.domain} <span className="muted">({s.n})</span></li>)}</ol> : <span className="muted">No sources cited</span>}
        <p className="muted">Getting featured on these sites helps you show up in AI answers.</p></div>
    </div>

    <FixKit d={d} />
    {fix && <FixList fix={fix} businessName={d.businessName} />}

    <h3>The questions we asked</h3>
    {d.rows.map((row, i) => <details key={i}>
      <summary><strong>{row.prompt}</strong> {row.mentioned ? <span className="pill yes">Mentioned</span> : <span className="pill no">Not mentioned</span>}</summary>
      <p className="muted">Rank: {row.rank ? `#${row.rank}` : 'Not ranked'} · Sentiment: {row.sentiment}</p>
      {row.brands.length > 0 && <p><strong>Brands mentioned:</strong> {row.brands.join(', ')}</p>}
    </details>)}

    <p className="muted">Checked {new Date(d.checkedAt).toUTCString()}{d.cached ? ' (cached result, refreshed every 24h)' : ''}. One snapshot of ChatGPT; answers vary by run, wording and location.</p>
  </div>);
}

function WebsiteAudit({ audit, businessName }) {
  if (!audit.accessible) {
    return (<div className="audit">
      <h3>Website audit</h3>
      <p className="muted">{audit.message || 'Could not read this site'}</p>
    </div>);
  }

  const issues = [];
  const good = [];
  if (!audit.hasLocalBusinessSchema) issues.push('Missing LocalBusiness structured data');
  else good.push('Has LocalBusiness structured data');
  if (!audit.hasBusinessName) issues.push('Business name not found on page');
  else good.push('Business name found on page');
  if (!audit.hasPhoneNumber) issues.push('Phone number not found on page');
  else good.push('Phone number found on page');
  if (!audit.hasAddress) issues.push('Address not found on page');
  else good.push('Address found on page');
  if (!audit.hasServiceInMeta) issues.push('Service and city not in title or headings');
  else good.push('Service and city in title or headings');
  if (!audit.hasFAQ) issues.push('No FAQ section');
  else good.push('Has FAQ section');
  if (!audit.hasLlmsTxt) issues.push('No llms.txt file');
  else good.push('Has llms.txt file');
  if (!audit.hasSitemap) issues.push('No sitemap.xml');
  else good.push('Has sitemap.xml');
  if (audit.robotsBlocked && audit.robotsBlocked.length > 0) issues.push(`Blocking AI crawlers: ${audit.robotsBlocked.join(', ')}`);
  else good.push('Allows AI crawlers');

  return (<div className="audit">
    <h3>Website audit</h3>
    {good.length > 0 && <div><strong>✓ What's working</strong><ul>{good.map((g, i) => <li key={i}>{g}</li>)}</ul></div>}
    {issues.length > 0 && <div><strong>⚠ What's missing</strong><ul>{issues.map((issue, i) => <li key={i}>{issue}</li>)}</ul></div>}
  </div>);
}

function FixKit({ d }) {
  if (!d.fixKit) return null;
  return (<div className="fixkit">
    <h3>Fix kit: ready-to-paste code</h3>
    <p className="muted">Copy and paste these into your website. Replace placeholders with your actual information.</p>
    
    <details>
      <summary><strong>LocalBusiness JSON-LD structured data</strong></summary>
      <p className="muted">Add this script tag to your homepage &lt;head&gt; section.</p>
      <pre><code>{`<script type="application/ld+json">\n${JSON.stringify(d.fixKit.schema, null, 2)}\n</script>`}</code></pre>
    </details>

    <details>
      <summary><strong>Starter FAQ questions</strong></summary>
      <p className="muted">Answer these questions on your website to help AI assistants understand your business.</p>
      <ul>{d.fixKit.faqQuestions.map((q, i) => <li key={i}>{q}</li>)}</ul>
    </details>

    <details>
      <summary><strong>llms.txt file</strong></summary>
      <p className="muted">Create a file at /llms.txt in your website root with this content.</p>
      <pre><code>{d.fixKit.llmsTxt}</code></pre>
    </details>

    <details>
      <summary><strong>robots.txt for AI crawlers</strong></summary>
      <p className="muted">Add these lines to your robots.txt to allow AI assistants to read your site.</p>
      <pre><code>{d.fixKit.robotsTxt}</code></pre>
    </details>
  </div>);
}

function FixList({ fix, businessName }) {
  if (!fix) return null;
  return (<div className="fix">
    <h3>How to get into answers that skipped {businessName}</h3>
    <p className="muted">Directories and sites ChatGPT cited on questions that did not name {businessName}.</p>
    <div className="q">
      <strong>Claim your Google Business Profile</strong>
      <p>Claim and verify your business on <a href="https://www.google.com/business/" target="_blank" rel="noopener noreferrer">Google Business Profile</a>. This helps AI assistants find accurate information about your business.</p>
    </div>
    {fix.questions.map((q) => <div className="q" key={q.prompt}>
      <strong>{q.prompt}</strong>
      {q.stored ? (q.pages.length ? <ul>{q.pages.map((p) => <li key={p.url}><a href={p.url} target="_blank" rel="noopener noreferrer">{p.title || shortUrl(p.url)}</a></li>)}</ul>
        : <p>ChatGPT didn&apos;t cite any pages for this question.</p>)
        : <p className="muted">This snapshot doesn&apos;t include the cited pages.</p>}
    </div>)}
    {fix.questions.some((q) => q.stored) && fix.sites.length > 0 && <>
      <h3>Sites worth claiming your listing on</h3>
      <ol>{fix.sites.map((s) => <li key={s.domain}>
        <strong>{s.domain}</strong> <span className="muted">cited {s.n} {s.n === 1 ? 'time' : 'times'}</span>
        <ul className="actions">{s.actions.map((a) => <li key={a}>{a}</li>)}</ul>
      </li>)}</ol>
    </>}
  </div>);
}
