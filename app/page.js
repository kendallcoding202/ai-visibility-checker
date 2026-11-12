import Checker from './Checker.js';
import Lookup from './Lookup.js';
import { TRACKER, ADS, CITATIONS } from './links.js';
import { Ld, orgLd, appLd } from './site.js';
import TrackLink from './TrackLink.js';
import { EVENTS } from '../lib/analyticsEvents.js';
import { COST_AS_OF_LABEL, freeChecker, tracker, otterly, keyword } from '../lib/costCompare.js';
import { emailCaptureEnabled } from '../lib/emailAddress.js';
import { paidReportEnabled } from '../lib/paidReport.js';
import { trackingTierEnabled } from '../lib/trackingTier.js';

const faq = [
  ['What is AI search visibility?', 'AI search visibility is how often AI assistants such as ChatGPT, Gemini and Perplexity mention or recommend your brand when people ask questions in your category. It is the AI-era version of ranking on Google.'],
  ['What is GEO (generative engine optimization)?', 'GEO, also called AEO (answer engine optimization) or LLM SEO, is the practice of improving how often and how favorably AI answers mention your brand, for example by earning mentions on the sources AI cites, publishing clear comparison content and keeping your product facts consistent across the web.'],
  ['How does this free checker work?', 'Enter a brand name on its own, or add a category. We ask ChatGPT (an OpenAI model with live web search) three buyer-style questions, then detect whether your brand is mentioned, where it ranks, which competitors appear and which websites are cited. The score is one run of those three questions. For a manual method, read how to see which sources ChatGPT cites.'],
  ['Is it really free?', 'Yes. You get 3 free checks per day. Results are cached for 24 hours. For ongoing tracking across ChatGPT, Gemini and Perplexity with your own prompts, use the full AI Visibility Tracker. The free AI visibility checker page explains what each check includes. For sourced prices, see AI Visibility Tracker vs Otterly, Profound, Peec AI and Semrush.'],
  ['Why do results change between checks?', 'AI answers are non-deterministic and depend on wording, location and fresh web results. That is why one snapshot is a starting point, and weekly tracking shows the real trend.'],
  ['Do you store my data?', 'We store the check result (brand, category, scores, questions, and cited domains) so a repeat check is instant and a share link works, plus a hashed counter for rate limiting. Raw answers stay with the browser that ran the check and are not put on the share link. If you ask for the report by email, we store that address until you unsubscribe. See the privacy policy. We also use Vercel Web Analytics for aggregate page views and actions. Event properties do not include your brand name, email, IP, or the text you type. Views and clicks on monthly tracking, checkout starts, and completed subscriptions are daily totals without a brand, email, or IP.'],
];

const faqLinks = [
  ['how to see which sources ChatGPT cites', '/how-to-see-which-sources-chatgpt-cites'],
  ['free AI visibility checker page', '/free-ai-visibility-checker'],
  ['AI Visibility Tracker vs Otterly, Profound, Peec AI and Semrush', '/ai-visibility-tracker-vs-otterly-profound-peec-semrush'],
  ['privacy policy', '/privacy'],
];
function CostCompare() {
  return (<section id="cost">
    <h2>What a check costs</h2>
    <p><strong>No monthly fee. No minimum. Pay only per check.</strong> This checker is free, {freeChecker.checksPerIpPerDay} checks per IP per day. The <a href={tracker.source}>AI Visibility Tracker</a> is ${tracker.pricePerAnswer} per answer on Apify.</p>
    <ul className="costs">
      <li><strong>Otterly.AI from ${otterly.monthlyPrice}/mo</strong> ({otterly.plan}). As of {COST_AS_OF_LABEL}. <a href={otterly.source}>Source</a>.</li>
      <li><strong>Keyword.com from ${keyword.monthlyPrice.toFixed(2)}/mo</strong> ({keyword.plan}). As of {COST_AS_OF_LABEL}. <a href={keyword.source}>Source</a>.</li>
    </ul>
  </section>);
}

function LinkedText({ text }) {
  const out = [];
  let rest = text;
  let k = 0;
  while (rest) {
    let hit = null;
    for (const [phrase, href] of faqLinks) {
      const i = rest.indexOf(phrase);
      if (i !== -1 && (!hit || i < hit.i)) hit = { i, phrase, href };
    }
    if (!hit) { out.push(rest); break; }
    if (hit.i) out.push(rest.slice(0, hit.i));
    out.push(<a key={k++} href={hit.href}>{hit.phrase}</a>);
    rest = rest.slice(hit.i + hit.phrase.length);
  }
  return out;
}

