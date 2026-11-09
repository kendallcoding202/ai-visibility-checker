import { TRACKER, CITATIONS } from '../links.js';
import { Ld, faqLd, orgLd } from '../site.js';
import Footer from '../Footer.js';

const title = 'How to See Which Sources ChatGPT Cites for a Keyword (2026)';
const description = 'Practical method to see which URLs and domains ChatGPT cites for a keyword or buyer question, manually or with AI Citation Tracker, plus how that differs from brand-mention checks.';
export const metadata = {
  title,
  description,
  alternates: { canonical: '/how-to-see-which-sources-chatgpt-cites' },
  openGraph: { title, description, type: 'article', images: ['/opengraph-image'] },
  authors: [{ name: 'Kendall Sorenson' }],
};

const steps = [
  ['Pick the keyword as a buyer question', 'Turn the keyword into a full question a customer would ask, e.g. "What are the best tools to track ChatGPT citations?" Avoid putting your brand in the question.'],
  ['Ask ChatGPT with web search on', 'Start a fresh chat (incognito helps). Confirm search/browsing is enabled. Copy the answer and every source link ChatGPT shows.'],
  ['Normalize the cited URLs', 'Strip tracking parameters (?utm_…, fbclid). Record the final domain and full URL. Note the order ChatGPT listed them — earlier cites often matter more for follow-up work.'],
  ['Repeat 3–5 times or on different days', 'ChatGPT re-searches. One run is a sample. Count how often each domain appears across repeats to get a citation rate.'],
  ['Compare with Perplexity and Google AI', 'Ask the same question in Perplexity and, when shown, Google AI Overviews / AI Mode. Engines often cite overlapping review sites, docs and Reddit threads — that overlap is your shortlist.'],
  ['Act on the shortlist', 'Pages that cite competitors but not you are the priority for updates, outreach or your own comparison content. Re-check the same prompts after you publish.'],
  ['Automate when the list grows', 'AI Citation Tracker (Apify, by crunchy_galaxy_qcr) runs your prompt list on ChatGPT search, Perplexity and optional Google AI Overviews / AI Mode, extracts ordered citations, and flags prompts where a competitor is cited and you are not. $0.05 per answer; nothing charged when Google shows no AI answer.'],
];

const faq = [
  ['What is the difference between a ChatGPT citation and a ChatGPT brand mention?', 'A citation is a source URL the model used or displayed. A brand mention is your name appearing in the answer text. You can be cited without being recommended, and recommended without your site being cited. Use AI Citation Tracker for sources; use the free AI visibility checker or AI Visibility Tracker for mentions.'],
  ['Can I see ChatGPT sources for free?', 'Yes. ChatGPT with search on shows its sources in the product UI. Record them by hand. The free checker on this site also surfaces cited domains from its ChatGPT web-search answers.'],
  ['Why do listicles and Reddit keep showing up?', 'In our Nov 9 2026 sample of buyer questions about AI visibility and ads libraries, engines often cited review blogs, vendor docs, apify.com, Reddit and similar UGC. Those domains are where a mention compounds.'],
  ['Is this the same as classic SEO rank tracking?', 'No. Classic rank tracking measures Google blue links. This measures which pages generative engines pull into answers. Both matter; the workflows differ.'],
];

export default function Page() {
  const tracker = TRACKER('chatgpt-cites-guide');
  const citations = CITATIONS.replace('utm_content=footer', 'utm_content=chatgpt-cites-guide');
  const howTo = {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: title,
    description,
    step: steps.map(([n, t], i) => ({ '@type': 'HowToStep', position: i + 1, name: n, text: t })),
  };
  return (<>
    <header className="hero"><div className="wrap">
      <h1>How to see which sources ChatGPT cites for a keyword</h1>
      <p>By Kendall Sorenson. A practical method you can do by hand in under an hour, then automate when you have a real prompt list.</p>
    </div></header>
    <main className="wrap">
      <section>
        <p>If you want ChatGPT (or other AI search engines) to recommend you, you need to know which pages those engines already trust for your buyers’ questions. Those cited sources are the shortlist — not a vague “create more content” plan.</p>
        <ol>{steps.map(([n, t]) => <li key={n}><strong>{n}.</strong> {t}</li>)}</ol>
      </section>
      <section>
        <h2>Tools that help</h2>
        <ul>
          <li><a href="/">Free AI visibility checker</a> — quick ChatGPT mention + cited-domain snapshot</li>
          <li><a href={citations}>AI Citation Tracker</a> — ChatGPT citations, Perplexity and Google AI Overviews / AI Mode, structured export</li>
          <li><a href={tracker}>AI Visibility Tracker</a> — whether the answer names your brand (LLM brand monitoring)</li>
        </ul>
        <p>Related: <a href="/which-sites-ai-cites-in-your-niche">which sites AI cites in your niche</a> · <a href="/ai-visibility-tracker-vs-otterly-profound-peec-semrush">tracker vs Otterly / Profound / Peec / Semrush</a></p>
      </section>
      <section>
        <h2>FAQ</h2>
        {faq.map(([q, a]) => <details key={q} open><summary>{q}</summary><p>{a}</p></details>)}
      </section>
      <p><a className="cta" href="/">Run a free check</a> &nbsp; <a href={citations}>Open AI Citation Tracker →</a></p>
    </main>
    <Footer />
    <Ld data={faqLd(faq)} />
    <Ld data={howTo} />
    <Ld data={{ '@context': 'https://schema.org', '@type': 'Article', headline: title, description, datePublished: '2026-11-09', dateModified: '2026-11-09', author: { '@type': 'Person', name: 'Kendall Sorenson' }, publisher: orgLd }} />
  </>);
}
