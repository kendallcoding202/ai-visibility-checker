import { notFound } from 'next/navigation';
import LookupResult from '../../LookupResult.js';
import { loadPublicCache } from '../../../lib/store.js';
import { LOOKUP_UNAVAILABLE_ERROR } from '../../../lib/checkError.js';

export const dynamic = 'force-dynamic';
const load = async (id) => (/^[a-f0-9]{24}$/.test(id) ? loadPublicCache(`lookup/${id}`) : { ok: true, result: null });

export async function generateMetadata({ params }) {
  const loaded = await load((await params).id);
  if (!loaded.ok) return { title: 'Lookup temporarily unavailable', robots: { index: false } };
  const d = loaded.result;
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
  const loaded = await load(id);
  if (!loaded.ok) {
    return (<header className="hero"><div className="wrap">
      <h1>Lookup temporarily unavailable</h1>
      <p className="err" role="alert">{LOOKUP_UNAVAILABLE_ERROR}</p>
    </div></header>);
  }
  const d = loaded.result;
  if (!d || typeof d.market !== 'string') notFound();
  return (<header className="hero"><div className="wrap">
    <h1>Who ChatGPT recommends</h1>
    <p>Unlisted result. <a href="/#market" style={{ color: 'inherit', fontWeight: 700 }}>Look up your own market →</a></p>
    <LookupResult d={{ ...d, id }} />
  </div></header>);
}
