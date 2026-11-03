import Checker from './Checker.js';
import { TRACKER, ADS, CITATIONS } from './links.js';
import { Ld, orgLd, appLd } from './site.js';

const faq = [
  ['What is AI search visibility?', 'AI search visibility is how often AI assistants such as ChatGPT, Gemini and Perplexity mention or recommend your brand when people ask questions in your category. It is the AI-era version of ranking on Google.'],
  ['What is GEO (generative engine optimization)?', 'GEO, also called AEO (answer engine optimization) or LLM SEO, is the practice of improving how often and how favorably AI answers mention your brand, for example by earning mentions on the sources AI cites, publishing clear comparison content and keeping your product facts consistent across the web.'],
  ['How does this free checker work?', 'We ask ChatGPT (an OpenAI model with live web search) three buyer-style questions about your category, then detect whether your brand is mentioned, where it ranks, which competitors appear and which websites are cited.'],
  ['Is it really free?', 'Yes. You get 3 free checks per day. Results are cached for 24 hours. For ongoing tracking across ChatGPT, Gemini and Perplexity with your own prompts, use the full AI Visibility Tracker.'],
  ['Why do results change between checks?', 'AI answers are non-deterministic and depend on wording, location and fresh web results. That is why one snapshot is a starting point, and weekly tracking shows the real trend.'],
  ['Do you store my data?', 'We store the anonymous result (brand, category and the AI answers) so repeat checks are instant and share links work, plus a hashed counter for rate limiting. No accounts, no email, no personal data.'],
];

export default function Page() {
  const ld = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) };
  return (<>
    <header className="hero"><div className="wrap">
      <h1>Free AI Visibility Checker: does ChatGPT recommend your brand?</h1>
      <p>Enter your brand and category. In about 30 seconds see if ChatGPT mentions you, your rank, which competitors it picks and which sources it cites.</p>
      <Checker />
    </div></header>
    <main className="wrap">
      <section>
        <h2>Why AI search visibility matters</h2>
        <p>More buyers now ask ChatGPT, Gemini and Perplexity “what's the best tool for…” instead of searching Google. If AI assistants don't mention your brand, you're invisible at the exact moment a buyer is choosing. <strong>Generative engine optimization (GEO)</strong>, also called AEO or LLM SEO, is how brands win those AI answers.</p>
        <p>This free tool gives you a quick snapshot of your <strong>ChatGPT brand mentions</strong>: mention rate, ranking position, competitor share and the cited sources that shape AI answers. To measure share of voice over time, use the <a href={TRACKER('explainer')}>AI Visibility Tracker</a>.</p>
      </section>
      <section>
        <h2>Compare and learn</h2>
        <p><a href="/best-ai-visibility-tools">Best tools to check whether ChatGPT recommends your brand</a> · <a href="/how-to-check-chatgpt-brand-mentions">How to check if ChatGPT recommends your brand</a></p>
      </section>
      <section>
        <h2>FAQ</h2>
        {faq.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}
      </section>
    </main>
    <footer><div className="wrap">
      <p>Built by Kendall Sorenson.</p>
      <p>Tools: <a href={TRACKER('footer')}>AI Visibility Tracker (ChatGPT, Gemini &amp; Perplexity)</a> · <a href={CITATIONS}>AI Citation Tracker (which sites ChatGPT cites)</a> · <a href={ADS}>Google Ads Transparency &amp; Ad Library Scraper</a></p>
      <p className="muted">Not affiliated with OpenAI or Google. Results are a single AI snapshot and may vary.</p>
      <p className="fazier"><a href="https://fazier.com" target="_blank" rel="noopener"><img src="https://fazier.com/api/v1//public/badges/launch_badges.svg?badge_type=featured&theme=light" width={160} alt="Fazier badge" /></a></p>
    </div></footer>
    <Ld data={orgLd} /><Ld data={appLd} />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
  </>);
}
