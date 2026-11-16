// Stripe subscription events. Activation and deactivation are keyed by the event id.
import { normalizeBrand } from './analyze.js';
import { normalizeEmail } from './emailAddress.js';
import { getSubscriber } from './subscribers.js';
import { customerIdFromCharge } from './stripeApi.js';
import {
  activateTracking,
  deactivateTracking,
  subscriberByStripeId,
} from './trackingRecords.js';
import { recordTrackingMetric } from './trackingMetrics.js';

export const TRACKING_WEBHOOK_EVENTS = [
  'checkout.session.completed',
  'checkout.session.async_payment_succeeded',
  'invoice.paid',
  'customer.subscription.deleted',
  'customer.subscription.updated',
  'customer.subscription.paused',
  'invoice.payment_failed',
  'checkout.session.async_payment_failed',
  'charge.dispute.created',
  'charge.refunded',
  'radar.early_fraud_warning.created',
];

export const PAID_REPORT_WEBHOOK_EVENTS = [
  'checkout.session.completed',
];

const ACTIVATE = new Set([
  'checkout.session.completed',
  'checkout.session.async_payment_succeeded',
  'invoice.paid',
]);

const DEACTIVATE = new Set([
  'customer.subscription.deleted',
  'customer.subscription.updated',
  'customer.subscription.paused',
  'invoice.payment_failed',
  'checkout.session.async_payment_failed',
  'charge.dispute.created',
  'charge.refunded',
  'radar.early_fraud_warning.created',
]);

const DEAD_STATUS = new Set(['canceled', 'unpaid', 'incomplete_expired', 'paused', 'past_due']);

function idOf(value) {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && typeof value.id === 'string') return value.id;
  return '';
}

export function idsFromStripeEvent(event) {
  const obj = event?.data?.object ?? {};
  const type = String(event?.type ?? '');
  if (type.startsWith('checkout.session.')) {
    return {
      customerId: idOf(obj.customer),
      subscriptionId: idOf(obj.subscription),
      metadata: obj.metadata ?? {},
      mode: obj.mode ?? '',
      paymentStatus: obj.payment_status ?? '',
      status: '',
      chargeId: '',
    };
  }
  if (type.startsWith('invoice.')) {
    const details = obj.parent?.subscription_details ?? obj.subscription_details ?? {};
    return {
      customerId: idOf(obj.customer),
      subscriptionId: idOf(obj.subscription) || idOf(details.subscription),
      metadata: { ...(obj.metadata ?? {}), ...(details.metadata ?? {}) },
      mode: 'subscription',
      paymentStatus: '',
      status: '',
      chargeId: '',
    };
  }
  if (type.startsWith('customer.subscription.')) {
    return {
      customerId: idOf(obj.customer),
      subscriptionId: idOf(obj.id),
      metadata: obj.metadata ?? {},
      mode: 'subscription',
      paymentStatus: '',
      status: obj.status ?? '',
      chargeId: '',
    };
  }
  const charge = obj.charge ?? obj.id;
  return {
    customerId: idOf(obj.customer) || idOf(obj.charge?.customer),
    subscriptionId: '',
    metadata: obj.metadata ?? {},
    mode: '',
    paymentStatus: '',
    status: '',
    chargeId: type.startsWith('charge.') || type.startsWith('radar.') ? idOf(charge) : '',
  };
}

async function resolveSubscriber(ids) {
  const metaEmail = normalizeEmail(ids.metadata?.email);
  if (metaEmail) {
    const byEmail = await getSubscriber(metaEmail);
    if (byEmail) return byEmail;
  }
  if (ids.customerId) {
    const byCustomer = await subscriberByStripeId('cus', ids.customerId);
    if (byCustomer) return byCustomer;
  }
  if (ids.subscriptionId) {
    const bySubscription = await subscriberByStripeId('sub', ids.subscriptionId);
    if (bySubscription) return bySubscription;
  }
  return null;
}

function brandMatches(record, metadata) {
  const saved = normalizeBrand(record.trackingBrand || record.snapshot?.brand);
  const incoming = normalizeBrand(metadata?.brand);
  if (!saved) return false;
  if (!incoming) return Boolean(record.stripeCustomerId);
  return incoming === saved;
}