export default function Page() {
  const ld = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) };
  return (<>
    <header className="hero"><div className="wrap">
      <h1>Free AI Visibility Checker: does ChatGPT recommend your brand?</h1>
      <p>See who ChatGPT recommends in your market. Then check whether it names your brand, your rank, which competitors it picks and which sources it cites.</p>
      <Lookup />
      <h2 id="checker">Check your brand</h2>
      <Checker showPaidReport={paidReportEnabled()} showTrackingTier={trackingTierEnabled()} emailCapture={emailCaptureEnabled()} />
    </div></header>
    <main className="wrap">
      <section>
        <h2>Why AI search visibility matters</h2>
        <p>More buyers now ask ChatGPT, Gemini and Perplexity “what's the best tool for…” instead of searching Google. If AI assistants don't mention your brand, you're invisible at the exact moment a buyer is choosing. <strong>Generative engine optimization (GEO)</strong>, also called AEO or LLM SEO, is how brands win those AI answers.</p>
        <p>This free tool gives you a quick snapshot of your <strong>ChatGPT brand mentions</strong>: mention rate, ranking position, competitor share and the cited sources that shape AI answers. Business Hub shows your own ChatGPT totals. This checker shows which questions, which competitors, and whether ChatGPT named you. To measure share of voice over time across ChatGPT, Gemini and Perplexity, use the <TrackLink href={TRACKER('explainer')} event={EVENTS.TRACKER_CTA_CLICK} location="explainer">AI Visibility Tracker</TrackLink>.</p>
      </section>
      <section>
        <h2>Compare and learn</h2>
        <p><a href="/best-ai-visibility-tools">Best tools to check whether ChatGPT recommends your brand</a> · <a href="/free-ai-visibility-checker">Free AI visibility checker</a> · <a href="/profound-alternatives">Profound alternatives</a> · <a href="/ai-visibility-tracker-vs-otterly-profound-peec-semrush">AI Visibility Tracker vs Otterly, Profound, Peec AI and Semrush</a> · <a href="/ai-visibility-tracker-vs-keyword">AI Visibility Tracker vs Keyword.com</a> · <a href="/how-to-check-chatgpt-brand-mentions">How to check if ChatGPT recommends your brand</a> · <a href="/how-to-see-which-sources-chatgpt-cites">How to see which sources ChatGPT cites</a> · <a href="/why-chatgpt-recommends-competitors">Why ChatGPT recommends your competitors</a> · <a href="/which-sites-ai-cites-in-your-niche">Which sites AI Overviews and ChatGPT cite</a> · <a href="/what-chatgpt-business-dashboard-wont-tell-you">What ChatGPT&apos;s new business dashboard won&apos;t tell you</a> · <a href="/business-hub-vs-ai-visibility-tracker">Business Hub vs AI Visibility Tracker</a> · <a href="/business-hub-vs-free-ai-visibility-checker">Business Hub vs the free checker</a> · <a href="/how-to-check-if-chatgpt-mentions-your-brand">How to check if ChatGPT mentions your brand</a> · <a href="/otterly-alternatives">Otterly alternatives</a> · <a href="/ai-visibility-for-saas">AI visibility for SaaS</a></p>
      </section>
      <CostCompare />
      <section>
        <h2>FAQ</h2>
        {faq.map(([q, a]) => <details key={q}><summary>{q}</summary><p><LinkedText text={a} /></p></details>)}
      </section>
    </main>
    <footer><div className="wrap">
      <p><a href="/how-to-check-if-chatgpt-mentions-your-brand">How to check if ChatGPT mentions your brand</a> · <a href="/otterly-alternatives">Otterly alternatives</a> · <a href="/ai-visibility-for-saas">AI visibility for SaaS</a></p>
      <p>Built by Kendall Sorenson.</p>
      <p>Tools: <TrackLink href={TRACKER('footer')} event={EVENTS.TRACKER_CTA_CLICK} location="footer">AI Visibility Tracker (ChatGPT, Gemini &amp; Perplexity)</TrackLink> · <TrackLink href={CITATIONS} event={EVENTS.CITATION_CTA_CLICK} location="footer">AI Citation Tracker (which sites ChatGPT, Perplexity &amp; Google AI Overviews cite)</TrackLink> · <a href={ADS}>Google Ads Transparency &amp; Ad Library Scraper</a></p>
      <p className="muted">We use Vercel Web Analytics for aggregate page views and actions. Event properties do not include your brand name, email, IP, or the text you type. <a href="/privacy">Privacy policy</a>.</p>
      <p className="muted">Not affiliated with OpenAI or Google. Results are a single AI snapshot and may vary.</p>
      <p className="fazier"><a href="https://fazier.com" target="_blank" rel="noopener"><img src="https://fazier.com/api/v1//public/badges/launch_badges.svg?badge_type=featured&theme=light" width={160} alt="Fazier badge" /></a><span className="muted"> <a href="https://twelve.tools">Listed on Twelve.tools</a> · <a href="https://dang.ai">Featured on Dang.ai</a></span></p>
    </div></footer>
    <Ld data={orgLd} /><Ld data={appLd} />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
  </>);
}
