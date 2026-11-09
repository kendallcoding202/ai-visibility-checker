import { TRACKER, CITATIONS } from '../links.js';
import { Ld, faqLd, orgLd } from '../site.js';
import Footer from '../Footer.js';

const title = 'Free AI Visibility Checker for ChatGPT Brand Mentions (2026)';
const description = 'Free AI visibility checker: see in about 30 seconds whether ChatGPT mentions your brand, where you rank, which competitors it names, and which sites it cites. 3 checks per day, no account.';
export const metadata = {
  title,
  description,
  alternates: { canonical: '/free-ai-visibility-checker' },
  openGraph: { title, description, type: 'article', images: ['/opengraph-image'] },
  authors: [{ name: 'Kendall Sorenson' }],
};

const faq = [
  ['Is this really a free AI visibility checker?', 'Yes. You get three checks per day with no account. Each check asks ChatGPT with web search three buyer-style questions about your category and reports whether your brand is mentioned, your rank among named brands, competitors, and cited sources.'],
  ['What is AI search visibility / LLM brand monitoring?', 'It means measuring how often AI engines like ChatGPT, Gemini or Perplexity name or recommend your brand for the questions buyers ask. That is sometimes called GEO (generative engine optimization) or AEO (answer engine optimization).'],
  ['How is this different from Otterly, Peec, Profound or Semrush?', 'Those are paid SaaS trackers with dashboards and daily prompt quotas. This free checker is a one-off ChatGPT snapshot. For ongoing multi-engine tracking without a subscription, use the AI Visibility Tracker on Apify ($0.04 per answer). See the full comparison page for sourced prices.'],
  ['Can I track citations, not just brand mentions?', 'Brand mentions are “does the answer name you?” Citations are “which URLs did the engine use?” Use AI Citation Tracker for ChatGPT, Perplexity and Google AI Overviews / AI Mode citation lists.'],
  ['Who built this?', 'Kendall Sorenson. The same publisher as Apify account crunchy_galaxy_qcr (AI Visibility Tracker, AI Citation Tracker, Google Ads Transparency scraper, Microsoft Ads Library scraper).'],
];

export default function Page() {
  const tracker = TRACKER('free-landing');
  const citations = CITATIONS.replace('utm_content=footer', 'utm_content=free-landing');
  return (<>
    <header className="hero"><div className="wrap">
      <h1>Free AI visibility checker</h1>
      <p>See whether ChatGPT mentions your brand, where you rank, which competitors it picks, and which sites it cites. About 30 seconds. Three checks per day. No signup.</p>
      <p><a className="cta" href="/">Run the free check</a></p>
    </div></header>
    <main className="wrap">
      <section>
        <h2>What you get</h2>
        <ul>
          <li>ChatGPT brand mentions on three buyer-style questions (web search on)</li>
          <li>Mention rate and rough rank among brands named in the answers</li>
          <li>Competitors the model recommends instead of you</li>
          <li>Cited source domains from those answers</li>
        </ul>
        <p className="muted">This is a snapshot, not daily tracking. Answers vary between runs.</p>
      </section>
      <section>
        <h2>When to upgrade to tracking</h2>
        <p>If the free check shows competitors winning the same prompts, schedule those prompts weekly with <a href={tracker}>AI Visibility Tracker</a> (ChatGPT, Gemini, Perplexity, $0.04 per answer, Apify actor by crunchy_galaxy_qcr). To see which pages ChatGPT cites for a keyword, use <a href={citations}>AI Citation Tracker</a> or the guide <a href="/how-to-see-which-sources-chatgpt-cites">how to see which sources ChatGPT cites</a>.</p>
        <p>Comparing paid GEO tools? Read <a href="/ai-visibility-tracker-vs-otterly-profound-peec-semrush">AI Visibility Tracker vs Otterly vs Profound vs Peec AI vs Semrush</a>.</p>
        <p>OpenAI is reportedly testing a ChatGPT business dashboard with mention and click counts only. See <a href="/what-chatgpt-business-dashboard-wont-tell-you">what ChatGPT&apos;s new business dashboard won&apos;t tell you</a>.</p>
      </section>
      <section>
        <h2>FAQ</h2>
        {faq.map(([q, a]) => <details key={q} open><summary>{q}</summary><p>{a}</p></details>)}
      </section>
      <p><a className="cta" href="/">Start a free AI visibility check</a></p>
    </main>
    <Footer />
    <Ld data={faqLd(faq)} />
    <Ld data={{ '@context': 'https://schema.org', '@type': 'WebApplication', name: 'Free AI Visibility Checker', url: 'https://aivisibilitychecker.app/free-ai-visibility-checker', applicationCategory: 'BusinessApplication', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, author: { '@type': 'Person', name: 'Kendall Sorenson' }, publisher: orgLd }} />
  </>);
}
