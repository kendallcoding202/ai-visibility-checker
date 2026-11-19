'use client';
import { track } from '@vercel/analytics';
import { EVENTS, trackEvent } from '../lib/analyticsEvents.js';
import { actorTrackingUrl } from '../lib/actorLink.js';
import { browserChannel, channelProps } from '../lib/attribution.js';

const LOCATION = { result: 'result-top', home: 'explainer', footer: 'footer' };

export default function ApifyActorLink({ campaign }) {
  const href = actorTrackingUrl(campaign);
  const location = LOCATION[campaign] || 'explainer';
  return (
    <p>
      For repeat tracking across ChatGPT, Perplexity and Gemini on a schedule, try the{' '}
      <a
        href={href}
        target="_blank"
        rel="noopener"
        onClick={() => {
          trackEvent(track, EVENTS.TRACKER_CTA_CLICK, {
            location,
            ...channelProps(browserChannel()),
          });
        }}
      >AI Visibility Tracker on Apify</a>
      , pay per answer.
    </p>
  );
}
