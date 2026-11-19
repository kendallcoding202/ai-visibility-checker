'use client';
import { useEffect, useRef } from 'react';
import { track } from '@vercel/analytics';
import { EVENTS, trackEvent } from '../lib/analyticsEvents.js';
import { captureFirstTouch, channelProps } from '../lib/attribution.js';

export default function VisitSource() {
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    const channel = captureFirstTouch({
      search: window.location.search,
      referrer: document.referrer,
      storage: window.sessionStorage,
    });
    trackEvent(track, EVENTS.VISIT_SOURCE, channelProps(channel));
  }, []);
  return null;
}
