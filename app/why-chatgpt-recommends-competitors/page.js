import { TRACKER } from '../links.js';
import { Ld, faqLd } from '../site.js';
import Footer from '../Footer.js';

const title = 'Why ChatGPT Recommends Your Competitors (and How to Find Out)';
const description = 'A practical way to work out why ChatGPT names other brands for your buyers\u2019 questions, what it is reading, and how to tell if your fixes are working.';
export const metadata = { title, description, alternates: { canonical: '/why-chatgpt-recommends-competitors' }, openGraph: { title, description, type: 'article', images: ['/opengraph-image'] }, authors: [{ name: 'Kendall Sorenson' }] };

const steps = [
  ['Pick the questions that cost you deals', 'Think about what a buyer types before they have heard of you: "best invoicing app for freelancers", "cheaper alternative to X". Five to ten is plenty. Leave your own name out.'],
  ['Ask each one in a clean chat', 'Use a new chat with search turned on, ideally logged out, so your history does not steer the answer. Write down every brand it names and the order.'],
  ['Open the sources behind the answer', 'Click the sources ChatGPT shows. Most of the time the competitor that keeps winning is the one listed on those pages: review sites, "best of" roundups, forum threads, comparison posts.'],
  ['Read how it describes the winner', 'The phrases ChatGPT uses ("best for small teams", "cheapest") usually come straight from those pages. That tells you which claim you need to make, and where.'],
  ['Check whether you are on those pages at all', 'If a roundup that ChatGPT keeps citing does not mention you, that is your first fix: ask to be included, offer a trial for a review, or answer the thread honestly.'],
  ['Re-check after a few weeks', 'AI answers move slowly and vary from run to run. Ask the same questions again with the same wording and compare. Counting how often you appear out of several tries is more honest than one screenshot.'],
];
const faq = [
  ['Is there a quick way to see where I stand right now?', 'The free checker on this site asks ChatGPT (with web search) three buyer-style questions in your category and shows who it recommends, where you rank and which sources it used. No account needed.'],
  ['How do I keep track over months without doing this by hand?', 'The AI Visibility Tracker on Apify runs your own prompts through ChatGPT, Gemini and Perplexity, saves each run and charts the trend. It costs $0.04 per answer, so 10 prompts on 2 engines once a week is about $0.80 a week.'],
  ['Can I make ChatGPT recommend me?', 'Not directly. What you can influence is the content it reads: the pages it cites for your category and how clearly your own site says who you are for.'],
];

export default function Page() {
  const howTo = { '@context': 'https://schema.org', '@type': 'HowTo', name: title, step: steps.map(([n, t], i) => ({ '@type': 'HowToStep', position: i + 1, name: n, text: t })) };
  const article = { '@context': 'https://schema.org', '@type': 'Article', headline: title, description, author: { '@type': 'Person', name: 'Kendall Sorenson' }, datePublished: '2026-11-04', mainEntityOfPage: 'https://aivisibilitychecker.app/why-chatgpt-recommends-competitors' };
  return (<>
    <header className="hero"><div className="wrap">
      <h1>Why ChatGPT recommends your competitors, and how to find out</h1>
      <p>By Kendall Sorenson. You can do all of this by hand in an afternoon. The tools at the end just save the repetition.</p>
    </div></header>
    <main className="wrap">
      <section><p>If a buyer asks ChatGPT for a tool like yours and gets three other names, it is rarely random. ChatGPT search leans on a handful of pages for each question, and the brands on those pages get named. The job is to find those pages.</p>
        <ol>{steps.map(([n, t]) => <li key={n}><strong>{n}.</strong> {t}</li>)}</ol></section>
      <section><h2>Where the tools help</h2>
        <p>For a first look, <a href="/">run the free checker</a>. It does steps 2 and 3 for three questions in about 30 seconds.</p>
        <p>Once you are making changes and want to know if they work, the <a href={TRACKER('article-competitors')}>AI Visibility Tracker</a> repeats your exact prompts on a schedule and shows how often you are mentioned, your rank against competitors and the sources each engine cited.</p>
        <p>Related: <a href="/how-to-check-chatgpt-brand-mentions">how to check if ChatGPT recommends your brand</a> · <a href="/which-sites-ai-cites-in-your-niche">which sites Google AI Overviews and ChatGPT cite in your niche</a></p></section>
      <section><h2>FAQ</h2>{faq.map(([q, a]) => <details key={q} open><summary>{q}</summary><p>{a}</p></details>)}</section>
    </main>
    <Footer />
    <Ld data={faqLd(faq)} /><Ld data={howTo} /><Ld data={article} />
  </>);
}
