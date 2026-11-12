import { TRACKER, CITATIONS } from '../links.js';
import { Ld, faqLd, orgLd } from '../site.js';
import Footer from '../Footer.js';

const title = 'AI Visibility Tracker vs Otterly vs Profound vs Peec AI vs Semrush (2026)';
const description = 'Honest comparison of AI Visibility Tracker (Apify), Otterly.AI, Profound, Peec AI and Semrush AI Visibility Toolkit: prices, engines, who each fits, checked Nov 9 2026.';
export const metadata = {
  title,
  description,
  alternates: { canonical: '/ai-visibility-tracker-vs-otterly-profound-peec-semrush' },
  openGraph: { title, description, type: 'article', images: ['/opengraph-image'] },
  authors: [{ name: 'Kendall Sorenson' }],
};

const FETCHED = '2026-11-09';

const tools = [
  {
    name: 'AI Visibility Tracker (Apify) + free checker',
    price: 'Free checker (3/day); Tracker $0.0375 per answer, no subscription',
    engines: 'Tracker: ChatGPT (search + knowledge), Gemini knowledge, Perplexity search. Free checker: ChatGPT with web search.',
    best: 'Pay-as-you-go LLM brand monitoring and raw exports without a monthly seat',
    stronger: 'Lowest cash outlay for irregular checks; JSON/CSV/API output; you bring your own prompts',
    weaker: 'No hosted multi-user dashboard, no daily scheduled SaaS UI, fewer engines than Otterly/Peec/Profound enterprise sets',
    href: TRACKER('compare-vs'),
    src: 'https://apify.com/crunchy_galaxy_qcr/ai-visibility-tracker',
    ours: true,
  },
  {
    name: 'Otterly.AI',
    price: 'Lite $29/mo (15 prompts); Standard $189/mo (100); Premium $489/mo (400); Enterprise custom. Annual ~15% off ($25 / $160 / $422).',
    engines: 'ChatGPT, Google AI Overviews, Perplexity, Microsoft Copilot included; Claude, Google AI Mode, Gemini as add-ons',
    best: 'Small teams that want the cheapest published multi-engine daily tracker with a dashboard',
    stronger: 'Daily tracking UI, citation/source tracking, GEO audits, free trial, Copilot included without add-on',
    weaker: 'Prompt caps on Lite are tight; Gemini/AI Mode/Claude cost extra',
    href: 'https://otterly.ai/pricing',
    src: 'https://otterly.ai/pricing',
  },
  {
    name: 'Profound',
    price: 'Free 7-day Trial (50 prompts/day). Brand Enterprise: custom (no public monthly $ on pricing page). Agency client workspace: $399/mo (per Profound agency blog).',
    engines: 'Trial: ChatGPT, Gemini, Google AI Overviews. Enterprise: up to 9 answer engines (incl. Perplexity, Claude, AI Mode, DeepSeek, etc. per pricing page)',
    best: 'Marketing teams that want agentic content/workflow help plus AI-answer insights, and can buy Enterprise',
    stronger: 'AI Marketer agents, enterprise SSO/SOC 2, broader marketing ops beyond pure visibility scores',
    weaker: 'No self-serve brand monthly price published; ongoing brand tracking needs a sales quote',
    href: 'https://www.tryprofound.com/pricing',
    src: 'https://www.tryprofound.com/pricing',
  },
  {
    name: 'Peec AI',
    price: 'Starter $95/mo (50 prompts); Pro $245/mo (150); Advanced $495/mo (350); Enterprise custom. 15% off yearly.',
    engines: 'Choose 3 models from ChatGPT, AI Mode, AI Overviews, Copilot, Gemini, Naver AI (Enterprise unlocks more, including Perplexity)',
    best: 'Marketing/SEO teams that want a polished dashboard, daily tracking and citation analytics',
    stronger: 'Clear prompt→visibility→action workflow, Looker/API/MCP on higher tiers, shopping/SKU features',
    weaker: 'Starts higher than Otterly Lite; Perplexity not in the default self-serve model list',
    href: 'https://peec.ai/pricing',
    src: 'https://peec.ai/pricing',
  },
  {
    name: 'Semrush AI Visibility Toolkit',
    price: '$99/mo per domain (pricing page shows billed annually). No free trial. +$99 per extra Brand Performance domain; +50 prompts $60/mo.',
    engines: 'ChatGPT, Google AI, Gemini, Perplexity (per Semrush KB)',
    best: 'Teams already paying for Semrush who want AI mention tracking next to classic SEO',
    stronger: 'Prompt research, competitor research, AI site-audit checks, reporting inside Semrush',
    weaker: 'No free trial; 25 tracked prompts on base toolkit; separate license per subuser in corporate accounts',
    href: 'https://www.semrush.com/pricing/ai/',
    src: 'https://www.semrush.com/kb/1493-ai-visibility-toolkit',
  },
];

