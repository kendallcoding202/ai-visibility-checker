import ManageForm from './ManageForm.js';
import { subscriberByToken } from '../../../lib/subscribers.js';

export const metadata = { title: 'Manage monthly tracking', robots: { index: false, follow: false } };

const TOKEN = /^[A-Za-z0-9_-]{43}$/;

export default async function Page({ searchParams }) {
  const token = String((await searchParams).token ?? '');
  let record = null;
  if (TOKEN.test(token)) {
    try { record = await subscriberByToken('manage', token); } catch { record = null; }
  }
  return (<header className="hero"><div className="wrap">
    <h1>Manage monthly tracking</h1>
    {record
      ? <ManageForm
          token={token}
          brand={record.trackingBrand || record.snapshot?.brand || ''}
          active={Boolean(record.trackingActive)}
          canPortal={Boolean(record.stripeCustomerId)}
          unsubToken={record.unsubToken || ''}
        />
      : <p>This link is not valid.</p>}
  </div></header>);
}
