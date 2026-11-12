import { emailCaptureEnabled } from '../../../lib/emailAddress.js';
import { paidReportEnabled } from '../../../lib/paidReport.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function GET() {
  return Response.json({
    emailCapture: emailCaptureEnabled(),
    paidReport: paidReportEnabled(),
  }, { headers: { 'cache-control': 'no-store' } });
}
