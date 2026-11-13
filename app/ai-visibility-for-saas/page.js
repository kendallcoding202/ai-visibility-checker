import Footer from '../Footer.js';
import InlineCheck from '../InlineCheck.js';
import { TRACKER } from '../links.js';
import { Ld, faqLd, orgLd } from '../site.js';
import { buildPrompts } from '../../lib/analyze.js';
import { runLine } from '../../lib/publicResult.js';
import { tracker } from '../../lib/costCompare.js';
import { TRACKING_TIER_BODY, TRACKING_TIER_HEADING, TRACKING_TIER_PRICE } from '../../lib/trackingTier.js';

const title = 'AI visibility for SaaS';
const description = 'How a software company can see whether ChatGPT names its product. The three buyer questions this checker sends, and the fields a finished check returns. No sample score.';
export const metadata = {
  title,
  description,
  alternates: { canonical: '/ai-visibility-for-saas' },
  openGraph: { title, description, type: 'article', images: ['/opengraph-image'] },
  twitter: { card: 'summary_large_image', title, description },
  authors: [{ name: 'Kendall Sorenson' }],
};

const CATEGORY = 'CRM';
const questions = buildPrompts(CATEGORY, 'Example Co');
const fields = [
  ['Answers that mention the brand', 'A count out of 3. The brand is matched against the names in each answer.'],
  ['Average position when mentioned', 'The average of those ranks. Blank when the brand is not named.'],
  ['Visibility score', 'A number from 0 to 100 for that run. It uses how many answers name the brand and, when it is named, how far down the list it sits.'],
  ['Run line', runLine(1, 3)],
  ['Brands ChatGPT recommended', 'Other names in the answers, and how many of the 3 answers included each.'],
  ['Your competitors', 'Shown only if you typed competitors. Each name gets a count out of 3.'],
  ['Top cited sources', 'Domains from the sources on those answers.'],
  ['The questions', 'The three prompts, with mentioned yes or no and a rank on each.'],
];

const faq = [
  [
    'Does the checker have a SaaS setting?',
    'No. Enter the product name and the category buyers use, such as CRM, project management, or invoicing. There is no city field. A category is what turns the questions into buyer questions that do not already name you.',
  ],
  [
    'What if I only enter the product name?',
    'The three questions then ask for alternatives to that name. That is a different check from a category question, which does not include the product name.',
  ],
  [
    'Is this Business Hub?',
    'No. Businesses in ChatGPT includes Business Hub, which shows a business its own mention and click totals. This checker shows the questions, whether the answer named the product, and which other products were named. This page does not state a price for Business Hub.',
  ],
];

export default function Page() {
  return (<>
    <header className="hero"><div className="wrap">
      <h1>AI visibility for SaaS</h1>
      <p>Who this check is for, the questions it sends, and the fields on the result. By Kendall Sorenson. Updated Nov 12, 2026.</p>
      <InlineCheck />
    </div></header>
    <main className="wrap">
      <section>
        <h2>Who it is for</h2>
        <p>A company that sells software and wants to know whether ChatGPT names that product when someone asks for tools in the category. The checker has no separate SaaS mode. You type the product name and, if you want buyer questions, the category.</p>
        <p>The form has no city field. A local business that needs a city in the question would have to put that city in the category text. This page stays with software categories, which fit the three questions as they are written.</p>
      </section>
      <section>
        <h2>Questions to test</h2>
        <p>With the category set to {CATEGORY}, the checker sends these three questions. Your category replaces {CATEGORY}. The product name is not inside the question. After the answers come back, the checker looks for the name you typed.</p>
        <ol>{questions.map((prompt) => <li key={prompt}>{prompt}</li>)}</ol>
        <p>Those are the questions to test for a software category. A manual check in ChatGPT can use the same three. A question that already includes the product name answers something else: what ChatGPT says once the name is supplied.</p>
        <p>The word {CATEGORY} here is an example category, not a measured market.</p>
      </section>
      <section>
        <h2>What a check returns</h2>
        <p>One check is one run of those three questions on ChatGPT with web search. This page does not include a measured brand, a score, or a testimonial. The result for a real check has these fields:</p>
        <div style={{ overflowX: 'auto' }}><table className="cmp">
          <thead><tr><th>Field</th><th>What it contains</th></tr></thead>
          <tbody>{fields.map(([name, text]) => <tr key={name}><td>{name}</td><td>{text}</td></tr>)}</tbody>
        </table></div>
        <p>Raw answer text is shown in the browser that ran the check. It is not put on the share link. Results are cached for 24 hours. The limit is 3 checks per IP per day.</p>
        <p><a className="cta" href="#checker">Open the check form</a></p>
      </section>
      <section>
        <h2>After one snapshot</h2>
        <p>{TRACKING_TIER_HEADING} is {TRACKING_TIER_PRICE} when that plan is offered. {TRACKING_TIER_BODY}</p>
        <p>The <a href={TRACKER('saas')}>AI Visibility Tracker</a> is separate. On Nov 12, 2026 the Apify listing stated ${tracker.pricePerAnswer} per answer on the Free tier, for ChatGPT, Gemini, and Perplexity, with no monthly fee.</p>
        <p>Business Hub shows your own ChatGPT totals after a claim. It does not show the three questions above. See <a href="/business-hub-vs-free-ai-visibility-checker">Business Hub vs the free checker</a>. This page does not state a price for Business Hub.</p>
      </section>
      <section>
        <h2>Related</h2>
        <p><a href="/how-to-check-if-chatgpt-mentions-your-brand">How to check if ChatGPT mentions your brand</a> includes the manual method and the form. <a href="/otterly-alternatives">Otterly alternatives</a> lists public prices checked Nov 12, 2026. <a href="/free-ai-visibility-checker">The free checker</a> explains the snapshot.</p>
      </section>
      <section>
        <h2>FAQ</h2>
        {faq.map(([q, a]) => <details key={q} open><summary>{q}</summary><p>{a}</p></details>)}
      </section>
    </main>
    <Footer />
    <Ld data={faqLd(faq)} />
    <Ld data={{ '@context': 'https://schema.org', '@type': 'Article', headline: title, description, datePublished: '2026-11-12', dateModified: '2026-11-12', author: { '@type': 'Person', name: 'Kendall Sorenson' }, publisher: orgLd }} />
  </>);
}
