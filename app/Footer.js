import { TRACKER, ADS, CITATIONS } from './links.js';
import TrackLink from './TrackLink.js';
import { EVENTS } from '../lib/analyticsEvents.js';
export default function Footer() {
  return <footer><div className="wrap">
    <p><a href="/">Free AI Visibility Checker</a> · <a href="/free-ai-visibility-checker">Free checker guide</a> · <a href="/best-ai-visibility-tools">Best AI visibility tools</a> · <a href="/ai-visibility-tracker-vs-otterly-profound-peec-semrush">Tracker vs Otterly, Profound, Peec, Semrush</a> · <a href="/how-to-check-chatgpt-brand-mentions">How to check ChatGPT brand mentions</a> · <a href="/how-to-see-which-sources-chatgpt-cites">Which sources ChatGPT cites</a> · <a href="/why-chatgpt-recommends-competitors">Why ChatGPT recommends competitors</a> · <a href="/which-sites-ai-cites-in-your-niche">Which sites AI cites in your niche</a> · <a href="/what-chatgpt-business-dashboard-wont-tell-you">What ChatGPT&apos;s business dashboard won&apos;t tell you</a> · <a href="/business-hub-vs-ai-visibility-tracker">Business Hub vs AI Visibility Tracker</a></p>
    <p>Built by Kendall Sorenson. Tools: <TrackLink href={TRACKER('footer')} event={EVENTS.TRACKER_CTA_CLICK} location="footer">AI Visibility Tracker (ChatGPT, Gemini &amp; Perplexity)</TrackLink> · <TrackLink href={CITATIONS} event={EVENTS.CITATION_CTA_CLICK} location="footer">AI Citation Tracker (which sites ChatGPT, Perplexity &amp; Google AI Overviews cite)</TrackLink> · <a href={ADS}>Google Ads Transparency &amp; Ad Library Scraper</a></p>
    <p className="muted">We use Vercel Web Analytics for aggregate page views and actions. Event properties do not include your brand name, email, IP, or the text you type. <a href="/privacy">Privacy policy</a>.</p>
    <p className="muted">Not affiliated with OpenAI, Google, HubSpot, Semrush, Otterly.AI or Peec AI.</p>
    <p className="fazier"><a href="https://fazier.com" target="_blank" rel="noopener"><img src="https://fazier.com/api/v1//public/badges/launch_badges.svg?badge_type=featured&theme=light" width={160} alt="Fazier badge" /></a><span className="muted"> <a href="https://twelve.tools">Listed on Twelve.tools</a> · <a href="https://dang.ai">Featured on Dang.ai</a></span></p>
  </div></footer>;
}
