import { HSTS_VALUE } from './lib/securityHeaders.js';

// CSP is set per request in proxy.js so script-src can carry a nonce.
// style-src stays here only as part of that policy (unsafe-inline remains).
const securityHeaders = [
  { key: 'Strict-Transport-Security', value: HSTS_VALUE },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), browsing-topics=(), interest-cohort=(), payment=(), usb=(), bluetooth=(), midi=(), magnetometer=(), gyroscope=(), accelerometer=()',
  },
];

const nextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
