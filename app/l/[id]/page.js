import { notFound } from 'next/navigation';
import LookupResult from '../../LookupResult.js';
import { getJSON } from '../../../lib/store.js';

export const dynamic = 'force-dynamic';
const load = async (id) => (/^[a-f0-9]{24}$/.test(id) ? (await getJSON(`lookup/${id}`))?.result ?? null : null);

export async function generateMetadata({ params }) {
  const d = await load((await params).id);
  if (!d) return { title: 'Lookup not found', robots: { index: false } };
  const t = `Who ChatGPT recommends for ${d.market}`;
  const desc = 'Brands named in one ChatGPT answer for this market. The link is unlisted.';
  return {
    title: t,
    description: desc,
    robots: { index: false, follow: false },
    openGraph: { title: t, description: desc },
  };
}

export default async function SharedLookup({ params }) {
  const { id } = await params;
  const d = await load(id);
  if (!d || typeof d.market !== 'string') notFound();
  return (<header className="hero"><div className="wrap">
    <h1>Who ChatGPT recommends</h1>
    <p>Unlisted result. <a href="/#market" style={{ color: 'inherit', fontWeight: 700 }}>Look up your own market →</a></p>
    <LookupResult d={{ ...d, id }} />
  </div></header>);
}
