import UnsubscribeForm from './UnsubscribeForm.js';
import { subscriberByToken } from '../../../lib/subscribers.js';

export const metadata = { title: 'Unsubscribe', robots: { index: false, follow: false } };

const TOKEN = /^[A-Za-z0-9_-]{43}$/;

export default async function Page({ searchParams }) {
  const token = String((await searchParams).token ?? '');
  let paid = false;
  if (TOKEN.test(token)) {
    try {
      const record = await subscriberByToken('unsub', token);
      paid = Boolean(record?.stripeSubscriptionId || record?.trackingActive);
    } catch { paid = false; }
  }
  return (<header className="hero"><div className="wrap">
    <h1>Unsubscribe</h1>
    {TOKEN.test(token)
      ? <UnsubscribeForm token={token} paid={paid} />
      : <p>This unsubscribe link is not valid.</p>}
  </div></header>);
}
