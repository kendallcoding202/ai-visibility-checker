import InlineCheck from '../InlineCheck.js';
import { TRACKER } from '../links.js';
import { Ld, faqLd, orgLd } from '../site.js';
import Footer from '../Footer.js';

const title = 'Business Hub vs the free AI visibility checker';
const description = 'Business Hub shows a business its own ChatGPT mention and click totals. The free checker shows the questions, the competitors, and whether ChatGPT named the brand. No price is stated for Business Hub.';
export const metadata = {
  title,
  description,
  alternates: { canonical: '/business-hub-vs-free-ai-visibility-checker' },
  openGraph: { title, description, type: 'article', images: ['/opengraph-image'] },
  twitter: { card: 'summary_large_image', title, description },
  authors: [{ name: 'Kendall Sorenson' }],
};

const ANNOUNCEMENT = 'https://openai.com/index/introducing-businesses-chatgpt';
const HELP = 'https://help.openai.com/en/articles/20001635-setting-up-your-business-on-chatgpt';
const PRODUCT = 'https://openai.com/business/businesses-in-chatgpt/';

const faq = [
  [
    'Do I need an account for the free checker?',
    'No. A brand name is enough. A website URL is not required. The limit is 3 checks per IP per day.',
  ],
  [
    'Does Business Hub show the questions?',
    'No. OpenAI’s Help Center says businesses do not receive individual prompts or consumer conversations. Discovery topics are themes, not the questions.',
  ],
  [
    'What does a mention mean in each product?',
    'For an online business, OpenAI counts a mention when ChatGPT references the website. The brand name alone does not count. This checker counts whether the answer text names the brand.',
  ],
];

export default function Page() {
  const tracker = TRACKER('business-hub-vs-free');
  return (<>
    <header className="hero"><div className="wrap">
      <h1>Business Hub vs the free AI visibility checker</h1>
      <p>By Kendall Sorenson. OpenAI launched Businesses in ChatGPT in beta on Nov 10, 2026. Business Hub and this checker answer different questions.</p>
      <p className="muted">Updated Nov 12, 2026.</p>
      <InlineCheck />
    </div></header>
    <main className="wrap">
      <section>
        <h2>Side by side</h2>
        <div style={{ overflowX: 'auto' }}><table className="cmp">
          <thead><tr><th></th><th>Business Hub</th><th>Free AI visibility checker</th></tr></thead>
          <tbody>
            <tr><td>What it measures</td><td>Aggregate ChatGPT usage for a claimed business</td><td>Three buyer-style questions asked by this site</td></tr>
            <tr><td>Mentions</td><td>Past 28 days, after claim approval and Persona verification</td><td>Whether the answer names the brand, on that run</td></tr>
            <tr><td>Website clicks</td><td>Yes. First-party click counts</td><td>No click logs</td></tr>
            <tr><td>The questions</td><td>Not shared</td><td>Shown, with mention and rank</td></tr>
            <tr><td>Competitors</td><td>Not in the published Insights</td><td>Brands named in the answers</td></tr>
            <tr><td>Raw answers</td><td>Not shared</td><td>Shown in the browser that ran the check. Not on the share link</td></tr>
            <tr><td>Runs behind the score</td><td>Usage over 28 days, when the threshold is met</td><td>1 run of 3 questions</td></tr>
            <tr><td>Account</td><td>Claim the business and complete Persona verification</td><td>None</td></tr>
            <tr><td>Price</td><td>Not stated on the OpenAI pages cited here</td><td>$0. 3 checks per IP per day</td></tr>
          </tbody>
        </table></div>
      </section>
      <section>
        <h2>What Business Hub is</h2>
        <p><a href={ANNOUNCEMENT}>Businesses in ChatGPT</a> opened in beta on Nov 10, 2026. Through <a href={PRODUCT}>Business Hub</a>, a business can claim its listing and, after the claim is approved and Persona identity verification is complete, see Insights: mentions, website clicks, and discovery topics for the past 28 days. The <a href={HELP}>Help Center</a> says an online mention counts when ChatGPT references the website, not when the brand name appears alone. Businesses do not receive individual prompts or consumer conversations. A blank metric can mean the reporting threshold was not met. It does not have to mean zero activity.</p>
        <p>The OpenAI pages above do not list a price for claiming a business or for viewing Insights.</p>
      </section>
      <section>
        <h2>What the free checker is</h2>
        <p>The <a href="/">checker</a> asks ChatGPT, with web search, three questions. You can enter a brand name alone, or add a category. It reports whether the brand was named, a rough rank, other brands, and cited domains. The score is one run. The raw answer text stays with the browser that ran the check.</p>
        <p>It does not show how many people clicked a site inside ChatGPT, and it is not OpenAI’s usage total.</p>
      </section>
      <section>
        <h2>What to use</h2>
        <ul>
          <li>Business Hub, after claim and verification, when you want your own mention and click totals.</li>
          <li><a href="/">The free checker</a> when you want the questions and the competitors, with no account.</li>
          <li><a href={tracker}>AI Visibility Tracker</a> when you want those questions on a schedule, on ChatGPT, Gemini, and Perplexity, at $0.0375 per answer on the Apify Free tier.</li>
        </ul>
        <p>A longer split of Business Hub and the tracker is on <a href="/business-hub-vs-ai-visibility-tracker">Business Hub vs AI Visibility Tracker</a>.</p>
      </section>
      <section>
        <h2>FAQ</h2>
        {faq.map(([q, a]) => <details key={q} open><summary>{q}</summary><p>{a}</p></details>)}
      </section>
      <p><a className="cta" href="#checker">Run a free check</a></p>
    </main>
    <Footer />
    <Ld data={faqLd(faq)} />
    <Ld data={{ '@context': 'https://schema.org', '@type': 'Article', headline: title, description, datePublished: '2026-11-12', dateModified: '2026-11-12', author: { '@type': 'Person', name: 'Kendall Sorenson' }, publisher: orgLd }} />
  </>);
}