const faq = [
  [
    'Which tool is best for ChatGPT brand mentions on a budget?',
    'For a one-off check, use the free AI visibility checker on this site (3 checks/day). For ongoing LLM brand monitoring without a subscription, AI Visibility Tracker on Apify is $0.0375 per answer. If you want a hosted daily dashboard, Otterly Lite at $29/mo is the lowest published multi-engine subscription among these five (prices checked ' + FETCHED + ').',
  ],
  [
    'How is AI Visibility Tracker different from Otterly, Peec, Profound and Semrush?',
    'Those four are SaaS dashboards with seats, prompt quotas and (usually) daily runs. AI Visibility Tracker is an Apify Actor: you pay per answer, get structured exports, and there is no monthly seat. It covers ChatGPT, Gemini and Perplexity; it does not replace a full GEO platform with crawl audits and multi-seat reporting.',
  ],
  [
    'Who is stronger for Google AI Overviews and AI Mode?',
    'Otterly includes AI Overviews on every plan and sells AI Mode as an add-on. Peec lets you pick AI Overviews / AI Mode among your three models. Semrush tracks Google AI alongside ChatGPT. Profound’s Trial includes AI Overviews; Enterprise can include AI Mode. Our Tracker focuses on ChatGPT, Gemini and Perplexity; for Google AI citation URLs specifically, use AI Citation Tracker.',
  ],
  [
    'Do you have a free AI visibility checker?',
    'Yes. aivisibilitychecker.app runs three buyer-style questions through ChatGPT with web search and shows whether your brand is mentioned, rank, competitors and cited sources. It is a snapshot, not daily tracking.',
  ],
];

