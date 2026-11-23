import { emailCaptureEnabled } from '../../../lib/emailAddress.js';
import { paidReportEnabled } from '../../../lib/paidReport.js';
import { trackingOfferActive } from '../../../lib/trackingOffer.js';
import { trackingTierEnabled } from '../../../lib/trackingTier.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function GET() {
  return Response.json({
    emailCapture: emailCaptureEnabled(),
    paidReport: paidReportEnabled(),
    trackingTier: trackingTierEnabled(),
    trackingOffer: trackingOfferActive(),
  }, { headers: { 'cache-control': 'no-store' } });
}
