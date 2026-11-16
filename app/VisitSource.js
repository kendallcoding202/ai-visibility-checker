'use client';
import { useEffect, useRef } from 'react';
import { track } from '@vercel/analytics';
import { EVENTS, referrerHost, trackEvent } from '../lib/analyticsEvents.js';

export default function VisitSource() {
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    const params = new URLSearchParams(window.location.search);
    trackEvent(track, EVENTS.VISIT_SOURCE, {
      utm_source: params.get('utm_source') || '',
      referrer_host: referrerHost(document.referrer),
    });
  }, []);
  return null;
}
