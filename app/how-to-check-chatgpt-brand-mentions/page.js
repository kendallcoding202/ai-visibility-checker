import { TRACKER } from '../links.js';
import { Ld, faqLd } from '../site.js';
import Footer from '../Footer.js';

const title = 'How to Check if ChatGPT Recommends Your Brand (Free, 2026)';
const description = 'Step-by-step: how to check whether ChatGPT mentions or recommends your brand, manually or with a free tool, and how to track it over time.';
export const metadata = { title, description, alternates: { canonical: '/how-to-check-chatgpt-brand-mentions' }, openGraph: { title, description, type: 'article', images: ['/opengraph-image'] }, authors: [{ name: 'Kendall Sorenson' }] };

const steps = [
  ['Write 3–10 buyer questions', 'Use the words a customer would type, e.g. "What is the best project management tool for small teams?" Avoid naming your brand in the question.'],
  ['Ask ChatGPT with search on', 'Open a fresh chat (or a logged-out/incognito window) so past conversations do not bias the answer. Note whether your brand appears, its position, and which competitors are named.'],
  ['Look at the cited sources', 'ChatGPT search shows the pages it used. These are the sites where getting mentioned matters most.'],
  ['Repeat and average', 'Answers vary. Ask each question a few times or on different days and count how often you appear (your mention rate).'],
  ['Or let a tool do it', 'The free checker on this site runs 3 buyer questions through ChatGPT with web search and gives you mention rate, rank, competitors and sources in about 30 seconds.'],
  ['Track it weekly', 'To see if your work is paying off, rerun the same prompts on a schedule. The AI Visibility Tracker on Apify does this for ChatGPT, Gemini and Perplexity at $0.0375 per answer.'],
];
const faq = [
  ['Can I check ChatGPT brand mentions for free?', 'Yes. You can ask ChatGPT manually, or use the Free AI Visibility Checker (3 checks per day, no account). HubSpot AEO Grader is another free option.'],
  ['How often should I check?', 'Weekly is enough for most brands. AI answers change with new web content, so a monthly trend is more meaningful than a single result.'],
  ['Does ChatGPT use Google or Bing?', 'ChatGPT search draws on web search results, and Bing indexing is widely recommended, so make sure your site is indexed in Bing Webmaster Tools as well as Google Search Console.'],
];

export default function Page() {
  const howTo = { '@context': 'https://schema.org', '@type': 'HowTo', name: title, step: steps.map(([n, t], i) => ({ '@type': 'HowToStep', position: i + 1, name: n, text: t })) };
  return (<>
    <header className="hero"><div className="wrap">
      <h1>How to check if ChatGPT recommends your brand</h1>
      <p>A plain, step-by-step guide by Kendall Sorenson. Takes about 10 minutes by hand, or 30 seconds with the free checker.</p>
    </div></header>
    <main className="wrap">
      <section><ol>{steps.map(([n, t]) => <li key={n}><strong>{n}.</strong> {t}</li>)}</ol>
        <p><a className="cta" href="/">Run a free check</a> &nbsp; <a href={TRACKER('howto')}>Track weekly on Apify →</a></p></section>
      <section><h2>Want to compare tools?</h2><p>See the <a href="/best-ai-visibility-tools">best tools to check whether ChatGPT recommends your brand</a>, with sourced prices, or the November 9, 2026 check on <a href="/ai-visibility-tracker-vs-otterly-profound-peec-semrush">AI Visibility Tracker vs Otterly, Profound, Peec AI and Semrush</a>. The <a href="/free-ai-visibility-checker">free AI visibility checker</a> page explains the snapshot. If competitors keep showing up instead of you, read <a href="/why-chatgpt-recommends-competitors">why ChatGPT recommends your competitors</a>, map <a href="/which-sites-ai-cites-in-your-niche">which sites AI cites in your niche</a>, or follow <a href="/how-to-see-which-sources-chatgpt-cites">how to see which sources ChatGPT cites</a>.</p></section>
      <section><h2>FAQ</h2>{faq.map(([q, a]) => <details key={q} open><summary>{q}</summary><p>{a}</p></details>)}</section>
    </main>
    <Footer />
    <Ld data={faqLd(faq)} /><Ld data={howTo} />
  </>);
}
