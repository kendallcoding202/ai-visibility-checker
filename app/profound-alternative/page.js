import { TRACKER } from '../links.js';
import { Ld, faqLd, orgLd } from '../site.js';
import Footer from '../Footer.js';

const title = 'A Card-Buyable Profound Alternative for AI Visibility Tracking';
const description = 'Compare the AI Visibility Tracker on Apify with Profound and Peec AI. Clear pricing math (prompts × engines × runs), sourced from each vendor’s live pricing page on Nov 6, 2026. No sales call required.';
const checked = 'November 6, 2026';

// Preview-only: keep this page out of search indexes until Kendall approves going live.
export const metadata = {
  title,
  description,
  robots: { index: false, follow: false },
  alternates: { canonical: '/profound-alternative' },
  openGraph: { title, description, type: 'article', images: ['/opengraph-image'] },
  authors: [{ name: 'Kendall Sorenson' }],
};

// Tracker list price from Apify actor pricing (PAY_PER_EVENT answer-analyzed), FREE tier.
const UNIT = 0.04;

const examples = [
  {
    name: 'Light weekly check',
    prompts: 10,
    engines: 2,
    runs: 4,
    note: '10 buyer prompts on ChatGPT and Perplexity, once a week.',
  },
  {
    name: 'Fuller weekly track',
    prompts: 25,
    engines: 3,
    runs: 4,
    note: '25 prompts across ChatGPT, Gemini and Perplexity, once a week.',
  },
  {
    name: 'Same volume as Peec Starter',
    prompts: 50,
    engines: 3,
    runs: 30,
    note: '50 prompts × 3 engines × daily for a month — the same answer count Peec quotes for Starter (4,500). Useful for an apples-to-apples cost check.',
  },
];

function cost(ex) {
  const answers = ex.prompts * ex.engines * ex.runs;
  return { answers, usd: answers * UNIT };
}

const faq = [
  [
    'Is the AI Visibility Tracker a full Profound replacement?',
    'No. Profound is a broader AI marketing platform with Answer Engine Insights, AI Marketer agents, multi-engine dashboards, history, exports and dedicated support on Enterprise. The tracker is a pay-per-answer actor that returns brand mention, rank, competitors, sentiment and citations for the prompts you choose. Use it when you want raw tracking data without a subscription or a sales call.',
  ],
  [
    'How does Apify pricing work for this tracker?',
    'You pay $0.04 per successfully analyzed AI answer (the answer-analyzed event). Failed answers are not charged. Apify also offers usage-tier discounts (about 10% Bronze, 20% Silver, 30% Gold and above) that lower the per-answer rate as your Apify usage grows. Prices were read from the actor’s live Apify pricing on Nov 6, 2026.',
  ],
  [
    'When is Peec or Profound a better fit?',
    'Choose Peec if you want a polished daily dashboard, more engines to pick from, and a fixed monthly plan starting at $95. Choose Profound if you want an enterprise AI marketing stack (agents, multi-engine insights, SSO, dedicated support) and are fine starting with a free trial then talking to sales for paid access. Choose the tracker if you want to pay only for the answers you run and export the data yourself.',
  ],
];

