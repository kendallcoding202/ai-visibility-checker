import { notFound } from 'next/navigation';
import PaidReportView from '../PaidReportView.js';
import { paidReportPageModel } from '../../lib/paidReportPage.js';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'AI visibility report',
  robots: { index: false, follow: false },
};

export default async function Page({ searchParams }) {
  const model = await paidReportPageModel(await searchParams);
  if (!model) notFound();
  return (<main className="wrap">
    <PaidReportView doc={model.doc} token={model.token} showError={model.showError} />
  </main>);
}
