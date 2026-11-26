import { AGENCY_ERROR } from '../lib/buyingStage.js';

export default function PaidReportView({ doc, token, showError = false }) {
  return (<article className="result report">
    <p className="kicker">AI visibility report</p>
    <h1>{doc.brand}</h1>
    <p className="report-meta">
      {doc.domain ? <>Domain: {doc.domain}<br /></> : null}
      {doc.category ? <>Market: {doc.category}<br /></> : null}
      {doc.date ? <>{doc.date}<br /></> : null}
      {doc.preparedBy}
    </p>
    <p><strong>{doc.brand}</strong> was mentioned in {doc.mentionedIn} of {doc.total} answers. Score: {doc.score}/100.</p>
    <p>{doc.runsLine}</p>
    <h2>Buying stages</h2>
    <ul className="stage-summary">
      {doc.stages.map((stage) => <li key={stage.stage}>{stage.line}</li>)}
    </ul>
    {doc.sections.map((section) => <section key={section.stage}>
      <h2>{section.label}</h2>
      {section.rows.length ? section.rows.map((row) => <div className="q" key={`${section.stage}:${row.prompt}`}>
        <strong>{row.prompt}</strong>
        <br />
        <span className={`pill ${row.mentioned ? 'yes' : 'no'}`}>{row.mention}</span>
        {row.mentioned && row.sentiment && row.sentiment !== 'not_mentioned'
          ? <span className="pill n">sentiment: {row.sentiment}</span>
          : null}
        <p>Top picks: {row.picks}</p>
        {row.answer
          ? <pre className="raw">{row.answer}</pre>
          : <p className="muted">Raw answer was not stored with this report.</p>}
      </div>) : <p>No prompts in this stage.</p>}
    </section>)}
    <h2>Cited sources</h2>
    {doc.topSources.length
      ? <ul>{doc.topSources.map((source) => <li key={source.domain}>{source.domain} ({source.n})</li>)}</ul>
      : <p>No sources cited.</p>}
    <h2>What to fix</h2>
    <p>{doc.whatToFix}</p>
    <form className="card" action="/api/paid-report/pdf" method="get">
      <h2>Download PDF</h2>
      <p className="muted">Optional agency name. It is printed as Prepared by. Letters, numbers, and simple punctuation, up to 80 characters.</p>
      <input type="hidden" name="token" value={token} />
      <label>Agency name
        <input name="agency" maxLength={80} defaultValue={doc.agency} autoComplete="organization" placeholder="Northstar Agency" />
      </label>
      <button type="submit">Download PDF</button>
      {showError ? <p className="err" role="alert">{AGENCY_ERROR}</p> : null}
    </form>
    <p className="muted">{doc.footer}</p>
    <p className="muted">One snapshot of ChatGPT. Answers vary by run, wording, and location.</p>
  </article>);
}
