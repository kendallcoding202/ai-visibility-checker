import InlineCheck from '../InlineCheck.js';
import { TRACKER } from '../links.js';
import { Ld, faqLd, orgLd } from '../site.js';
import Footer from '../Footer.js';

const title = 'Profound alternatives with public prices (Nov 12, 2026)';
const description = 'Alternatives to Profound with prices copied from each vendor’s own pricing page on Nov 12, 2026. Profound’s paid plan has no public dollar price, so it is left out of the table.';
export const metadata = {
  title,
  description,
  alternates: { canonical: '/profound-alternatives' },
  openGraph: { title, description, type: 'article', images: ['/opengraph-image'] },
  twitter: { card: 'summary_large_image', title, description },
  authors: [{ name: 'Kendall Sorenson' }],
};

const CHECKED = 'Nov 12, 2026';

const tools = [
  {
    name: 'AI Visibility Tracker (Apify)',
    price: 'Free tier $0.0375 per answer. Bronze 0.034 dollars, Silver 0.03 dollars, Gold and higher 0.028 dollars. No monthly fee.',
    covers: 'One prompt on one engine, one sample. Failed answers are not charged. ChatGPT with web search, ChatGPT model knowledge, Gemini model knowledge, and Perplexity with web search.',
    href: 'https://apify.com/crunchy_galaxy_qcr/ai-visibility-tracker',
  },
  {
    name: 'Keyword.com AI Visibility',
    price: '$9.80/month, or $7.83/month billed annually ($94/year), for 100 credits.',
    covers: 'The AI Visibility plan. Search Visibility on the same page is $4/month ($3/month billed annually) and is Google rank tracking. 360° Visibility is $33/month ($26/month billed annually) and includes AI credits.',
    href: 'https://keyword.com/pricing/',
  },
  {
    name: 'Rankscale',
    price: 'Essentials $17/month, yearly only. That cell also shows $20. Pro shows $99/month and $84/month. Pro+ shows $229/month and $195/month. Growth shows $385/month and $327/month. Enterprise shows $780/month and $663/month.',
    covers: 'Essentials includes 120 credits a month, up to 480 answers, and 17+ engines. The page does not label the second monthly figure on the higher tiers, so both numbers are reported as shown.',
    href: 'https://rankscale.ai/pricing',
  },
  {
    name: 'Otterly.AI',
    price: 'Lite €29/month, Standard €189/month, Premium €489/month. Enterprise is Custom.',
    covers: 'Lite lists 16 prompts, Standard 120, Premium 403. The FAQ says prices are in USD or EUR, excluding tax. The billing toggle is marked Annually −15%.',
    href: 'https://otterly.ai/pricing',
  },
  {
    name: 'Writesonic',
    price: 'Starter $79 per month, billed annually. Basic $199 and Growth $399 per month, billed annually. Enterprise is Custom.',
    covers: 'The page says annual billing saves 20%. Starter tracks 50 prompts and 150 answers a day on ChatGPT, Gemini, and Google AI Overviews. A separate month-to-month dollar amount was not on the view that was read.',
    href: 'https://writesonic.com/pricing',
  },
  {
    name: 'Peec AI',
    price: 'Starter $95/month, Pro $245/month, Advanced $495/month. Enterprise is Custom.',
    covers: 'Starter is 50 prompts and 3 models. Pro is 150 prompts. Advanced is 350. The FAQ says yearly billing is 15% off. The page also lists an extra model at $30/month and, in the Advanced section, $140/month.',
    href: 'https://peec.ai/pricing',
  },
  {
    name: 'Semrush AI Visibility Toolkit',
    price: '$99/month per domain, billed annually.',
    covers: '25 custom prompts. Mentions from ChatGPT, Google AI, Gemini, and Perplexity. One domain for Brand Performance.',
    href: 'https://www.semrush.com/pricing/ai/',
  },
  {
    name: 'Scrunch',
    price: 'Core $250/month. Enterprise is Custom.',
    covers: '125 unique prompts, 5,000 responses a month, one brand workspace. Engines on Core: ChatGPT, Perplexity, Google AI Overviews, and Copilot.',
    href: 'https://scrunch.com/pricing',
  },
  {
    name: 'AthenaHQ',
    price: 'Essential is free and includes $25 of credit. Starter is $295/month. Enterprise is Custom.',
    covers: 'Starter includes 3,600 credits. The page says 1 credit equals 1 AI response, and lists visibility across 11 models.',
    href: 'https://www.athenahq.ai/pricing',
  },
];

const faq = [
  [
    'Why is Profound not in the price table?',
    'On Nov 12, 2026, tryprofound.com/pricing listed a free 7-day trial (50 prompts a day on ChatGPT, Gemini, and Google AI Overviews) and an Enterprise plan marked Custom. It did not publish a paid monthly dollar amount, so the paid plan is omitted.',
  ],
  [
    'Which of these has no monthly fee?',
    'The AI Visibility Tracker on Apify. The Free tier is $0.0375 per answer. The free checker on this site is a separate snapshot, 3 checks a day, and is not the tracker.',
  ],
];

export default function Page() {
  const tracker = TRACKER('profound-alternatives');
  return (<>
    <header className="hero"><div className="wrap">
      <h1>Profound alternatives with public prices</h1>
      <p>Prices below were read from each vendor’s own pricing page on {CHECKED}. By Kendall Sorenson.</p>
      <InlineCheck />
    </div></header>
    <main className="wrap">
      <section>
        <h2>Profound’s paid price is not public</h2>
        <p>On {CHECKED}, <a href="https://www.tryprofound.com/pricing">Profound’s pricing page</a> listed two plans. Trial is free: 50 prompts run daily for 7 days on ChatGPT, Gemini, and Google AI Overviews. Enterprise is marked Custom. The page does not publish a paid monthly dollar amount, so Profound is not in the table. The agency FAQ on that page mentions an Agency Growth plan and credits, and it does not state a dollar price either.</p>
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
        <p className="muted">Disclosure: I built the free checker on this site and the AI Visibility Tracker. The tracker row is the Apify listing read on {CHECKED}.</p>
      </section>
      <section>
        <h2>Left out on purpose</h2>
        <p>Goodie, Ahrefs Brand Radar, LLMrefs, and HubSpot AEO are not in the table. This draft did not take a dollar amount from each of those vendors’ own pricing pages. Third-party roundups were not used as a source.</p>
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
    </main>
    <Footer />
    <Ld data={faqLd(faq)} />
    <Ld data={{ '@context': 'https://schema.org', '@type': 'Article', headline: title, description, datePublished: '2026-11-12', dateModified: '2026-11-12', author: { '@type': 'Person', name: 'Kendall Sorenson' }, publisher: orgLd }} />
  </>);
}
