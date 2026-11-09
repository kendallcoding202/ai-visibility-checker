import { TRACKER, CITATIONS } from '../links.js';
import { Ld, faqLd } from '../site.js';
import Footer from '../Footer.js';

const title = 'How to See Which Sites Google AI Overviews and ChatGPT Cite in Your Niche';
const description = 'A hands-on method for finding the pages Google AI Overviews, AI Mode, ChatGPT and Perplexity cite for your buyers\u2019 questions, and what to do with that list.';
export const metadata = { title, description, alternates: { canonical: '/which-sites-ai-cites-in-your-niche' }, openGraph: { title, description, type: 'article', images: ['/opengraph-image'] }, authors: [{ name: 'Kendall Sorenson' }] };

const steps = [
  ['Write down the questions buyers actually ask', 'Pull them from sales calls, support tickets or the "People also ask" box. Phrase them the way a person would, without brand names.'],
  ['Search them in Google and note the AI Overview', 'Not every query shows one. When it does, open the source links next to the answer and copy each URL into a sheet. Try AI Mode for the same question too; it often cites different pages.'],
  ['Ask ChatGPT and Perplexity the same thing', 'Use ChatGPT with search on and Perplexity, each in a fresh session. Both list their sources. Add those URLs to the same sheet with a column for which engine cited them.'],
  ['Group the URLs by domain', 'After 10 or so questions a pattern shows up: a few review sites, a couple of big blogs, maybe a Reddit thread or a competitor\u2019s comparison page. Count how often each domain appears.'],
  ['Mark where you and your competitors show up', 'For each cited page, note whether your site is mentioned or linked, and which competitors are. The pages that cite competitors but not you are your shortlist.'],
  ['Work the shortlist', 'Ask roundup authors for a look, update your own comparison pages so they answer the question directly, and add useful answers in the threads that keep getting cited. Then repeat the check in a month.'],
];
const faq = [
  ['How long does the manual version take?', 'About an hour for 10 questions across three engines. It is worth doing once by hand so you know what you are looking at.'],
  ['What does the AI Citation Tracker add?', 'It asks ChatGPT and Perplexity (and Google AI Overviews and AI Mode if you choose them) your list of questions, saves every cited URL, and works out each domain\u2019s share of citations, your citation rate against competitors and the questions where you are missing. It costs $0.05 per answer, and there is no charge when Google shows no AI answer.'],
  ['Why do the sources change between runs?', 'AI engines re-search the web and answers vary. Run the same questions a few times or on a weekly schedule and look at the totals rather than any single answer.'],
];

export default function Page() {
  const howTo = { '@context': 'https://schema.org', '@type': 'HowTo', name: title, step: steps.map(([n, t], i) => ({ '@type': 'HowToStep', position: i + 1, name: n, text: t })) };
  const article = { '@context': 'https://schema.org', '@type': 'Article', headline: title, description, author: { '@type': 'Person', name: 'Kendall Sorenson' }, datePublished: '2026-11-04', mainEntityOfPage: 'https://aivisibilitychecker.app/which-sites-ai-cites-in-your-niche' };
  const cit = CITATIONS.replace('utm_content=footer', 'utm_content=article-citations');
  return (<>
    <header className="hero"><div className="wrap">
      <h1>How to see which sites Google AI Overviews and ChatGPT cite in your niche</h1>
      <p>By Kendall Sorenson. A spreadsheet and an hour gets you most of the way. Here is the method, then where automation helps.</p>
    </div></header>
    <main className="wrap">
      <section><p>AI answers are built from a small set of pages. If you know which pages those are for your category, you know where a mention is worth the most, and you stop guessing about what to write.</p>
        <ol>{steps.map(([n, t]) => <li key={n}><strong>{n}.</strong> {t}</li>)}</ol></section>
      <section><h2>Where the tools help</h2>
        <p>Steps 2 to 5 are the slow part. The <a href={cit}>AI Citation Tracker</a> on Apify does them for your full question list and hands back the cited URLs, domain share and the questions where competitors are cited and you are not.</p>
        <p>If you care more about whether your brand is named in the answer than about the sources, use the <a href="/">free checker</a> for a quick look or the <a href={TRACKER('article-citations')}>AI Visibility Tracker</a> to follow it over time.</p>
        <p>Related: <a href="/why-chatgpt-recommends-competitors">why ChatGPT recommends your competitors</a> · <a href="/best-ai-visibility-tools">best AI visibility tools compared</a> · <a href="/how-to-see-which-sources-chatgpt-cites">how to see which sources ChatGPT cites</a> · <a href="/free-ai-visibility-checker">free AI visibility checker</a></p></section>
      <section><h2>FAQ</h2>{faq.map(([q, a]) => <details key={q} open><summary>{q}</summary><p>{a}</p></details>)}</section>
    </main>
    <Footer />
    <Ld data={faqLd(faq)} /><Ld data={howTo} /><Ld data={article} />
  </>);
}
