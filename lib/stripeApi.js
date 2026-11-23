// Stripe calls for monthly tracking. The secret key stays in the environment.
// Failures log a Stripe error type or code only, never the key, the email, or the payload.
import Stripe from 'stripe';
import { randomBytes } from 'node:crypto';
import { trackingPromotionCode } from './trackingOffer.js';

const API_VERSION = '2026-09-30.endive';
const PRICE_ID = /^price_[A-Za-z0-9]+$/;
const CUSTOMER_ID = /^cus_[A-Za-z0-9]+$/;
const SUBSCRIPTION_ID = /^sub_[A-Za-z0-9]+$/;
const CHECKOUT_SESSION_ID = /^cs_[A-Za-z0-9_]{1,200}$/;

let stripeSingleton = null;
let testStripe = null;

export function setStripeForTests(client) {
  testStripe = client;
}

export function resetStripeForTests() {
  testStripe = null;
  stripeSingleton = null;
}

export function getStripe() {
  if (testStripe) return testStripe;
  const key = String(process.env.STRIPE_SECRET_KEY ?? '').trim();
  if (key.length < 8) return null;
  if (!stripeSingleton) stripeSingleton = new Stripe(key, { apiVersion: API_VERSION });
  return stripeSingleton;
}

export function constructStripeEvent(payload, signature, secret) {
  return Stripe.webhooks.constructEvent(payload, signature, secret);
}

export function trackingPriceId() {
  const price = String(process.env.STRIPE_TRACKING_PRICE_ID ?? '').trim();
  return PRICE_ID.test(price) ? price : '';
}

export function paidReportPriceId() {
  const price = String(process.env.STRIPE_PAID_REPORT_PRICE_ID ?? '').trim();
  return PRICE_ID.test(price) ? price : '';
}

export function validCustomerId(id) {
  return CUSTOMER_ID.test(String(id ?? ''));
}

export function validSubscriptionId(id) {
  return SUBSCRIPTION_ID.test(String(id ?? ''));
}

function integrationIdentifier() {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz';
  const bytes = randomBytes(8);
  let suffix = '';
  for (const byte of bytes) suffix += alphabet[byte % 26];
  return `aic_tracking_${suffix}`;
}

function stripeErrorCode(error) {
  return error?.code || error?.type || error?.name || 'Error';
}

export function safeStripeUrl(url, host) {
  try {
    const parsed = new URL(String(url ?? ''));
    if (parsed.protocol !== 'https:') return '';
    if (parsed.hostname !== host) return '';
    return parsed.toString();
  } catch {
    return '';
  }
}

export async function createTrackingCheckout({
  email,
  brand,
  customerId,
  successUrl,
  cancelUrl,
}) {
  const stripe = getStripe();
  const price = trackingPriceId();
  if (!stripe || !price) return { ok: false, reason: 'unconfigured' };
  const metadata = { brand, email };
  const params = {
    mode: 'subscription',
    line_items: [{ price, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata,
    subscription_data: { metadata },
    integration_identifier: integrationIdentifier(),
  };
  if (validCustomerId(customerId)) params.customer = customerId;
  else params.customer_email = email;
  const promoId = trackingPromotionCode();
  const withDiscount = promoId ? { ...params, discounts: [{ promotion_code: promoId }] } : null;
  try {
    return await openTrackingSession(stripe, withDiscount || params);
  } catch (error) {
    if (!withDiscount) {
      console.error(`stripe checkout failed code=${stripeErrorCode(error)}`);
      return { ok: false, reason: 'stripe' };
    }
    console.error(`stripe checkout discount failed code=${stripeErrorCode(error)}`);
    try {
      return await openTrackingSession(stripe, params);
    } catch (retryError) {
      console.error(`stripe checkout failed code=${stripeErrorCode(retryError)}`);
      return { ok: false, reason: 'stripe' };
    }
  }
}

async function openTrackingSession(stripe, params) {
  const session = await stripe.checkout.sessions.create(params);
  const url = safeStripeUrl(session?.url, 'checkout.stripe.com');
  if (!url) return { ok: false, reason: 'stripe' };
  return { ok: true, url };
}

export async function trackingCheckoutDiscount(sessionId) {
  const id = String(sessionId ?? '');
  if (!CHECKOUT_SESSION_ID.test(id)) return 0;
  const stripe = getStripe();
  if (!stripe?.checkout?.sessions?.retrieve) return 0;
  try {
    const session = await stripe.checkout.sessions.retrieve(id);
    const amount = Number(session?.total_details?.amount_discount);
    return Number.isFinite(amount) && amount > 0 ? amount : 0;
  } catch (error) {
    console.error(`stripe checkout session failed code=${stripeErrorCode(error)}`);
    return 0;
  }
}

export async function createTrackingPortal({ customerId, returnUrl }) {
  const stripe = getStripe();
  if (!stripe || !validCustomerId(customerId)) return { ok: false, reason: 'unconfigured' };
  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });
    const url = safeStripeUrl(session?.url, 'billing.stripe.com');
    if (!url) return { ok: false, reason: 'stripe' };
    return { ok: true, url };
  } catch (error) {
    console.error(`stripe portal failed code=${stripeErrorCode(error)}`);
    return { ok: false, reason: 'stripe' };
  }
}

export async function createPaidReportCheckout({
  email,
  brand,
  resultId,
  successUrl,
  cancelUrl,
}) {
  const stripe = getStripe();
  const price = paidReportPriceId();
  if (!stripe || !price) return { ok: false, reason: 'unconfigured' };
  const metadata = { brand, email, resultId, type: 'paid_report' };
  const params = {
    mode: 'payment',
    line_items: [{ price, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    customer_email: email,
    metadata,
    payment_intent_data: { metadata },
    integration_identifier: integrationIdentifier(),
    custom_text: {
      submit: {
        message: 'Your AI visibility report will be sent to your email after payment.',
      },
    },
  };
  try {
    const session = await stripe.checkout.sessions.create(params);
    const url = safeStripeUrl(session?.url, 'checkout.stripe.com');
    if (!url) return { ok: false, reason: 'stripe' };
    return { ok: true, url, sessionId: session.id };
  } catch (error) {
    console.error(`stripe paid report checkout failed code=${stripeErrorCode(error)}`);
    return { ok: false, reason: 'stripe' };
  }
}

export async function cancelStripeSubscription(subscriptionId) {
  if (!subscriptionId) return { ok: true, skipped: true };
  if (!validSubscriptionId(subscriptionId)) return { ok: false, reason: 'invalid' };
  const stripe = getStripe();
  if (!stripe) return { ok: false, reason: 'unconfigured' };
  try {
    await stripe.subscriptions.cancel(subscriptionId);
    return { ok: true };
  } catch (error) {
    const code = error?.code || '';
    if (code === 'resource_missing') return { ok: true };
    console.error(`stripe cancel failed code=${stripeErrorCode(error)}`);
    return { ok: false, reason: 'stripe' };
  }
}

export async function customerIdFromCharge(chargeId) {
  if (!/^ch_[A-Za-z0-9]+$/.test(String(chargeId ?? ''))) return { ok: true, customerId: '' };
  const stripe = getStripe();
  if (!stripe?.charges?.retrieve) return { ok: true, customerId: '' };
  try {
    const charge = await stripe.charges.retrieve(chargeId);
    const customer = charge?.customer;
    const customerId = typeof customer === 'string' ? customer : customer?.id || '';
    return { ok: true, customerId };
  } catch (error) {
    console.error(`stripe charge lookup failed code=${stripeErrorCode(error)}`);
    return { ok: false, customerId: '' };
  }
}
