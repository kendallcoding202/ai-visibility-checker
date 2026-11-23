import InlineCheck from '../InlineCheck.js';
import { TRACKER } from '../links.js';
import { Ld, faqLd, orgLd } from '../site.js';
import Footer from '../Footer.js';
import { TRACKING_TIER_PRICE } from '../../lib/trackingTier.js';

const title = 'Profound alternatives you can buy without a demo (Nov 23, 2026)';
const description = `Profound now sells custom Enterprise plans only. Self-serve alternatives with prices read from each vendor’s own pricing page, starting with weekly ChatGPT tracking at ${TRACKING_TIER_PRICE}.`;
export const metadata = {
  title,
  description,
  alternates: { canonical: '/profound-alternatives' },
  openGraph: { title, description, type: 'article', images: ['/opengraph-image'] },
  twitter: { card: 'summary_large_image', title, description },
  authors: [{ name: 'Kendall Sorenson' }],
};

const CHECKED = 'Nov 23, 2026';
const OLD_READ = 'Nov 12, 2026';

const tools = [
  {
    name: 'AI Visibility Checker monthly tracking',
    price: TRACKING_TIER_PRICE,
    covers: 'One saved brand, re-checked weekly on ChatGPT with web search (3 buyer questions), emailed with raw answers. Cancel anytime.',
    read: CHECKED,
    href: '/',
  },
  {
    name: 'AI Visibility Tracker (Apify)',
    price: '$0.0375 per answer on the Free tier (Bronze $0.034, Silver $0.03, Gold and higher $0.028). No monthly fee.',
    covers: 'One prompt on one engine, one sample. Failed answers are not charged. ChatGPT with web search, ChatGPT model knowledge, Gemini model knowledge, Perplexity with web search.',
    read: CHECKED,
    href: 'https://apify.com/crunchy_galaxy_qcr/ai-visibility-tracker',
  },
  {
    name: 'Rankscale',
    price: 'Pro $99/month, or $84.15/month billed yearly',
    covers: 'Up to 4,800 AI answers a month (1,200 credits), up to 10 brands, 17+ engines. 7-day trial. The yearly-only Essentials plan is no longer on the page.',
    read: CHECKED,
    href: 'https://rankscale.ai/pricing',
  },
  {
    name: 'Peec AI',
    price: 'Starter $95/month',
    covers: '50 prompts, 3 models you choose, daily tracking, unlimited users. Pro $245, Advanced $495, Enterprise Custom.',
    read: CHECKED,
    href: 'https://peec.ai/pricing',
  },
  {
    name: 'Scrunch',
    price: 'Core $250/month',
    covers: '15,000 responses a month, 8 LLMs, 1 brand and 5 seats. 7-day free trial. Enterprise Custom.',
    read: CHECKED,
    href: 'https://scrunch.com/pricing',
  },
  {
    name: 'AthenaHQ',
    price: 'Essential free ($25 of credit, 300 credits); Starter $295/month',
    covers: 'Starter includes 3,600 credits. Enterprise Custom.',
    read: CHECKED,
    href: 'https://www.athenahq.ai/pricing',
  },
  {
    name: 'Otterly.AI',
    price: 'Lite €29/month, Standard €189/month, Premium €489/month. Enterprise is Custom.',
    covers: 'Lite lists 16 prompts, Standard 120, Premium 403. The FAQ says prices are in USD or EUR, excluding tax. The billing toggle is marked Annually −15%.',
    read: OLD_READ,
    href: 'https://otterly.ai/pricing',
  },
  {
    name: 'Semrush AI Visibility Toolkit',
    price: '$99/month per domain, billed annually.',
    covers: '25 custom prompts. Mentions from ChatGPT, Google AI, Gemini, and Perplexity. One domain for Brand Performance.',
    read: OLD_READ,
    href: 'https://www.semrush.com/pricing/ai/',
  },
  {
    name: 'Writesonic',
    price: 'Starter $79 per month, billed annually. Basic $199 and Growth $399 per month, billed annually. Enterprise is Custom.',
    covers: 'The page says annual billing saves 20%. Starter tracks 50 prompts and 150 answers a day on ChatGPT, Gemini, and Google AI Overviews. A separate month-to-month dollar amount was not on the view that was read.',
    read: OLD_READ,
    href: 'https://writesonic.com/pricing',
  },
  {
    name: 'Keyword.com AI Visibility',
    price: '$9.80/month, or $7.83/month billed annually ($94/year), for 100 credits.',
    covers: 'The AI Visibility plan. Search Visibility on the same page is $4/month ($3/month billed annually) and is Google rank tracking. 360° Visibility is $33/month ($26/month billed annually) and includes AI credits.',
    read: OLD_READ,
    href: 'https://keyword.com/pricing/',
  },
];

