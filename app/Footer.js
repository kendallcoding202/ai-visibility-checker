import { TRACKER, ADS, CITATIONS } from './links.js';
export default function Footer() {
  return <footer><div className="wrap">
    <p><a href="/">Free AI Visibility Checker</a> · <a href="/best-ai-visibility-tools">Best AI visibility tools</a> · <a href="/how-to-check-chatgpt-brand-mentions">How to check ChatGPT brand mentions</a></p>
    <p>Built by Kendall Sorenson. Tools: <a href={TRACKER('footer')}>AI Search Visibility Tracker (ChatGPT &amp; Gemini)</a> · <a href={CITATIONS}>AI Citation Tracker (which sites ChatGPT cites)</a> · <a href={ADS}>Google Ads Transparency &amp; Ad Library Scraper</a></p>
    <p className="muted">Not affiliated with OpenAI, Google, HubSpot, Semrush, Otterly.AI or Peec AI.</p>
  </div></footer>;
}
