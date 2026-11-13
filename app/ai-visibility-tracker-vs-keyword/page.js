import InlineCheck from '../InlineCheck.js';
import { TRACKER } from '../links.js';
import { Ld, faqLd, orgLd } from '../site.js';
import Footer from '../Footer.js';

const title = 'AI Visibility Tracker vs Keyword.com (Nov 12, 2026)';
const description = 'AI Visibility Tracker is $0.0375 per answer on the Apify Free tier. Keyword.com AI Visibility starts at $9.80/month. Prices read from each vendor’s own page on Nov 12, 2026.';
export const metadata = {
  title,
  description,
  alternates: { canonical: '/ai-visibility-tracker-vs-keyword' },
  openGraph: { title, description, type: 'article', images: ['/opengraph-image'] },
  twitter: { card: 'summary_large_image', title, description },
  authors: [{ name: 'Kendall Sorenson' }],
};

const ACTOR = 'https://apify.com/crunchy_galaxy_qcr/ai-visibility-tracker';
const KEYWORD = 'https://keyword.com/pricing/';

const faq = [
  [
    'Is Keyword.com Search Visibility the AI plan?',
    'No. On Nov 12, 2026 the pricing page listed Search Visibility from $4/month ($3/month billed annually) as Google SERP tracking. AI Visibility is a separate plan from $9.80/month.',
  ],
  [
    'Does the tracker have a monthly minimum?',
    'No. The Apify listing charges per answer. The Free tier was $0.0375 per answer on Nov 12, 2026. Failed answers are not charged.',
  ],
];

export default function Page() {
  const tracker = TRACKER('vs-keyword');
  return (<>
    <header className="hero"><div className="wrap">
      <h1>AI Visibility Tracker vs Keyword.com</h1>
      <p>By Kendall Sorenson. Both prices were read from the vendor’s own page on Nov 12, 2026. I built the tracker.</p>
      <InlineCheck />
    </div></header>
    <main className="wrap">
      <section>
        <h2>Price</h2>
        <div style={{ overflowX: 'auto' }}><table className="cmp">
          <thead><tr><th></th><th>AI Visibility Tracker</th><th>Keyword.com</th></tr></thead>
          <tbody>
            <tr><td>AI tracking price</td><td>$0.0375 per answer on the Apify Free tier</td><td>AI Visibility $9.80/month, or $7.83/month billed annually ($94/year), for 100 credits</td></tr>
            <tr><td>Other published tiers</td><td>Bronze 0.034 dollars, Silver 0.03 dollars, Gold and higher 0.028 dollars per answer</td><td>Search Visibility $4/month ($3/month annually) is Google rank tracking. 360° Visibility is $33/month ($26/month annually) and includes AI credits</td></tr>
            <tr><td>Monthly fee</td><td>None</td><td>The AI Visibility plan is a subscription</td></tr>
            <tr><td>What you get</td><td>Answers you request, with rank, share of voice, sentiment, cited domains, and gap prompts. ChatGPT, Gemini model knowledge, and Perplexity</td><td>AI visibility credits, competitor tracking, and citation analysis on the AI Visibility plan</td></tr>
            <tr><td>Source</td><td><a href={ACTOR}>Apify listing</a></td><td><a href={KEYWORD}>keyword.com/pricing</a></td></tr>
          </tbody>
        </table></div>
      </section>
      <section>
        <h2>How to choose</h2>
        <p>Use <a href={tracker}>AI Visibility Tracker</a> when you want to pay for the answers you run and keep the JSON. A run of 3 prompts on 3 engines is 9 answers, about $0.34 on the Free tier (9 × $0.0375).</p>
        <p>Use <a href={KEYWORD}>Keyword.com AI Visibility</a> when you want a hosted subscription that starts at $9.80/month for 100 credits. Do not compare the tracker with the $4 Search Visibility plan. That plan is Google rank tracking.</p>
        <p>For a single ChatGPT snapshot, use the <a href="/">free checker</a>. It is 3 checks a day and it is not either of the products in the table.</p>
        <p>Business Hub is separate again. OpenAI’s pages cited on <a href="/business-hub-vs-ai-visibility-tracker">Business Hub vs AI Visibility Tracker</a> do not state a price for it. This page does not either.</p>
      </section>
      <section>
        <h2>FAQ</h2>
        {faq.map(([q, a]) => <details key={q} open><summary>{q}</summary><p>{a}</p></details>)}
      </section>
      <p><a className="cta" href={tracker}>Open AI Visibility Tracker</a> &nbsp; <a href="/profound-alternatives">Other public prices</a></p>
    </main>
    <Footer />
    <Ld data={faqLd(faq)} />
    <Ld data={{ '@context': 'https://schema.org', '@type': 'Article', headline: title, description, datePublished: '2026-11-12', dateModified: '2026-11-12', author: { '@type': 'Person', name: 'Kendall Sorenson' }, publisher: orgLd }} />
  </>);
}
