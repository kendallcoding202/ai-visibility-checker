import Footer from '../Footer.js';
import InlineCheck from '../InlineCheck.js';
import { TRACKER } from '../links.js';
import { Ld, faqLd, orgLd } from '../site.js';
import { buildPrompts } from '../../lib/analyze.js';
import { tracker } from '../../lib/costCompare.js';
import { TRACKING_TIER_BODY, TRACKING_TIER_HEADING, TRACKING_TIER_PRICE } from '../../lib/trackingTier.js';

const title = 'How to check if ChatGPT mentions your brand';
const description = 'Check by hand whether ChatGPT mentions your brand, or use the free checker on this site. The checker asks three buyer-style questions with web search and reports one run.';
export const metadata = {
  title,
  description,
  alternates: { canonical: '/how-to-check-if-chatgpt-mentions-your-brand' },
  openGraph: { title, description, type: 'article', images: ['/opengraph-image'] },
  twitter: { card: 'summary_large_image', title, description },
  authors: [{ name: 'Kendall Sorenson' }],
};

const EXAMPLE = 'CRM';
const withCategory = buildPrompts(EXAMPLE, 'Example Co');
const brandOnly = buildPrompts('', 'Example Co');

const steps = [
  ['Write questions that do not name your brand', 'Use the words a buyer would type before they know the product name. "What are the best CRM tools right now?" is that kind of question. A question that already includes the name only shows whether ChatGPT will repeat it.'],
  ['Start a new chat', 'Ask the question in a new chat, not as a follow-up. A follow-up keeps the earlier answer in the conversation. A logged-out window is one way to open a chat that is not tied to an older one.'],
  ['Use web search when the chat offers it', 'This site\'s checker always asks with web search. On the answer, write down four things: whether the brand name appears, where it sits among the names, which other brands are named, and which sources are shown.'],
  ['Ask again', 'Run the same question in another new chat. One answer is one snapshot. How often the name appears depends on how many times you asked.'],
];

const faq = [
  ['Can I check ChatGPT brand mentions without an account?', 'Yes. You can ask in ChatGPT yourself, or use the checker on this page. The checker needs a brand name. It does not need an account or a website URL. The limit is 3 checks per IP per day.'],
  ['Does the checker use my questions?', 'No. If you enter a category, it sends the three questions shown on this page, with your category filled in. Those questions do not include your brand name. If you leave the category blank, the three questions name the brand and ask for alternatives.'],
  ['What does monthly tracking include?', `${TRACKING_TIER_HEADING} is ${TRACKING_TIER_PRICE} when that plan is offered. ${TRACKING_TIER_BODY}`],
];

export default function Page() {
  const howTo = {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: title,
    description,
    step: steps.map(([name, text], i) => ({ '@type': 'HowToStep', position: i + 1, name, text })),
  };
  return (<>
    <header className="hero"><div className="wrap">
      <h1>How to check if ChatGPT mentions your brand</h1>
      <p>A manual method, then the free checker. By Kendall Sorenson. Updated Nov 12, 2026.</p>
      <InlineCheck />
    </div></header>
    <main className="wrap">
      <section>
        <h2>Check it by hand</h2>
        <ol>{steps.map(([name, text]) => <li key={name}><strong>{name}.</strong> {text}</li>)}</ol>
      </section>
      <section>
        <h2>What the free checker asks</h2>
        <p>With the category set to {EXAMPLE}, the checker sends these three questions. It then looks for the brand name in the answers. The questions themselves do not include the brand.</p>
        <ol>{withCategory.map((prompt) => <li key={prompt}>{prompt}</li>)}</ol>
        <p>The word {EXAMPLE} is only an example. The category you type replaces it. The same three patterns are in the checker code.</p>
        <p>If the category is left blank, the checker names the brand instead. For the brand Example Co, the three questions are:</p>
        <ol>{brandOnly.map((prompt) => <li key={prompt}>{prompt}</li>)}</ol>
        <p>Example Co is a stand-in so you can see the wording. It is not a result from a check.</p>
      </section>
      <section>
        <h2>Run the check</h2>
        <p>The form at the top of this page is the checker. A brand name is enough. A category is optional. Three checks per IP per day. The result is one run of three questions.</p>
      </section>
      <section>
        <h2>What the result shows</h2>
        <p>The result page shows how many of the three answers mention the brand, the average position when it is mentioned, and a visibility score from 0 to 100 for that run. It also lists other brands named in the answers, cited domains, and the three questions. The line on the result reads: this score is based on 1 run of 3 questions. One run is a single snapshot, so the score can move on the next run.</p>
        <p>Raw answer text stays in the browser that ran the check. The share link does not include it. This page does not show a sample score.</p>
      </section>
      <section>
        <h2>Checking the same brand again</h2>
        <p>{TRACKING_TIER_HEADING} is {TRACKING_TIER_PRICE} when that plan is offered. {TRACKING_TIER_BODY} The <a href="/privacy">privacy policy</a> describes the same offer.</p>
        <p>A separate product, the <a href={TRACKER('mentions-guide')}>AI Visibility Tracker</a>, charges ${tracker.pricePerAnswer} per answer on the Apify Free tier and can run ChatGPT, Gemini, and Perplexity. It is not the monthly plan above.</p>
      </section>
      <section>
        <h2>Related</h2>
        <p>A shorter checklist is on <a href="/how-to-check-chatgpt-brand-mentions">how to check if ChatGPT recommends your brand</a>. For a software company, see <a href="/ai-visibility-for-saas">AI visibility for SaaS</a>. For prices, see <a href="/otterly-alternatives">Otterly alternatives</a> and <a href="/profound-alternatives">Profound alternatives</a>. Business Hub shows a business its own ChatGPT totals. This page does not state a price for Business Hub. See <a href="/business-hub-vs-free-ai-visibility-checker">Business Hub vs the free checker</a>.</p>
      </section>
      <section>
        <h2>FAQ</h2>
        {faq.map(([q, a]) => <details key={q} open><summary>{q}</summary><p>{a}</p></details>)}
      </section>
    </main>
    <Footer />
    <Ld data={faqLd(faq)} />
    <Ld data={howTo} />
    <Ld data={{ '@context': 'https://schema.org', '@type': 'Article', headline: title, description, datePublished: '2026-11-12', dateModified: '2026-11-12', author: { '@type': 'Person', name: 'Kendall Sorenson' }, publisher: orgLd }} />
  </>);
}
