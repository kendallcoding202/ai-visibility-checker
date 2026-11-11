import { TRACKER, CITATIONS } from '../links.js';
import { Ld, faqLd, orgLd } from '../site.js';
import Footer from '../Footer.js';

const title = "What ChatGPT's New Business Dashboard Won't Tell You (2026)";
const description = "OpenAI launched Businesses in ChatGPT with Business Hub on Nov 10, 2026. Business Hub shows verified businesses their own ChatGPT mention and click totals. It does not show which questions, which competitors, or whether ChatGPT named you.";
export const metadata = {
  title,
  description,
  alternates: { canonical: '/what-chatgpt-business-dashboard-wont-tell-you' },
  openGraph: { title, description, type: 'article', images: ['/opengraph-image'] },
  authors: [{ name: 'Kendall Sorenson' }],
};

const PUBLISHED = '2026-11-09';
const UPDATED = '2026-11-10';

const gaps = [
  ['Which prompts triggered a mention', 'OpenAI does not share users’ conversations or Business Agent chats with businesses. Discovery topics are aggregate categories — common themes in answers that mentioned or cited the business — not individual prompts, and not a direct measure of intent.'],
  ['Competitor ranking or share of voice', 'Published Insights are a business’s own mention and click totals, plus discovery topics. OpenAI’s product pages do not include a competitor ranking or share-of-voice comparison. A mention count alone cannot tell you who ChatGPT named instead of you.'],
  ['Why mention or click counts moved', 'Discovery topics group themes; they are not an explanation of why totals went up or down. A blank metric can mean the reporting threshold was not met, data is still being collected, or reporting is unavailable — it does not necessarily mean zero activity.'],
  ['Whether ChatGPT named your brand (for online businesses)', 'For an online business, a mention counts when ChatGPT references the business’s website. The brand name alone does not count. This checker looks at whether ChatGPT named you in the answers to specific questions, which is a different thing.'],
  ['Answers from other AI engines', 'Business Hub is inside ChatGPT. It does not cover Perplexity, Gemini, or Google AI Overviews / AI Mode.'],
];

const faq = [
  [
    'Is ChatGPT’s business analytics dashboard live?',
    'Yes. On ' + UPDATED + ', OpenAI launched Businesses in ChatGPT in beta, including Business Hub. Insights are available after an approved claim and Persona identity verification — claiming alone is not enough, and claiming alone does not add the blue verified check.',
  ],
  [
    'What does Business Hub show?',
    'After you claim and verify your business, you can update your ChatGPT listing and view Insights: aggregate mentions, website clicks, and discovery topics for the past 28 days (OpenAI Help Center). For an online business, a mention counts when ChatGPT references the website, not the brand name alone. Business Agents are a separate, optional path for eligible U.S. ecommerce and online-service businesses.',
  ],
  [
    'What won’t it show?',
    'Individual prompts or consumer conversations, competitor ranking or share of voice, a prompt-level explanation of why counts moved, or answers from engines other than ChatGPT. A blank Insight does not necessarily mean zero activity.',
  ],
  [
    'How is that different from the free checker on this site?',
    'Business Hub shows your own ChatGPT totals. This checker shows which questions, which competitors, and whether ChatGPT named you. It asks ChatGPT with web search three buyer-style questions about your category and reports mention, rough rank among brands in those answers, competitors named, and cited domains. It is a prompt-level snapshot (3 checks/day), not OpenAI first-party traffic counts.',
  ],
  [
    'When should I use AI Visibility Tracker or AI Citation Tracker instead?',
    'Use AI Visibility Tracker when you need repeatable brand-mention / share-of-voice checks across ChatGPT (web search and model knowledge), Gemini model knowledge, and Perplexity with web search ($0.0375 per answer on Apify). Use AI Citation Tracker when you need the ordered source URLs ChatGPT, Perplexity and optional Google AI Overviews / AI Mode cite ($0.05 per answer). Neither replaces OpenAI’s own mention and click totals.',
  ],
];