const faq = [
  [
    'Does Profound still have a self-serve plan?',
    'Not for brands, as of Nov 23, 2026. Its pricing page lists Enterprise at a Custom price after a demo. Its FAQ says the Starter and Growth plans were retired in September 2026 and are not available to new subscribers.',
  ],
  [
    'What is the cheapest way to start tracking without a sales call?',
    `In the table above, the lowest flat monthly price is Keyword.com AI Visibility at $9.80/month (read Nov 12). Monthly tracking on this site is ${TRACKING_TIER_PRICE} for one brand on ChatGPT. The Apify tracker has no monthly fee and charges per answer.`,
  ],
  [
    'What did Rankscale change?',
    'On Nov 23, 2026, its lowest listed plan was Pro at $99/month ($84.15/month billed yearly). The yearly-only Essentials plan that earlier versions of this page listed is no longer on its pricing page.',
  ],
  [
    'Do I need a card for the free check?',
    'No. The free check needs only a brand name, with no account and no card, 3 checks a day. Monthly tracking and the $19 report are paid through Stripe checkout.',
  ],
];

export default function Page() {
  const tracker = TRACKER('profound-alternatives');
  return (<>
    <header className="hero"><div className="wrap">
      <h1>Profound alternatives you can buy without a demo</h1>
      <p>Profound’s pricing page now lists one plan for brands: Enterprise, priced as Custom after a demo. If you want to start tracking today without a sales call, the plans below publish a price you can pay online. Prices were read from each vendor’s own pricing page on {CHECKED}. By Kendall Sorenson, who built the free checker and the tracking on this site.</p>
      <InlineCheck />
    </div></header>
    <main className="wrap">
      <section>
        <h2>Start self-serve at {TRACKING_TIER_PRICE}</h2>
        <p>Monthly tracking on this site is {TRACKING_TIER_PRICE} for one saved brand. Every week it asks ChatGPT, with web search on, the same three buyer-style questions as the free check. You get an email with the result, the run count and the raw answers. Checkout is through Stripe, and you can cancel anytime from the link in each email.</p>
        <p>What it does not do: it covers one brand and one engine (ChatGPT), with three questions a week. If you need many prompts, many engines or a team dashboard, the tools in the table below cover more, at a higher price.</p>
        <p>To start, run the free check (no account, no card), confirm your email, then choose monthly tracking on the result page.</p>
        <p><a className="cta" href="#checker">Run a free check</a> &nbsp; <a href={tracker}>Ongoing checks on Apify, pay per answer</a></p>
      </section>
      <section>
        <h2>What happened to Profound’s plans</h2>
        <p>On {CHECKED}, <a href="https://www.tryprofound.com/pricing">Profound’s pricing page</a> listed Enterprise for brands at a Custom price, with up to 10 answer engines tracked, SSO/SAML and SOC 2, and a “Get a Demo” button. No free trial was shown.</p>
        <p>The FAQ on that page, last updated Nov 16, 2026, says the company retired its Starter and Growth plans for brands in September 2026. It says the $399 and $499 prices for those plans are no longer available to new subscribers.</p>
        <p>Because the page shows no dollar amount, Profound is not in the price table.</p>
      </section>
      <section>
        <h2>Self-serve prices, read {CHECKED}</h2>
        <div style={{ overflowX: 'auto' }}><table className="cmp">
          <thead><tr><th>Tool</th><th>Public price</th><th>What that price covers</th><th>Read on</th><th>Source</th></tr></thead>
          <tbody>{tools.map((t) => (
            <tr key={t.name}>
              <td><a href={t.href}><strong>{t.name}</strong></a></td>
              <td>{t.price}</td>
              <td>{t.covers}</td>
              <td>{t.read}</td>
              <td><a href={t.href}>{t.href === '/' ? 'this site' : 'pricing page'}</a></td>
            </tr>
          ))}</tbody>
        </table></div>
        <p className="muted">Rows marked Nov 12 were not re-read for this update. Vendor pages change often; the vendor’s own page is the final word. Disclosure: I built the first two rows.</p>
      </section>
      <section>
        <h2>Left out on purpose</h2>
        <p>Goodie, Ahrefs Brand Radar, LLMrefs, and HubSpot AEO are not in the table. This draft did not take a dollar amount from each of those vendors’ own pricing pages. Third-party roundups were not used as a source.</p>
        <p>Prices from third-party roundups are not used in the table, including where they agree with the vendor.</p>
      </section>
      <section>
        <h2>Where to start</h2>
        <p>A free snapshot, with a brand name and no account, is the <a href="/">checker on this site</a>. Ongoing checks at the per-answer price above are the <a href={tracker}>AI Visibility Tracker</a>. For the older four-way writeup, see <a href="/ai-visibility-tracker-vs-otterly-profound-peec-semrush">AI Visibility Tracker vs Otterly, Profound, Peec AI and Semrush</a>. That page’s Otterly and Peec figures were read earlier than this one.</p>
        <p>The Nov 12 Otterly read is also on <a href="/otterly-alternatives">Otterly alternatives</a>. A step-by-step check is on <a href="/how-to-check-if-chatgpt-mentions-your-brand">how to check if ChatGPT mentions your brand</a>. For a software category, see <a href="/ai-visibility-for-saas">AI visibility for SaaS</a>.</p>
        <p>Business Hub is a different product. It shows a business its own ChatGPT totals. See <a href="/business-hub-vs-ai-visibility-tracker">Business Hub vs AI Visibility Tracker</a>.</p>
      </section>
      <section>
        <h2>FAQ</h2>
        {faq.map(([q, a]) => <details key={q} open><summary>{q}</summary><p>{a}</p></details>)}
      </section>
      <p><a className="cta" href="#checker">Run a free check</a> &nbsp; <a href={tracker}>Open AI Visibility Tracker</a></p>
      <p>Sources, read {CHECKED} unless noted: <a href="https://www.tryprofound.com/pricing">tryprofound.com/pricing</a> (plans and FAQ), <a href="https://rankscale.ai/pricing">rankscale.ai/pricing</a>, <a href="https://peec.ai/pricing">peec.ai/pricing</a>, <a href="https://scrunch.com/pricing">scrunch.com/pricing</a>, <a href="https://www.athenahq.ai/pricing">athenahq.ai/pricing</a>, the <a href="https://apify.com/crunchy_galaxy_qcr/ai-visibility-tracker">Apify listing for AI Visibility Tracker</a>. Read {OLD_READ}: <a href="https://otterly.ai/pricing">otterly.ai/pricing</a>, <a href="https://www.semrush.com/pricing/ai/">semrush.com/pricing/ai/</a>, <a href="https://writesonic.com/pricing">writesonic.com/pricing</a>, <a href="https://keyword.com/pricing/">keyword.com/pricing/</a>.</p>
    </main>
    <Footer />
    <Ld data={faqLd(faq)} />
    <Ld data={{ '@context': 'https://schema.org', '@type': 'Article', headline: title, description, datePublished: '2026-11-12', dateModified: '2026-11-23', author: { '@type': 'Person', name: 'Kendall Sorenson' }, publisher: orgLd }} />
  </>);
}
