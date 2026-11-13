import Checker from './Checker.js';
import { emailCaptureEnabled } from '../lib/emailAddress.js';
import { paidReportEnabled } from '../lib/paidReport.js';
import { trackingTierEnabled } from '../lib/trackingTier.js';

export default function InlineCheck() {
  return (
    <section id="checker">
      <h2 id="check">Check your brand</h2>
      <p>Enter a brand name to see whether ChatGPT mentions it on three buyer-style questions.</p>
      <Checker
        source="article"
        showPaidReport={paidReportEnabled()}
        showTrackingTier={trackingTierEnabled()}
        emailCapture={emailCaptureEnabled()}
      />
    </section>
  );
}
