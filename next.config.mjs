/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV === 'development';

// Honest CSP for this App Router site: Next and JSON-LD use inline scripts/styles,
// so script-src/style-src allow 'unsafe-inline'. No unsafe-eval in production.
// Analytics is first-party under /36aba5b8f51546bc/* and /_vercel/insights/* (covered by 'self').
// The Fazier launch badge is the only third-party image.
const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "img-src 'self' data: blob: https://fazier.com",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "connect-src 'self'",
  'upgrade-insecure-requests',
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
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
