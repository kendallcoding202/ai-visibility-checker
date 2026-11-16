import LocalChecker from '../LocalChecker.js';
import { Ld, orgLd } from '../site.js';
import { localServiceBusinessEnabled } from '../../lib/localLimits.js';
import { notFound } from 'next/navigation';

export const metadata = {
  title: 'Free Local Business AI Visibility Checker',
  description: 'Does ChatGPT recommend your local business? Check if AI assistants mention your plumbing, dental, or service business when customers ask.',
};

const faq = [
  ['How does the local business checker work?', 'Enter your business name, service type, city and state. We ask ChatGPT three customer-style questions about local businesses in your area, then detect whether your business is mentioned, where it ranks, and which directories are cited. If you provide your website, we audit it for local SEO signals.'],
  ['Why do local businesses need AI visibility?', 'More customers now ask ChatGPT, Gemini and Perplexity "who should I call for plumbing in Denver" instead of searching Google. If AI assistants don\'t mention your business, you\'re invisible at the exact moment a customer is choosing.'],
  ['What does the website audit check?', 'We check your homepage, robots.txt, llms.txt, and sitemap.xml for LocalBusiness structured data, business name and address on the page, service and city in title and headings, FAQ content, whether you block AI crawlers, and whether you have an llms.txt file.'],
  ['Is it really free?', 'Yes. You get 3 free AI visibility checks per day. Website audits have a separate limit of 2 per day. Results are cached for 24 hours.'],
];

function LinkedText({ text }) {
  return text;
}

export default function LocalPage() {
  if (!localServiceBusinessEnabled()) {
    notFound();
  }

  const ld = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) };
  return (<>
    <header className="hero"><div className="wrap">
      <h1>Free Local Business AI Visibility Checker</h1>
      <p>Does ChatGPT recommend your business? Check if AI assistants mention your plumbing, dental, or service business when customers ask. Get a website audit and ready-to-paste fixes.</p>
      <ul className="trust" aria-label="What the free check includes">
        <li>ChatGPT with web search</li>
        <li>Website audit for local SEO</li>
        <li>Ready-to-paste fixes</li>
      </ul>
      <h2 id="checker">Check your local business</h2>
      <LocalChecker />
    </div></header>
    <main className="wrap">
      <section>
        <h2>Why local AI visibility matters</h2>
        <p>When customers search "best plumber near me" or "dentist in Denver," they're now asking ChatGPT, Gemini and Perplexity instead of Google. If AI assistants don't mention your business, you're invisible at the exact moment a customer is choosing.</p>
        <p>This free tool gives you a snapshot of your local business visibility in ChatGPT: mention rate, ranking position, competitors, and the directories that shape AI answers. Plus a website audit and ready-to-paste fixes.</p>
      </section>
      <section>
        <h2>What you get</h2>
        <ul>
          <li><strong>AI visibility check:</strong> Does ChatGPT mention your business when customers ask? Where do you rank?</li>
          <li><strong>Website audit:</strong> Check your site for LocalBusiness structured data, service keywords, FAQ content, and whether you block AI crawlers.</li>
          <li><strong>Fix kit:</strong> Ready-to-paste LocalBusiness JSON-LD, FAQ questions, llms.txt file, and robots.txt lines for AI crawlers.</li>
          <li><strong>Directory recommendations:</strong> See which sites ChatGPT cited, and get instructions to claim your listings.</li>
        </ul>
      </section>
      <section>
        <h2>FAQ</h2>
        {faq.map(([q, a]) => <details key={q}><summary>{q}</summary><p><LinkedText text={a} /></p></details>)}
      </section>
    </main>
    <footer><div className="wrap">
      <p><a href="/">Brand checker</a> · <a href="/privacy">Privacy policy</a></p>
      <p>Built by Kendall Sorenson.</p>
      <p className="muted">Not affiliated with OpenAI or Google. Results are a single AI snapshot and may vary.</p>
    </div></footer>
    <Ld data={orgLd} />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
  </>);
}
