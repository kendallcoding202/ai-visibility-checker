import Footer from '../Footer.js';
import { TRACKER } from '../links.js';
import { Ld, faqLd, orgLd } from '../site.js';
import { tracker } from '../../lib/costCompare.js';
import { TRACKING_TIER_BODY, TRACKING_TIER_PRICE } from '../../lib/trackingTier.js';

const title = 'Otterly alternatives with public prices (Nov 12, 2026)';
const description = 'Otterly.AI alternatives with prices copied from each vendor’s own page on Nov 12, 2026. Otterly’s cards showed Lite at €29/month, Standard at €189/month, and Premium at €489/month.';
export const metadata = {
  title,
  description,
  alternates: { canonical: '/otterly-alternatives' },
  openGraph: { title, description, type: 'article', images: ['/opengraph-image'] },
  authors: [{ name: 'Kendall Sorenson' }],
};

const CHECKED = 'Nov 12, 2026';
const OTTERLY = 'https://otterly.ai/pricing';

const tools = [
  {
    name: 'Free AI Visibility Checker (this site)',
    price: '$0.',
    covers: '3 checks per IP per day. Each check is 3 questions on ChatGPT with web search, one run. It reports whether the brand was named, rank, other brands, and cited domains.',
    href: '/',
  },
  {
    name: 'Monthly tracking (this site)',
    price: `${TRACKING_TIER_PRICE} when that plan is offered.`,
    covers: TRACKING_TIER_BODY,
    href: '/privacy',
  },
  {
    name: 'AI Visibility Tracker (Apify)',
    price: `$${tracker.pricePerAnswer} per answer on the Free tier. The listing’s price line also read “from $28.00 / 1,000” answers. The public actor pricing record started Nov 11, 2026 lists Free $${tracker.pricePerAnswer}, Bronze 0.034 dollars, Silver 0.03 dollars, and Gold and higher 0.028 dollars.`,
    covers: 'One prompt on one engine, one sample. Failed answers are not charged. No monthly fee. ChatGPT with web search, ChatGPT model knowledge, Gemini model knowledge, and Perplexity with web search.',
    href: 'https://apify.com/crunchy_galaxy_qcr/ai-visibility-tracker',
  },
  {
    name: 'Otterly.AI',
    price: 'Lite €29/month, Standard €189/month, Premium €489/month. Enterprise is Custom. The cards also showed Save €52, Save €340, and Save €880. The billing toggle reads Monthly and Annually −15%.',
    covers: 'Lite lists 16 prompts, 2,000 credits/month, 4 of 7 AI engines, and daily tracking. Standard lists 120 prompts and 15,000 credits. Premium lists 403 prompts, 50,000 credits, and daily or weekly tracking. The FAQ says prices are in USD or EUR, excluding tax, and that one credit is one prompt checked once on one AI engine. Claude counts as 3 credits. Weekly tracking is available on Premium.',
    href: OTTERLY,
  },
  {
    name: 'Keyword.com AI Visibility',
    price: '$9.80/month, or $7.83/month billed annually ($94, the page says save $24), for the first listed tier of 100 credits.',
    covers: 'AI Visibility tracking. Search Visibility on the same page is $4/month ($3/month billed annually) and is Google rank tracking, not this plan. 360° Visibility is $33/month ($26/month billed annually).',
    href: 'https://keyword.com/pricing/',
  },
  {
    name: 'Rankscale',
    price: 'The Starting at row showed Essentials as $20 and $17/mo, yearly only. Pro showed $99/mo and $84/mo. Pro+ showed $229/mo and $195/mo. Growth showed $385/mo and $327/mo. Enterprise showed $780/mo and $663/mo.',
    covers: 'Essentials lists 120 credits a month, up to 480 answers, and 17+ engines. The page does not label which of the two dollar figures is monthly and which is annual, except that Essentials is marked yearly only.',
    href: 'https://rankscale.ai/pricing',
  },
  {
    name: 'Peec AI',
    price: 'Starter $95/month, Pro $245/month, Advanced $495/month. Enterprise is Custom. The FAQ says yearly billing is 15% off.',
    covers: 'Starter is 50 prompts, 3 models, daily tracking, and 1 project. Pro is 150 prompts and 2 projects. Advanced is 350 prompts and 5 projects. The page lists an extra model at $30/month and, in the Advanced section, $140/month.',
    href: 'https://peec.ai/pricing',
  },
  {
    name: 'Semrush AI Visibility Toolkit',
    price: '$99/month per domain, billed annually.',
    covers: '25 custom prompts. Mentions from ChatGPT, Google AI, Gemini, and Perplexity. One domain for Brand Performance. The page has a monthly/annual toggle. A separate month-to-month dollar amount was not in the text that was read.',
    href: 'https://www.semrush.com/pricing/ai/',
  },
  {
    name: 'Scrunch',
    price: 'Core $250/month. Enterprise does not show a dollar price.',
    covers: 'Core lists 125 unique prompts, 5,000 responses a month, 1 brand workspace, and 5 user licenses. Engines on Core: ChatGPT, Perplexity, Google AIO, and Copilot.',
    href: 'https://scrunch.com/pricing',
  },
];

