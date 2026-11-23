import { trackingCheckoutDiscount } from '../../../lib/stripeApi.js';
import { trackingSuccessBody } from '../../../lib/trackingOffer.js';
import { TRACKING_SUCCESS_BODY, TRACKING_SUCCESS_TITLE } from '../../../lib/trackingTier.js';

export const metadata = { title: TRACKING_SUCCESS_TITLE, robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function Page({ searchParams }) {
  const sessionId = String((await searchParams)?.session_id ?? '');
  const discount = await trackingCheckoutDiscount(sessionId);
  const body = discount > 0 ? trackingSuccessBody(discount) : TRACKING_SUCCESS_BODY;
  return (<header className="hero"><div className="wrap">
    <h1>{TRACKING_SUCCESS_TITLE}</h1>
    <p>{body}</p>
    <p><a href="/">Back to the checker</a></p>
  </div></header>);
}
