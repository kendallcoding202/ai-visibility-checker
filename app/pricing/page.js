import Footer from '../Footer.js';
import { PAID_REPORT_PRICE } from '../../lib/paidReport.js';
import { TRACKING_TIER_PRICE } from '../../lib/trackingTier.js';
import { freeChecker, tracker } from '../../lib/costCompare.js';

const title = 'AI Visibility Checker pricing';
const description = `Free check, a one-time report at ${PAID_REPORT_PRICE}, and monthly tracking at ${TRACKING_TIER_PRICE}. The Apify tracker is $${tracker.pricePerAnswer} per answer on the Free tier. Prices checked Nov 23, 2026.`;
export const metadata = {
  title,
  description,
  alternates: { canonical: '/pricing' },
  openGraph: { title, description, type: 'website', images: ['/opengraph-image'] },
  twitter: { card: 'summary_large_image', title, description },
  authors: [{ name: 'Kendall Sorenson' }],
};

export default function Page() {
  return (<>
    <header className="hero"><div className="wrap">
      <h1>Pricing</h1>
      <p>Free check, one-time report, monthly tracking, and the Apify tracker.</p>
    </div></header>
    <main className="wrap">
      <div className="plans">
        <article className="plan" id="free-check">
          <h2>Free check</h2>
          <p className="price">$0</p>
          <p>Three buyer-style questions to ChatGPT with web search. Shows whether it names your brand, where it ranks you, which competitors it picks and which sources it cites, with the raw answers. A brand name is enough: no account, no card. {freeChecker.checksPerIpPerDay} free checks per day.</p>
          <p><a href="/#checker">Run a free check</a></p>
        </article>
        <article className="plan" id="one-time-report">
          <h2>One-time report</h2>
          <p className="price">{PAID_REPORT_PRICE}</p>
          <p>A written report of one check: the score, the three raw answers, the brands ChatGPT named, the cited sources, and what to fix. Pay once through Stripe. No subscription.</p>
        </article>
        <article className="plan" id="monthly-tracking">
          <h2>Monthly tracking</h2>
          <p className="price">{TRACKING_TIER_PRICE}</p>
          <p>One saved brand, re-checked weekly on ChatGPT with web search (the same three questions). Each result is emailed with the run count and the raw answers. Requires a free check and a confirmed email for that brand, then Stripe checkout. Cancel anytime.</p>
        </article>
        <article className="plan" id="apify-tracker">
          <h2>AI Visibility Tracker on Apify</h2>
          <p className="price">${tracker.pricePerAnswer} <span>per answer</span></p>
          <p>Free tier. Covers ChatGPT, Gemini and Perplexity, with no monthly fee. Billed by Apify.</p>
        </article>
      </div>
      <p className="muted">Prices checked Nov 23, 2026. Stripe processes payments; we do not store card numbers.</p>
    </main>
    <Footer />
  </>);
}