export default function Page() {
  const tracker = TRACKER('chatgpt-dashboard-gap');
  const citations = CITATIONS.replace('utm_content=footer', 'utm_content=chatgpt-dashboard-gap');
  return (<>
    <header className="hero"><div className="wrap">
      <h1>What ChatGPT&apos;s new business dashboard won&apos;t tell you</h1>
      <p>By Kendall Sorenson. OpenAI launched Businesses in ChatGPT in beta on Nov 10, 2026, including Business Hub. Business Hub shows your own ChatGPT totals. This checker shows which questions, which competitors, and whether ChatGPT named you.</p>
      <p className="muted">Updated Nov 10, 2026. Originally published Nov 9, 2026, before the launch, when this page described Business Hub as unreleased testing.</p>
    </div></header>
    <main className="wrap">
      <section>
        <h2>What launched</h2>
        <p>On {UPDATED}, OpenAI launched <a href="https://openai.com/index/introducing-businesses-chatgpt">Businesses in ChatGPT</a> in beta. Through <a href="https://openai.com/business/businesses-in-chatgpt/">Business Hub</a>, eligible businesses can claim their listing, keep information current, and — after the claim is approved and Persona identity verification is complete — view Insights on how people engage with them in ChatGPT.</p>
        <p>Two trade publications described an early build just before launch: <a href="https://searchengineland.com/openai-testing-business-tools-to-track-performance-within-chatgpt-500841">Search Engine Land (Nov 6, 2026)</a> and <a href="https://digiday.com/marketing/chatgpt-is-about-to-show-brands-their-mention-count/">Digiday (Nov 9, 2026)</a>, which reported that OpenAI declined to comment. That “not launched / declined to comment” status is out of date. The details below follow OpenAI’s own announcement, product page, and <a href="https://help.openai.com/en/articles/20001635-setting-up-your-business-on-chatgpt">Help Center article</a>.</p>
      </section>

      <section>
        <h2>What Business Hub shows</h2>
        <ul>
          <li>A way to claim a business in ChatGPT and, once verified, update listing details (and, for retailers, product feeds).</li>
          <li>Insights after an approved claim and Persona verification: aggregate mentions and website clicks, plus discovery topics, over the past 28 days (OpenAI Help Center).</li>
          <li>For an online business, a mention counts when ChatGPT references the business’s website — not when the brand name appears alone.</li>
          <li>Privacy limits: businesses do not receive individual prompts or consumer conversations, including chats with a Business Agent. Insights appear only when activity meets OpenAI’s thresholds; a blank metric does not necessarily mean zero activity.</li>
        </ul>
        <p>You must own the business or be authorized to represent it. Claiming is initially available to eligible businesses with a website; eligibility also depends on industry, location, and verification checks. You do not need an Ads account or a ChatGPT Enterprise agreement to claim an eligible business. Claiming does not guarantee higher placement or sales, and ChatGPT continues to make independent recommendations.</p>
        <p>Business Agents — a way for eligible U.S. ecommerce and online-service businesses to let customers start a labeled conversation with the business — are a separate product, not the Insights dashboard this page is about.</p>
      </section>

      <section>
        <h2>What it won&apos;t tell you</h2>
        <ol>{gaps.map(([n, t]) => <li key={n}><strong>{n}.</strong> {t}</li>)}</ol>
      </section>

      <section>
        <h2>What fills those gaps today</h2>
        <ul>
          <li><a href="/">Free AI visibility checker</a> — three ChatGPT (web search) buyer questions, brand mention, rough rank, competitors, cited domains. No account. Snapshot only. Business Hub shows your own ChatGPT totals. This checker shows which questions, which competitors, and whether ChatGPT named you.</li>
          <li><a href={tracker}>AI Visibility Tracker</a> (Apify, crunchy_galaxy_qcr) — prompt-level brand mentions, rank, share of voice, sentiment and cited sources across ChatGPT (web search and model knowledge), Gemini model knowledge, and Perplexity with web search. $0.0375 per answer. Schedule weekly yourself.</li>
          <li><a href={citations}>AI Citation Tracker</a> — which URLs ChatGPT, Perplexity and optional Google AI Overviews / AI Mode cite, plus citation share vs competitor domains. $0.05 per answer.</li>
        </ul>
        <p>Honest split: Business Hub answers “how many aggregate mentions and clicks did we get in ChatGPT over the past 28 days?” Prompt trackers answer “for these buyer questions, who got named, in what order, and which pages were cited?” You eventually want both.</p>
      </section>

      <section>
        <h2>Related</h2>
        <p>
          <a href="/free-ai-visibility-checker">Free AI visibility checker</a>
          {' · '}
          <a href="/business-hub-vs-ai-visibility-tracker">Business Hub vs AI Visibility Tracker</a>
          {' · '}
          <a href="/ai-visibility-tracker-vs-otterly-profound-peec-semrush">Tracker vs Otterly / Profound / Peec / Semrush</a>
          {' · '}
          <a href="/how-to-see-which-sources-chatgpt-cites">How to see which sources ChatGPT cites</a>
        </p>
      </section>

      <section>
        <h2>FAQ</h2>
        {faq.map(([q, a]) => <details key={q} open><summary>{q}</summary><p>{a}</p></details>)}
      </section>

      <p><a className="cta" href="/">Run a free ChatGPT visibility check</a> &nbsp; <a href={tracker}>Open AI Visibility Tracker →</a></p>
    </main>
    <Footer />
    <Ld data={faqLd(faq)} />
    <Ld data={{ '@context': 'https://schema.org', '@type': 'Article', headline: title, description, datePublished: PUBLISHED, dateModified: UPDATED, author: { '@type': 'Person', name: 'Kendall Sorenson' }, publisher: orgLd }} />
  </>);
}

