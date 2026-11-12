// Stripe calls for monthly tracking. The secret key stays in the environment.
// Failures log a Stripe error type or code only, never the key, the email, or the payload.
import Stripe from 'stripe';
import { randomBytes } from 'node:crypto';

const API_VERSION = '2026-09-30.endive';
const PRICE_ID = /^price_[A-Za-z0-9]+$/;
const CUSTOMER_ID = /^cus_[A-Za-z0-9]+$/;
const SUBSCRIPTION_ID = /^sub_[A-Za-z0-9]+$/;

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
  try {
    const session = await stripe.checkout.sessions.create(params);
    const url = safeStripeUrl(session?.url, 'checkout.stripe.com');
    if (!url) return { ok: false, reason: 'stripe' };
    return { ok: true, url };
  } catch (error) {
    console.error(`stripe checkout failed code=${stripeErrorCode(error)}`);
    return { ok: false, reason: 'stripe' };
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
