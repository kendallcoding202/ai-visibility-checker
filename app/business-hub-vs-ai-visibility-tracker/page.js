import { TRACKER, CITATIONS } from '../links.js';
import { Ld, faqLd, orgLd } from '../site.js';
import Footer from '../Footer.js';

const title = 'Business Hub vs AI Visibility Tracker (2026)';
const description = 'Business Hub shows a business its own ChatGPT mention and website-click totals. AI Visibility Tracker shows the prompts, the competitors, and the other engines. Compared from OpenAI’s pages and the Apify listing.';
export const metadata = {
  title,
  description,
  alternates: { canonical: '/business-hub-vs-ai-visibility-tracker' },
  openGraph: { title, description, type: 'article', images: ['/opengraph-image'] },
  authors: [{ name: 'Kendall Sorenson' }],
};

const PUBLISHED = '2026-11-11';
const UPDATED = '2026-11-11';
const ANNOUNCEMENT = 'https://openai.com/index/introducing-businesses-chatgpt';
const HELP = 'https://help.openai.com/en/articles/20001635-setting-up-your-business-on-chatgpt';
const PRODUCT = 'https://openai.com/business/businesses-in-chatgpt/';
const PPC = 'https://ppc.land/businesses-gain-chatgpt-click-and-mention-counts-in-openais-business-hub/';
const ACTOR = 'https://apify.com/crunchy_galaxy_qcr/ai-visibility-tracker';

const faq = [
  [
    'What does Business Hub show?',
    'After a claim is approved and Persona identity verification is complete, Insights show aggregate mentions and website clicks for the past 28 days, plus discovery topics. OpenAI’s Help Center defines an online mention as ChatGPT referencing the business’s website, not the brand name alone. A local mention counts when ChatGPT shows a result for that location. Businesses do not receive individual prompts or consumer conversations.',
  ],
  [
    'What does Business Hub have that the tracker does not?',
    'First-party website-click counts from real ChatGPT usage, and mention totals from that same usage over the past 28 days. The tracker does not receive OpenAI’s click logs. It only records the answers to prompts it sends.',
  ],
  [
    'What does the AI Visibility Tracker show that Business Hub does not?',
    'The prompts, whether your brand was named, rank, share of voice against competitors you list, sentiment, cited domains, and gap prompts. It can run those prompts on ChatGPT with web search, ChatGPT model knowledge, Gemini model knowledge, and Perplexity with web search. Business Hub’s published Insights do not include a competitor ranking or the prompts.',
  ],
  [
    'How much does the tracker cost?',
    'On Nov 11, 2026 the Apify listing is $0.0375 per answer on the Free tier, $0.034 on Bronze, $0.03 on Silver, and $0.028 on Gold and higher. One answer is one prompt on one engine, one sample. Failed answers are not charged. OpenAI’s public pages do not list a price for Business Hub, so this page does not state one.',
  ],
  [
    'Can I see who ChatGPT recommends in a market without an account?',
    'Yes. The lookup on this site’s homepage asks one ChatGPT question with web search and lists the brands it names. It is a snapshot, not OpenAI’s usage totals and not the multi-engine tracker.',
  ],
];