export default function Page() {
  const tracker = TRACKER('compare-vs');
  const citations = CITATIONS.replace('utm_content=footer', 'utm_content=compare-vs');
  return (<>
    <header className="hero"><div className="wrap">
      <h1>AI Visibility Tracker vs Otterly vs Profound vs Peec AI vs Semrush</h1>
      <p>An honest side-by-side for people comparing AI search visibility / GEO tools. Prices and engine lists were read from each vendor’s public pricing page on {FETCHED}. By Kendall Sorenson.</p>
    </div></header>
    <main className="wrap">
      <section>
        <h2>Quick answer</h2>
        <p>Need a free snapshot of ChatGPT brand mentions? Use the <a href="/free-ai-visibility-checker">free AI visibility checker</a>. Need cheap recurring checks and exports? Use <a href={tracker}>AI Visibility Tracker</a> on Apify ($0.0375/answer). Need a daily SaaS dashboard: Otterly is the lowest published entry price here; Peec and Semrush fit marketing teams that want a polished UI (Semrush if you are already in that stack); Profound fits buyers who want Enterprise agents and a sales-led package.</p>
        <p className="muted">Disclosure: I built the free checker, AI Visibility Tracker and <a href={citations}>AI Citation Tracker</a>. I state where the SaaS tools are stronger, and I do not claim we beat them on dashboard features we do not have.</p>
      </section>

      <section>
        <h2>Comparison table</h2>
        <div style={{ overflowX: 'auto' }}><table className="cmp">
          <thead><tr><th>Tool</th><th>Price (public)</th><th>Engines</th><th>Best for</th><th>Source</th></tr></thead>
          <tbody>{tools.map((t) => (
            <tr key={t.name}>
              <td><a href={t.href}><strong>{t.name}</strong></a>{t.ours ? ' (ours)' : ''}</td>
              <td>{t.price}</td>
              <td>{t.engines}</td>
              <td>{t.best}</td>
              <td><a href={t.src}>pricing / docs</a></td>
            </tr>
          ))}</tbody>
        </table></div>
        <p className="muted">Profound brand Enterprise monthly dollars are not published on tryprofound.com/pricing as of {FETCHED}. Agency Growth client workspace $399/mo is from Profound’s agency blog, not the main pricing grid.</p>
      </section>

      <section>
        <h2>Cost per prompt, said plainly</h2>
        <p><strong>AI Visibility Tracker</strong> charges <strong>$0.0375 per AI answer</strong> (FREE tier on Apify, checked 2026-11-11). One answer = one prompt on one engine, one sample. Failed answers are free. You do not need your own OpenAI / Gemini / Perplexity key.</p>
        <div style={{ overflowX: 'auto' }}><table className="cmp">
          <thead><tr><th>You want…</th><th>Rough Visibility cost</th></tr></thead>
          <tbody>
            <tr><td>15 prompts × 1 engine, once</td><td><strong>$0.5625</strong></td></tr>
            <tr><td>15 prompts × 2 engines, once</td><td><strong>$1.125</strong></td></tr>
            <tr><td>Same 15×2 check, weekly for a month</td><td><strong>~$4.50</strong></td></tr>
            <tr><td>Same 15×2 check, daily for a month</td><td><strong>~$33.75</strong></td></tr>
          </tbody>
        </table></div>
        <p><strong>AI Citation Tracker</strong> is <strong>$0.05 per answer</strong> the same way (and $0 when Google shows no AI Overview / AI Mode).</p>
        <p>For comparison, entry SaaS plans (vendor pages 2026-11-09; also listed on <a href="https://geocitely.com/pricing">geocitely.com/pricing</a>):</p>
        <div style={{ overflowX: 'auto' }}><table className="cmp">
          <thead><tr><th>Tool</th><th>Entry plan</th><th>Simple $/tracked prompt / month</th></tr></thead>
          <tbody>
            <tr><td>Otterly.AI Lite</td><td>$29 / 15 prompts, daily, 4 engines</td><td><strong>$1.93</strong></td></tr>
            <tr><td>Peec AI Starter</td><td>$95 / 50 prompts, daily, 3 models</td><td><strong>$1.90</strong></td></tr>
          </tbody>
        </table></div>
        <p>Those subscriptions include a dashboard and daily refreshes. Matching Otterly’s daily volume on our actor (15 prompts × 4 engines × 30 days = 1,800 answers × $0.0375) would be about <strong>$67.50/mo</strong> in PPE — so for <em>daily</em> multi-engine tracking a Lite SaaS seat can be cheaper. For <em>weekly</em> audits, spot checks, agencies exporting JSON/CSV, or one-off research, pay-per-answer is usually cheaper and has no seat.</p>
        <p>Free snapshot: <a href="/">aivisibilitychecker.app</a> — 3 ChatGPT checks/day, $0.</p>
      </section>

      <section>
        <h2>Where each one is stronger</h2>
        {tools.map((t) => (
          <div key={t.name}>
            <h3>{t.name}</h3>
            <p><strong>Stronger:</strong> {t.stronger}</p>
            <p><strong>Weaker / limits:</strong> {t.weaker}</p>
            <p><a href={t.src}>Source checked {FETCHED}</a>.</p>
          </div>
        ))}
      </section>

      <section>
        <h2>Related Apify actors by crunchy_galaxy_qcr</h2>
        <ul>
          <li><a href={tracker}>AI Visibility Tracker</a> — ChatGPT brand mentions, LLM brand monitoring, AI search visibility</li>
          <li><a href={citations}>AI Citation Tracker</a> — which sources ChatGPT, Perplexity and Google AI cite</li>
          <li><a href="https://apify.com/crunchy_galaxy_qcr/google-ads-transparency-scraper">Google Ads Transparency Center Scraper by crunchy_galaxy_qcr</a></li>
          <li><a href="https://apify.com/crunchy_galaxy_qcr/microsoft-ads-library-scraper">Microsoft Ads Library Scraper by crunchy_galaxy_qcr</a></li>
        </ul>
      </section>

      <section>
        <h2>FAQ</h2>
        {faq.map(([q, a]) => <details key={q} open><summary>{q}</summary><p>{a}</p></details>)}
      </section>

      <p>Related: <a href="/what-chatgpt-business-dashboard-wont-tell-you">what ChatGPT&apos;s new business dashboard won&apos;t tell you</a> · <a href="/profound-alternatives">Profound alternatives, prices re-read Nov 12, 2026</a> · <a href="/otterly-alternatives">Otterly alternatives, prices read Nov 12, 2026</a> · <a href="/business-hub-vs-ai-visibility-tracker">Business Hub vs AI Visibility Tracker</a></p>
      <p><a className="cta" href="/">Run a free ChatGPT visibility check</a> &nbsp; <a href={tracker}>Open AI Visibility Tracker on Apify →</a></p>
    </main>
    <Footer />
    <Ld data={faqLd(faq)} />
    <Ld data={{ '@context': 'https://schema.org', '@type': 'Article', headline: title, description, datePublished: '2026-11-09', dateModified: '2026-11-09', author: { '@type': 'Person', name: 'Kendall Sorenson' }, publisher: orgLd }} />
  </>);
}