export default function Page() {
  return (
    <>
      <header className="hero">
        <div className="wrap">
          <h1>A card-buyable Profound alternative for AI visibility tracking</h1>
          <p>
            Profound’s paid plan is Enterprise (custom, demo). If you want ongoing ChatGPT / Gemini / Perplexity brand-mention tracking you can buy with a card, here is how the AI Visibility Tracker on Apify compares — with the math written out. Prices checked {checked}. By Kendall Sorenson.
          </p>
        </div>
      </header>
      <main className="wrap">
        <section>
          <h2>Quick answer</h2>
          <p>
            The <a href={TRACKER('profound-alt')}>AI Visibility Tracker</a> on Apify charges <strong>$0.04 per AI answer analyzed</strong>. Monthly cost is:
          </p>
          <p>
            <strong>prompts × engines × runs per month × $0.04</strong>
          </p>
          <p>
            There is no subscription and no sales call. You run it on Apify, get JSON / CSV / API output, and stop whenever you want. It is not a full Profound or Peec replacement: those products ship dashboards, more engines and (on higher plans) support and agents that this actor does not.
          </p>
          <p className="muted">
            Disclosure: I built the tracker and this free checker site. I have tried to describe Profound and Peec from their own pricing pages, including what they do better.
          </p>
        </section>

        <section>
          <h2>Worked pricing examples</h2>
          <p>
            Using the tracker’s current list price of <strong>$0.04 per answer</strong> (Apify FREE tier for the <code>answer-analyzed</code> event, actor{' '}
            <a href={TRACKER('profound-alt')}>crunchy_galaxy_qcr/ai-visibility-tracker</a>, checked {checked}):
          </p>
          <div style={{ overflowX: 'auto' }}>
            <table className="cmp">
              <thead>
                <tr>
                  <th>Scenario</th>
                  <th>Math</th>
                  <th>Answers / month</th>
                  <th>Est. cost</th>
                </tr>
              </thead>
              <tbody>
                {examples.map((ex) => {
                  const { answers, usd } = cost(ex);
                  return (
                    <tr key={ex.name}>
                      <td>
                        <strong>{ex.name}</strong>
                        <div className="muted">{ex.note}</div>
                      </td>
                      <td>
                        {ex.prompts} × {ex.engines} × {ex.runs} × ${UNIT.toFixed(2)}
                      </td>
                      <td>{answers.toLocaleString()}</td>
                      <td>
                        <strong>${usd.toFixed(2)}/mo</strong>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="muted">
            Apify Bronze / Silver / Gold usage discounts lower the unit price to about $0.036 / $0.032 / $0.028. The table uses the public FREE-tier rate so the math stays easy to check. Failed answers are not charged.
          </p>
        </section>

        <section>
          <h2>How that compares to Profound and Peec</h2>
          <div style={{ overflowX: 'auto' }}>
            <table className="cmp">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>How you buy</th>
                  <th>Published price</th>
                  <th>Engines (published)</th>
                  <th>What you get</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <strong>AI Visibility Tracker (Apify)</strong>
                  </td>
                  <td>Self-serve on Apify (card / Apify credits)</td>
                  <td>$0.04 per answer analyzed; no monthly minimum</td>
                  <td>ChatGPT, Gemini, Perplexity</td>
                  <td>
                    Pay-per-run brand mention, rank, competitors, sentiment, citations; JSON/CSV/API; shareable HTML report. No hosted dashboard.
                  </td>
                  <td>
                    <a href={TRACKER('profound-alt')}>Apify actor page</a>
                  </td>
                </tr>
                <tr>
                  <td>
                    <strong>Profound</strong>
                  </td>
                  <td>Free Trial, then Enterprise via demo</td>
                  <td>
                    Trial: Free (50 prompts daily for 7 days). Enterprise: Custom. One public AWS Marketplace listing shows $100,000 for a 12-month Enterprise package — that is a marketplace contract price, not a quote for every deal.
                  </td>
                  <td>
                    Trial: ChatGPT, Gemini, Google AI Overviews. Enterprise: up to 9 answer engines (pricing page lists capability for ChatGPT, Perplexity, Google AI Mode, Gemini, DeepSeek, Claude, Google AI Overviews, Exa Search, Muse Spark).
                  </td>
                  <td>
                    Answer Engine Insights, AI Marketer / agents, analytics integrations, history &amp; exports on Enterprise, dedicated support and SSO/SAML + SOC 2 on Enterprise.
                  </td>
                  <td>
                    <a href="https://www.tryprofound.com/pricing">tryprofound.com/pricing</a>
                    {' · '}
                    <a href="https://aws.amazon.com/marketplace/pp/prodview-p2ghr3txgulka">AWS Marketplace</a>
                  </td>
                </tr>
                <tr>
                  <td>
                    <strong>Peec AI</strong>
                  </td>
                  <td>Self-serve plans + Enterprise</td>
                  <td>
                    Starter <strong>$95/mo</strong> (50 prompts, 3 active models, daily → 4,500 AI answers/mo). Pro $245/mo. Advanced $495/mo. Enterprise custom.
                  </td>
                  <td>
                    Starter–Advanced: choose 3 from ChatGPT, AI Mode, AI Overviews, Copilot, Gemini, Naver AI (and more on Enterprise).
                  </td>
                  <td>
                    Polished daily dashboard, brand / source analytics, agent features, team seats, SOC 2. Chat support on Starter; more channels on higher plans.
                  </td>
                  <td>
                    <a href="https://peec.ai/pricing">peec.ai/pricing</a>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="muted">Competitor facts above were taken from each vendor’s live pricing page on {checked}. They can change; follow the source links for the current numbers.</p>
        </section>

        <section>
          <h2>What Profound and Peec do better</h2>
          <ul>
            <li>
              <strong>Dashboards and history.</strong> Peec and Profound are built around a UI you open every day. The tracker gives you datasets and a shareable HTML report; you bring your own spreadsheet or BI tool for trends.
            </li>
            <li>
              <strong>More engines.</strong> Profound Enterprise lists up to nine answer engines. Peec lets you pick three active models on Starter–Advanced (and more on Enterprise). The tracker covers three: ChatGPT, Gemini and Perplexity.
            </li>
            <li>
              <strong>Support and compliance.</strong> Profound Enterprise includes dedicated support and SSO/SAML + SOC 2. Peec publishes SOC 2 across plans and chat (or chat + email) support. The Apify actor is self-serve; support is Apify’s platform support plus the actor’s Issues tab.
            </li>
            <li>
              <strong>Agents and marketing workflows.</strong> Profound’s AI Marketer and Peec’s agent credits sit outside what a single Apify actor does. If you need that stack, buy those products.
            </li>
          </ul>
        </section>

        <section>
          <h2>When the tracker is the better fit</h2>
          <ul>
            <li>You want a <strong>small weekly sample</strong> (the first two examples above land around $3–$12/mo at list price), not thousands of daily answers.</li>
            <li>You already use Apify, or you are fine exporting JSON/CSV and wiring it into your own sheet.</li>
            <li>You do not want a sales call or a fixed subscription while you are still testing whether AI visibility tracking is useful.</li>
            <li>
              You already tried Profound’s free trial and either do not need Enterprise scope, or you want a cheaper ongoing check alongside (or instead of) a bigger platform.
            </li>
          </ul>
          <p>
            Fair warning on the third example: at Peec Starter’s published volume (4,500 answers/month), the tracker at $0.04 each is about <strong>$180/mo</strong> — more than Peec’s $95. So for high daily volume with a dashboard, Peec is usually the better buy. The tracker wins when you run fewer answers on purpose.
          </p>
        </section>

        <section>
          <h2>FAQ</h2>
          {faq.map(([q, a]) => (
            <details key={q} open>
              <summary>{q}</summary>
              <p>{a}</p>
            </details>
          ))}
        </section>

        <p>
          <a className="cta" href={TRACKER('profound-alt-cta')}>
            Open the AI Visibility Tracker on Apify
          </a>
          {' '}
          <a className="ghost" href="/">
            Or run a free one-off check
          </a>
        </p>
        <p className="muted">
          Also see the broader <a href="/best-ai-visibility-tools">best AI visibility tools</a> comparison. This page is a preview; it is not linked from the site footer or sitemap until it is approved to go live.
        </p>
      </main>
      <Footer />
      <Ld data={faqLd(faq)} />
      <Ld
        data={{
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: title,
          description,
          datePublished: '2026-11-06',
          dateModified: '2026-11-06',
          author: { '@type': 'Person', name: 'Kendall Sorenson' },
          publisher: orgLd,
        }}
      />
    </>
  );
}
