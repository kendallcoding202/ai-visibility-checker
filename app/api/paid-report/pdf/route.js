import { originForMail } from '../../../../lib/emailAddress.js';
import { AGENCY_ERROR, parseAgencyName } from '../../../../lib/buyingStage.js';
import { isReportToken, loadPaidReport } from '../../../../lib/paidReportAccess.js';
import { buildPaidReportPdf } from '../../../../lib/paidReportPdf.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const noStore = {
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
};

function plain(message, status) {
  return new Response(message, {
    status,
    headers: { ...noStore, 'content-type': 'text/plain; charset=utf-8' },
  });
}

export async function GET(req) {
  const url = new URL(req.url);
  const token = url.searchParams.get('token') ?? '';
  if (!isReportToken(token)) return plain('Not found', 404);
  const agency = parseAgencyName(url.searchParams.get('agency'));
  if (!agency.ok) {
    const origin = originForMail(url.host);
    if (!origin) return plain(AGENCY_ERROR, 400);
    const back = new URL('/paid-report', origin);
    back.searchParams.set('token', token);
    back.searchParams.set('error', 'agency');
    return Response.redirect(back, 303);
  }
  const report = await loadPaidReport(token);
  if (!report) return plain('Not found', 404);
  try {
    const bytes = await buildPaidReportPdf({
      result: report.result,
      answers: report.answers,
      agency: agency.name,
    });
    return new Response(Buffer.from(bytes), {
      status: 200,
      headers: {
        ...noStore,
        'content-type': 'application/pdf',
        'content-disposition': 'attachment; filename="ai-visibility-report.pdf"',
      },
    });
  } catch (error) {
    if (error?.code === 'agency') return plain(AGENCY_ERROR, 400);
    console.error('paid report pdf failed');
    return plain('The PDF could not be created.', 500);
  }
}
