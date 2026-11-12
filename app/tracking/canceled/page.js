import { TRACKING_CANCELED_BODY } from '../../../lib/trackingTier.js';

export const metadata = { title: 'Checkout canceled', robots: { index: false, follow: false } };

export default function Page() {
  return (<header className="hero"><div className="wrap">
    <h1>Checkout canceled</h1>
    <p>{TRACKING_CANCELED_BODY}</p>
    <p><a href="/">Back to the checker</a></p>
  </div></header>);
}
