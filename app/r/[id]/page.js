import { notFound } from 'next/navigation';
import Result from '../../Result.js';
import { getJSON } from '../../../lib/store.js';
import { publicResult } from '../../../lib/publicResult.js';
import { paidReportEnabled } from '../../../lib/paidReport.js';

export const dynamic = 'force-dynamic';
const load = async (id) => (/^[a-f0-9]{24}$/.test(id) ? (await getJSON(`cache/${id}`))?.result ?? null : null);

export async function generateMetadata({ params }) {
  const d = await load((await params).id);
  if (!d) return { title: 'Result not found', robots: { index: false } };
  const t = `${d.brand}: AI visibility score ${d.score}/100 on ChatGPT`;
  const desc = `ChatGPT mentioned ${d.brand} in ${d.mentionedIn} of ${d.total} answers about ${d.category}. Check your brand free.`;
  return { title: t, description: desc, robots: { index: false, follow: true }, openGraph: { title: t, description: desc }, twitter: { card: 'summary_large_image', title: t, description: desc } };
}

export default async function SharedResult({ params }) {
  const { id } = await params;
  const stored = await load(id);
  if (!stored) notFound();
  const d = publicResult(stored, { id, cached: true });
  return (<header className="hero"><div className="wrap">
    <h1>Does ChatGPT recommend {d.brand}?</h1>
    <p>Shared result from the free AI Visibility Checker. <a href="/" style={{ color: 'inherit', fontWeight: 700 }}>Check your own brand free →</a></p>
    <Result d={d} shared showPaidReport={paidReportEnabled()} emailCapture={false} />
  </div></header>);
}
