import { TRACKER, CITATIONS } from '../links.js';
import { Ld, faqLd, orgLd } from '../site.js';
import Footer from '../Footer.js';

const title = "What ChatGPT's New Business Dashboard Won't Tell You (2026)";
const description = "OpenAI is testing a ChatGPT business dashboard with mention and click counts only. What it reportedly won't show: prompts, competitor ranking, or why numbers move — and what to use instead.";
export const metadata = {
  title,
  description,
  alternates: { canonical: '/what-chatgpt-business-dashboard-wont-tell-you' },
  openGraph: { title, description, type: 'article', images: ['/opengraph-image'] },
  authors: [{ name: 'Kendall Sorenson' }],
};

const FETCHED = '2026-11-09';

const gaps = [
  ['Which prompts triggered the mention', 'Search Engine Land quotes Juozas Kaziukėnas: the dashboard “doesn’t show prompts, user data, or any kind of competition benchmark or ranking.” Digiday reports the same: prompts stay hidden.'],
  ['Competitor ranking or share of voice', 'Both reports say there is no competition benchmark. A mention count alone cannot tell you who ChatGPT named instead of you.'],
  ['Why impressions or clicks moved', 'Search Engine Land notes it “won’t help understanding why mentions/clicks are increasing or decreasing,” and that first-party counts are most useful combined with external tools that track prompts.'],
  ['Answers from other AI engines', 'The reported dashboard is ChatGPT-only (inside a still-unreleased Business Hub). It does not cover Perplexity, Gemini, Google AI Overviews / AI Mode, or Copilot.'],
];

const faq = [
  [
    'Is ChatGPT’s business analytics dashboard live?',
    'Not as a general launch as of ' + FETCHED + '. Search Engine Land (Nov 6, 2026) and Digiday (Nov 9, 2026) report OpenAI is testing / working on it inside a Business Hub that has not launched. OpenAI declined to comment to Digiday. Treat it as reported testing, not a shipped product.',
  ],
  [
    'What does the dashboard supposedly show?',
    'Per the LinkedIn notes Digiday and Search Engine Land both cite: daily impressions (how often a business appeared in ChatGPT responses) and clicks to the business website, plotted on a chart. Claiming a business (for example by connecting Shopify) is described as part of access.',
  ],
  [
    'What won’t it show?',
    'According to those same reports: no prompts, no user data, and no competitor ranking or competition benchmark. That is the gap prompt-level trackers fill.',
  ],
  [
    'How is that different from the free checker on this site?',
    'The free checker asks ChatGPT with web search three buyer-style questions about your category and reports whether your brand is named, rough rank among brands in those answers, competitors named, and cited domains. It is a prompt-level snapshot (3 checks/day), not OpenAI first-party traffic counts.',
  ],
  [
    'When should I use AI Visibility Tracker or AI Citation Tracker instead?',
    'Use AI Visibility Tracker when you need repeatable brand-mention / share-of-voice checks across ChatGPT, Gemini and Perplexity ($0.04 per answer on Apify). Use AI Citation Tracker when you need the ordered source URLs ChatGPT, Perplexity and optional Google AI Overviews / AI Mode cite ($0.05 per answer). Neither replaces OpenAI’s own impression/click counts if those eventually ship.',
  ],
];

export default function Page() {
  const tracker = TRACKER('chatgpt-dashboard-gap');
  const citations = CITATIONS.replace('utm_content=footer', 'utm_content=chatgpt-dashboard-gap');
  return (<>
    <header className="hero"><div className="wrap">
      <h1>What ChatGPT&apos;s new business dashboard won&apos;t tell you</h1>
      <p>By Kendall Sorenson. OpenAI is reportedly testing mention and click counts for verified businesses. That is useful first-party data — and still leaves the questions marketers actually ask unanswered.</p>
    </div></header>
    <main className="wrap">
      <section>
        <h2>What is being reported</h2>
        <p>As of {FETCHED}, OpenAI has not published a full product page for this feature. Two trade publications describe the same early build:</p>
        <ul>
          <li><a href="https://searchengineland.com/openai-testing-business-tools-to-track-performance-within-chatgpt-500841">Search Engine Land (Nov 6, 2026)</a> — OpenAI testing business tools to track performance inside ChatGPT; impressions, clicks, daily chart; Business Hub; ownership verification (e.g. Shopify).</li>
          <li><a href="https://digiday.com/marketing/chatgpt-is-about-to-show-brands-their-mention-count/">Digiday (Nov 9, 2026)</a> — analytics dashboard counting how often a business shows up and how many clicks those appearances send; sits inside a Business Hub that has not launched; OpenAI declined to comment.</li>
        </ul>
        <p className="muted">Status: reported testing / work in progress. Not confirmed as generally available.</p>
      </section>

      <section>
        <h2>What the dashboard reportedly will show</h2>
        <ul>
          <li>How often your business is mentioned in ChatGPT responses (impressions)</li>
          <li>Clicks from those appearances to your website</li>
          <li>Those events plotted daily on a chart</li>
          <li>A path to claim / verify the business and keep product or business info current (Business Hub / business agent context)</li>
        </ul>
        <p>If it ships, that first-party count is something no third-party prompt sampler can fully replace. Digiday and Search Engine Land both frame outside GEO tools as complementary, not obsolete.</p>
      </section>

      <section>
        <h2>What it won&apos;t tell you</h2>
        <ol>{gaps.map(([n, t]) => <li key={n}><strong>{n}.</strong> {t}</li>)}</ol>
      </section>

      <section>
        <h2>What fills those gaps today</h2>
        <ul>
          <li><a href="/">Free AI visibility checker</a> — three ChatGPT buyer questions, brand mention, rough rank, competitors, cited domains. No account. Snapshot only.</li>
          <li><a href={tracker}>AI Visibility Tracker</a> (Apify, crunchy_galaxy_qcr) — prompt-level brand mentions, rank, share of voice, sentiment and cited sources across ChatGPT, Gemini and Perplexity. $0.04 per answer. Schedule weekly yourself.</li>
          <li><a href={citations}>AI Citation Tracker</a> — which URLs ChatGPT, Perplexity and optional Google AI Overviews / AI Mode cite, plus citation share vs competitor domains. $0.05 per answer.</li>
        </ul>
        <p>Honest split: OpenAI&apos;s dashboard (if launched) answers “how many times did ChatGPT show us, and did people click?” Prompt trackers answer “for these buyer questions, who got named, in what order, and which pages were cited?” You eventually want both.</p>
      </section>

      <section>
        <h2>Related</h2>
        <p>
          <a href="/free-ai-visibility-checker">Free AI visibility checker</a>
          {' · '}
          <a href="/ai-visibility-tracker-vs-otterly-profound-peec-semrush">Tracker vs Otterly / Profound / Peec / Semrush</a>
          {' · '}
          <a href="/how-to-see-which-sources-chatgpt-cites">How to see which sources ChatGPT cites</a>
        </p>
      </section>

      <section>
        <h2>FAQ</h2>
        {faq.map(([q, a]) => <details key={q} open><summary>{q}</summary><p>{a}</p></details>)}
      </section>

      <p><a className="cta" href="/">Run a free ChatGPT visibility check</a> &nbsp; <a href={tracker}>Open AI Visibility Tracker →</a></p>
    </main>
    <Footer />
    <Ld data={faqLd(faq)} />
    <Ld data={{ '@context': 'https://schema.org', '@type': 'Article', headline: title, description, datePublished: '2026-11-09', dateModified: '2026-11-09', author: { '@type': 'Person', name: 'Kendall Sorenson' }, publisher: orgLd }} />
  </>);
}
