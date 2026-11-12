import { TRACKING_SUCCESS_BODY, TRACKING_SUCCESS_TITLE } from '../../../lib/trackingTier.js';

export const metadata = { title: TRACKING_SUCCESS_TITLE, robots: { index: false, follow: false } };

export default function Page() {
  return (<header className="hero"><div className="wrap">
    <h1>{TRACKING_SUCCESS_TITLE}</h1>
    <p>{TRACKING_SUCCESS_BODY}</p>
    <p><a href="/">Back to the checker</a></p>
  </div></header>);
}
