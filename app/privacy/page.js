import Footer from '../Footer.js';

const title = 'Privacy policy';
const description = 'What the free AI Visibility Checker stores, how report emails work, and how to unsubscribe.';
export const metadata = {
  title,
  description,
  alternates: { canonical: '/privacy' },
  openGraph: { title, description, type: 'article' },
};

export default function Privacy() {
  return (<>
    <header className="hero"><div className="wrap">
      <h1>Privacy policy</h1>
      <p>This site is operated by Kendall Sorenson. Updated Nov 12, 2026.</p>
    </div></header>
    <main className="wrap">
      <section>
        <h2>What a check stores</h2>
        <p>You can run a check with a brand name. An account and a website URL are not required. We store the brand, the category if you entered one, the questions, the scores, the brands named, and the cited domains. That copy makes a repeat check instant and lets a share link work. The share link does not include the raw AI answers.</p>
        <p>Raw answers are stored separately for 24 hours, encrypted, and tied to an httpOnly cookie in the browser that ran the check. Another person with the share link cannot open them.</p>
        <p>Rate limits use a salted hash of the IP address. We do not keep the raw IP in the counter.</p>
      </section>
      <section>
        <h2>Report email</h2>
        <p>If you ask for the report by email, you have to check a consent box and then confirm from your inbox. We store the address, the time you asked, and a copy of that report until you unsubscribe. The address is encrypted. It is not shown on the site and it is not sent to the browser again.</p>
        <p>If you do not confirm within 48 hours, the address is deleted when that confirmation link is opened, or when the same address is submitted again.</p>
        <p>Monthly tracking, when it is offered, is $24/month. It re-checks one saved brand weekly on ChatGPT with web search and emails the result with the run count and the raw answers. Stripe processes the payment. We store the Stripe customer id with the encrypted address. We do not store the card number. Views and clicks on that offer, checkout starts, and completed subscriptions are stored as daily totals. Those totals do not include a brand, an email address, or an IP address.</p>
        <p>Every email has an unsubscribe link. Unsubscribing deletes the address and the stored report. For a paid tracking subscription, that link also cancels the subscription. You can cancel anytime in the billing portal from the tracking email. Resend sends the email. The message comes from an address on a domain already verified for that account.</p>
      </section>
      <section>
        <h2>What we do not do</h2>
        <p>We do not sell personal information. We do not require an account. The check does not fetch a URL you type. Vercel hosts the site, stores the encrypted records, and provides aggregate analytics. Analytics events do not include your brand name, email, IP, or the text you type.</p>
        <p>This site is not directed at children.</p>
      </section>
      <section>
        <h2>Deletion</h2>
        <p>Use the unsubscribe link in any email we send. That deletes the address. The anonymous check result can remain so the share link keeps working. It does not include your email or the raw answers.</p>
      </section>
    </main>
    <Footer />
  </>);
}