export async function applyStripeEvent(event) {
  const type = String(event?.type ?? '');
  if (!ACTIVATE.has(type) && !DEACTIVATE.has(type)) return { ok: true, applied: false };
  const ids = idsFromStripeEvent(event);
  if ((type === 'charge.dispute.created' || type === 'charge.refunded' || type === 'radar.early_fraud_warning.created') && !ids.customerId && ids.chargeId) {
    const looked = await customerIdFromCharge(ids.chargeId);
    if (!looked.ok) return { ok: false, retry: true };
    ids.customerId = looked.customerId;
  }
  if (type.startsWith('checkout.session.')) {
    if (ids.mode !== 'subscription') return { ok: true, applied: false };
    if (type === 'checkout.session.completed' && ids.paymentStatus !== 'paid') return { ok: true, applied: false };
    if (type === 'checkout.session.async_payment_succeeded' && ids.paymentStatus && ids.paymentStatus !== 'paid') {
      return { ok: true, applied: false };
    }
  }
  if (type === 'customer.subscription.updated' && !DEAD_STATUS.has(ids.status)) {
    return { ok: true, applied: false };
  }
  const record = await resolveSubscriber(ids);
  if (!record) return { ok: true, applied: false };
  const metaEmail = normalizeEmail(ids.metadata?.email);
  if (metaEmail && metaEmail !== record.email) return { ok: true, applied: false };
  if (ids.subscriptionId && record.stripeSubscriptionId && ids.subscriptionId !== record.stripeSubscriptionId) {
    if (!ACTIVATE.has(type) || record.trackingActive) return { ok: true, applied: false };
  }
  if (ACTIVATE.has(type)) {
    if (record.status !== 'confirmed') return { ok: true, applied: false };
    if (!brandMatches(record, ids.metadata)) return { ok: true, applied: false };
    const wasActive = Boolean(record.trackingActive);
    const saved = await activateTracking(record.email, {
      customerId: ids.customerId,
      subscriptionId: ids.subscriptionId,
      brand: record.snapshot?.brand || record.trackingBrand || '',
      category: record.snapshot?.category || '',
    });
    // Checkout completion only. invoice.paid also activates renewals and recoveries.
    if (saved && !wasActive && (type === 'checkout.session.completed' || type === 'checkout.session.async_payment_succeeded')) {
      try { await recordTrackingMetric('subscription'); } catch { /* the count must not fail the webhook */ }
    }
    return saved ? { ok: true, applied: true } : { ok: false, retry: true };
  }
  const saved = await deactivateTracking(record.email);
  return saved ? { ok: true, applied: true } : { ok: false, retry: true };
}

export async function applyPaidReportEvent(event) {
  const type = String(event?.type ?? '');
  if (type !== 'checkout.session.completed') return { ok: true, applied: false };
  const obj = event?.data?.object ?? {};
  if (obj.mode !== 'payment') return { ok: true, applied: false };
  if (obj.payment_status !== 'paid') return { ok: true, applied: false };
  const metadata = obj.metadata ?? {};
  if (metadata.type !== 'paid_report') return { ok: true, applied: false };
  
  const email = normalizeEmail(metadata.email);
  const resultId = String(metadata.resultId ?? '');
  const sessionId = String(obj.id ?? '');
  if (!email || !/^[a-f0-9]{24}$/.test(resultId)) {
    return { ok: true, applied: false };
  }

  // Fetch the check result and answers: try snapshot first (reliable), then cache (may be stale/missing)
  const { readJSON } = await import('./store.js');
  const snapshotKey = `paid-report-snapshot/${sessionId}`;
  const snapshotData = await readJSON(snapshotKey);
  let result = null;
  let answers = null;
  
  if (snapshotData.ok && snapshotData.value?.result) {
    result = snapshotData.value.result;
    answers = snapshotData.value.answers || null;
  } else {
    const cached = await readJSON(`cache/${resultId}`);
    if (cached.ok && cached.value?.result) {
      result = cached.value.result;
    }
  }

  if (!result) {
    // Payment succeeded but check result is missing. Do not auto-refund.
    // Customer paid for a report that cannot be delivered.
    console.error(`paid report undeliverable sessionId=${sessionId} resultId=${resultId}`);
    
    // Send alert to admin if configured (deduplicated by marker key)
    const adminEmail = String(process.env.ALERT_EMAIL ?? '').trim();
    if (adminEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) {
      const { readJSON, setJSON } = await import('./store.js');
      const alertKey = `alert-sent/${sessionId}`;
      const alreadySent = await readJSON(alertKey);
      
      if (!alreadySent.ok || !alreadySent.value) {
        // Send alert once per session
        const { sendMail } = await import('./mailer.js');
        const sent = await sendMail({
          to: adminEmail,
          subject: 'Paid report undeliverable',
          text: `A paid report could not be delivered. Session: ${sessionId}. Customer will need manual refund or report resend.`,
          html: `<p>A paid report could not be delivered.</p><p>Session: ${sessionId}</p><p>Customer will need manual refund or report resend.</p>`,
          unsubUrl: 'https://aivisibilitychecker.app/privacy',
          idempotencyKey: `alert-undeliverable/${sessionId}`,
        });
        
        if (sent.ok) {
          // Mark alert as sent
          await setJSON(alertKey, { sent: true, at: Date.now() });
        }
      }
    }
    
    // Return retry:true so Stripe keeps trying (in case result appears)
    return { ok: false, retry: true };
  }

  // Send the report
  const { paidReportEmail } = await import('./emailCopy.js');
  const { reportSnapshot } = await import('./publicResult.js');
  const { paidReportIdempotencyKey, sendMail } = await import('./mailer.js');
  const { track } = await import('@vercel/analytics/server');
  const { EVENTS, trackEvent } = await import('./analyticsEvents.js');

  const snapshotForEmail = reportSnapshot(result);
  const message = paidReportEmail({ snapshot: snapshotForEmail, answers });
  const paymentIntentId = String(obj.payment_intent ?? '');
  
  const sent = await sendMail({
    to: email,
    subject: message.subject,
    text: message.text,
    html: message.html,
    unsubUrl: 'https://aivisibilitychecker.app/privacy',
    idempotencyKey: paidReportIdempotencyKey(paymentIntentId, email),
  });

  if (!sent.ok) {
    console.error(`paid report mail failed sessionId=${sessionId} reason=${sent.reason}`);
    return { ok: false, retry: true };
  }

  try {
    await trackEvent(track, EVENTS.CHECKOUT_COMPLETED, { checkout_type: 'paid_report' });
  } catch { /* the count must not fail the webhook */ }

  return { ok: true, applied: true };
}
