// Response headers shared by next.config and the per-request CSP proxy.
// script-src is nonce + strict-dynamic. style-src keeps unsafe-inline because
// style attributes cannot use a nonce, and a nonce in style-src would disable it.

export const HSTS_VALUE = 'max-age=63072000; includeSubDomains';

const NONCE = /^[A-Za-z0-9+/_-]+={0,2}$/;

export function contentSecurityPolicy({ nonce, dev = false }) {
  if (typeof nonce !== 'string' || !NONCE.test(nonce)) throw new Error('Invalid CSP nonce');
  const scriptSrc = [
    "script-src 'self'",
    `'nonce-${nonce}'`,
    "'strict-dynamic'",
    dev ? "'unsafe-eval'" : '',
  ].filter(Boolean).join(' ');
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "img-src 'self' data: blob: https://fazier.com https://smollaunch.com https://www.aitoolfinder.com",
    "font-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    scriptSrc,
    "connect-src 'self'",
    'upgrade-insecure-requests',
  ].join('; ');
}
