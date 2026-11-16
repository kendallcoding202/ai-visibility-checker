'use client';
import { Analytics } from '@vercel/analytics/next';

export default function AnalyticsWrapper() {
  return (
    <Analytics beforeSend={(event) => {
      // Don't track 404 pages to avoid bot inflation
      if (typeof document !== 'undefined' && document.querySelector('[data-not-found]')) {
        return null;
      }
      return event;
    }} />
  );
}