export default function Page() {
  const tracker = TRACKER('business-hub-compare');
  const citations = CITATIONS.replace('utm_content=footer', 'utm_content=business-hub-compare');
  return (<>
    <header className="hero"><div className="wrap">
      <h1>Business Hub vs AI Visibility Tracker</h1>
      <p>By Kendall Sorenson. OpenAI launched Businesses in ChatGPT in beta on Nov 10, 2026. Business Hub reports your own mention and click totals. The tracker reports who gets named, on which prompts, on which engines.</p>
      <p className="muted">Updated Nov 11, 2026.</p>
    </div></header>
    <main className="wrap">
      <section>
        <h2>The split</h2>
        <div style={{ overflowX: 'auto' }}><table className="cmp">
          <thead><tr><th></th><th>Business Hub</th><th>AI Visibility Tracker</th></tr></thead>
          <tbody>
            <tr><td>Whose activity</td><td>Aggregate ChatGPT usage for your claimed business</td><td>Answers to prompts you choose, sent through official APIs</td></tr>
            <tr><td>Mentions</td><td>Yes. Past 28 days, with OpenAI’s definition below</td><td>Visibility rate on the prompts in the run</td></tr>
            <tr><td>Website clicks</td><td>Yes. First-party click counts</td><td>No click logs</td></tr>
            <tr><td>The prompts</td><td>Not shared</td><td>You supply them, or the actor writes them from a category</td></tr>
            <tr><td>Competitors</td><td>Not in the published Insights</td><td>Share of voice, rank, and brands you did not list</td></tr>
            <tr><td>Engines</td><td>ChatGPT</td><td>ChatGPT web search, ChatGPT model knowledge, Gemini model knowledge, Perplexity web search</td></tr>
            <tr><td>Price</td><td>Not stated on OpenAI’s pages cited here</td><td>$0.0375 per answer on the Apify Free tier</td></tr>
          </tbody>
        </table></div>
      </section>

      <section>
        <h2>What Business Hub shows</h2>
        <p>On Nov 10, 2026, OpenAI <a href={ANNOUNCEMENT}>introduced Businesses in ChatGPT</a> in beta. Through Business Hub, a business can claim its listing, manage its information, and see aggregated insights: the number of mentions, the number of website clicks, and discovery topics, described there as common themes across conversations where the website is cited. OpenAI says it does not share users’ conversations or Business Agent chats, and that insights appear only when activity meets its thresholds. The announcement does not publish the threshold.</p>
        <p>The <a href={HELP}>Help Center article</a> is more specific about the gate and the definitions. Insights are available after the claim is approved and Persona identity verification is complete. They cover the past 28 days. For an online business, a mention counts when ChatGPT references the website. The brand name alone does not count. For a local business, a mention counts when ChatGPT shows a result for that location, even if the customer does not open the listing or visit the website. Website clicks are how often people click through to the website. Discovery topics are common themes in answers that mentioned or cited the business. Those themes do not reveal individual prompts and are not a direct measure of intent. A blank metric can mean the reporting threshold was not met, data is still being collected, or reporting is unavailable. It does not necessarily mean zero activity.</p>
        <p>The <a href={PRODUCT}>product page</a> says eligible businesses where ChatGPT is offered can claim a business, and that eligibility depends on industry, location, and OpenAI’s verification and integrity checks. You must own the business or be authorized to represent it. Claiming is initially available to eligible businesses with a website. The Help Center adds that you do not need an Ads account or a ChatGPT Enterprise agreement to claim an eligible business, and that local stores and restaurants can currently claim only an existing U.S. listing. Claiming does not guarantee higher placement or sales. ChatGPT continues to make independent recommendations.</p>
        <p>The OpenAI pages above do not list a fee for claiming a business or for viewing Insights.</p>
        <p><a href={PPC}>PPC Land’s Nov 11, 2026 report</a> describes the same gap: businesses get mention and click counts, and the prompts behind them stay hidden. The report says Business Hub offers no competitive view. It also quotes an in-product note, via Search Engine Roundtable, on the clicks tile: recorded clicks on links to your website in ChatGPT do not confirm website visits or conversions. The Help Center’s own line is shorter: it shows how often people click through to the website.</p>
        <p>Business Agents are a separate product. The announcement limits them, for now, to eligible ecommerce and online-service businesses in the United States. They are not the Insights numbers in the table above.</p>
      </section>

      <section>
        <h2>What the tracker shows</h2>
        <p><a href={ACTOR}>AI Visibility Tracker</a> (Apify actor <code>crunchy_galaxy_qcr/ai-visibility-tracker</code>, id <code>r5fguKH3mxvfARnap</code>) measures answers it requests. The store page lists visibility rate, share of voice against competitors, rank, sentiment, cited domains, gap prompts where competitors are named and you are not, brands the run discovered, and a trend against earlier runs saved in your Apify account. Each answer is a dataset row. You save the input as a task and schedule that task, for example weekly. The store page says you are charged a fixed price per event, not Apify platform usage, and that failed answers are not charged.</p>
        <p>As of Nov 11, 2026, that event price is <strong>$0.0375 per answer on the Free tier</strong>, <strong>$0.034 on Bronze</strong>, <strong>$0.03 on Silver</strong>, and <strong>$0.028 on Gold and higher</strong>. One answer is one prompt on one engine, one sample. A run of 3 prompts on the tracker’s three default engines is 9 answers, about $0.34 on the Free tier (9 × $0.0375 = $0.3375).</p>
        <p>The engines on the store page are ChatGPT with web search, ChatGPT model knowledge, Gemini model knowledge, and Perplexity with web search. The page says Claude and Google AI Overviews are not included. Gemini web search is not included either: the page says Google’s terms restrict storing and analyzing Gemini answers grounded in Google Search, so the actor uses Gemini’s model knowledge only. It also says consumer ChatGPT personalizes answers, so a run will not always match one session in the app.</p>
        <p>The tracker’s published output does not include OpenAI’s first-party website-click totals or the past-28-days usage counts Business Hub shows. It cannot tell you how many people clicked your site inside ChatGPT.</p>
      </section>

      <section>
        <h2>What to use</h2>
        <ul>
          <li><a href="/#market">Who does ChatGPT recommend in your market</a> — one ChatGPT answer, the brand names it gives, no account. A snapshot, not usage totals.</li>
          <li><a href="/#checker">Free brand check</a> — three buyer questions, whether your brand was named, rank, competitors, cited domains.</li>
          <li><a href={tracker}>AI Visibility Tracker</a> — the same kind of question, on a schedule, across the engines above, at the per-answer price above.</li>
          <li>Business Hub — your own ChatGPT mention and website-click totals after claim and Persona verification, without the prompts or a competitor ranking.</li>
        </ul>
        <p>The counts answer different questions. Business Hub answers “how often did ChatGPT mention us, and how often did people click, over the past 28 days?” The tracker answers “on these prompts, who was named, in what order, and which pages were cited?” A business that can claim its listing will want the click totals. A business that needs the prompts and the competitors still needs a tracker.</p>
        <p>For cited URLs rather than brand mentions, <a href={citations}>AI Citation Tracker</a> is a separate actor at $0.05 per answer. It is not priced like the visibility tracker.</p>
      </section>

      <section>
        <h2>Related</h2>
        <p>
          <a href="/what-chatgpt-business-dashboard-wont-tell-you">What the business dashboard won’t tell you</a>
          {' · '}
          <a href="/business-hub-vs-free-ai-visibility-checker">Business Hub vs the free checker</a>
          {' · '}
          <a href="/ai-visibility-tracker-vs-keyword">Tracker vs Keyword.com</a>
          {' · '}
          <a href="/profound-alternatives">Profound alternatives</a>
          {' · '}
          <a href="/ai-visibility-tracker-vs-otterly-profound-peec-semrush">Tracker vs Otterly / Profound / Peec / Semrush</a>
          {' · '}
          <a href="/">Free checker and market lookup</a>
        </p>
      </section>

      <section>
        <h2>FAQ</h2>
        {faq.map(([q, a]) => <details key={q} open><summary>{q}</summary><p>{a}</p></details>)}
      </section>

      <p><a className="cta" href="/#market">See who ChatGPT recommends</a> &nbsp; <a href={tracker}>Open AI Visibility Tracker →</a></p>
    </main>
    <Footer />
    <Ld data={faqLd(faq)} />
    <Ld data={{ '@context': 'https://schema.org', '@type': 'Article', headline: title, description, datePublished: PUBLISHED, dateModified: UPDATED, author: { '@type': 'Person', name: 'Kendall Sorenson' }, publisher: orgLd }} />
  </>);
}