const faq = [
  [
    'What did Otterly’s pricing page show?',
    'On Nov 12, 2026 the cards showed Lite €29/month (16 prompts), Standard €189/month (120 prompts), and Premium €489/month (403 prompts). Enterprise was Custom. The FAQ says prices are in USD or EUR, excluding tax. This page reports the euro amounts that were on the cards and does not convert them.',
  ],
  [
    'Why is Profound not in the table?',
    'On Nov 12, 2026, tryprofound.com/pricing listed a free trial (50 prompts a day for 7 days on ChatGPT, Gemini, and Google AI Overviews) and an Enterprise plan marked Custom. The FAQ names an Agency Growth plan with 400 credits a month per client workspace and does not state a dollar price. No paid monthly dollar amount was published, so Profound is left out.',
  ],
  [
    'What does this site charge?',
    `The check is $0, with 3 checks per IP per day. ${TRACKING_TIER_PRICE} monthly tracking, when that plan is offered: ${TRACKING_TIER_BODY} The Apify tracker is separate, at $${tracker.pricePerAnswer} per answer on the Free tier.`,
  ],
];

export default function Page() {
  const trackerLink = TRACKER('otterly-alternatives');
  return (<>
    <header className="hero"><div className="wrap">
      <h1>Otterly alternatives with public prices</h1>
      <p>Prices below were read from each vendor’s own page on {CHECKED}. By Kendall Sorenson. Third-party roundups were not used.</p>
    </div></header>
    <main className="wrap">
      <section>
        <h2>What Otterly listed</h2>
        <p>On {CHECKED}, <a href={OTTERLY}>Otterly’s pricing page</a> showed three priced plans and Enterprise. Lite was €29/month for 16 prompts, 2,000 credits, 4 of 7 AI engines, and daily tracking. Standard was €189/month for 120 prompts and 15,000 credits. Premium was €489/month for 403 prompts, 50,000 credits, and daily or weekly tracking. Enterprise was Custom. The enterprise card says “Starting from 1,000 search prompts” and “Unlimited” prompts. The compare table on the same page lists Enterprise prompts as 1,000+.</p>
        <p>The engines named on that page are ChatGPT, Google AI Overviews, Perplexity, Microsoft Copilot, Google AI Mode, Google Gemini, and Claude. The priced cards say 4 of 7 AI engines. They do not say which four are selected by default. The FAQ says you can switch engines per workspace.</p>
        <p>The billing control is labeled Monthly and Annually −15%. Each priced card also showed a save amount: €52, €340, and €880. The FAQ says prices are in USD or EUR, excluding tax. This table keeps the euro figures that were printed on the cards.</p>
      </section>
      <section>
        <h2>Public prices</h2>
        <div style={{ overflowX: 'auto' }}><table className="cmp">
          <thead><tr><th>Tool</th><th>Public price</th><th>What that price covers</th><th>Source</th></tr></thead>
          <tbody>{tools.map((t) => (
            <tr key={t.name}>
              <td><a href={t.href}><strong>{t.name}</strong></a></td>
              <td>{t.price}</td>
              <td>{t.covers}</td>
              <td><a href={t.href}>pricing page</a></td>
            </tr>
          ))}</tbody>
        </table></div>
        <p className="muted">Last checked {CHECKED}. Disclosure: I built the free checker, monthly tracking, and the AI Visibility Tracker. The tracker row is the Apify listing and its public pricing record, read on {CHECKED}. The monthly-tracking row is this site’s privacy policy.</p>
      </section>
      <section>
        <h2>Left out on purpose</h2>
        <p><a href="https://www.tryprofound.com/pricing">Profound’s pricing page</a> is described above and is not given a paid dollar price. Writesonic, AthenaHQ, Goodie, Ahrefs Brand Radar, LLMrefs, and HubSpot AEO are not in the table. This page did not take a dollar amount from each of those vendors’ own pricing pages on {CHECKED}.</p>
        <p>The <a href="/ai-visibility-tracker-vs-otterly-profound-peec-semrush">November 9 comparison</a> and the <a href="/profound-alternatives">Profound alternatives</a> page are separate reads. Use this page for the {CHECKED} Otterly figures.</p>
      </section>
      <section>
        <h2>Where to start</h2>
        <p>A free snapshot is the <a href="/">checker</a>, or the same form on <a href="/how-to-check-if-chatgpt-mentions-your-brand#check">how to check if ChatGPT mentions your brand</a>. {TRACKING_TIER_PRICE} monthly tracking, when offered, re-checks one saved brand weekly. Pay-per-answer runs are the <a href={trackerLink}>AI Visibility Tracker</a>.</p>
        <p>For a software category, see <a href="/ai-visibility-for-saas">AI visibility for SaaS</a>. Business Hub is a different product. It shows a business its own ChatGPT totals. This page does not state a price for Business Hub. See <a href="/business-hub-vs-free-ai-visibility-checker">Business Hub vs the free checker</a>.</p>
      </section>
      <section>
        <h2>FAQ</h2>
        {faq.map(([q, a]) => <details key={q} open><summary>{q}</summary><p>{a}</p></details>)}
      </section>
      <p><a className="cta" href="/">Run a free check</a> &nbsp; <a href={trackerLink}>Open AI Visibility Tracker</a></p>
    </main>
    <Footer />
    <Ld data={faqLd(faq)} />
    <Ld data={{ '@context': 'https://schema.org', '@type': 'Article', headline: title, description, datePublished: '2026-11-12', dateModified: '2026-11-12', author: { '@type': 'Person', name: 'Kendall Sorenson' }, publisher: orgLd }} />
  </>);
}
