'use client';
import { track } from '@vercel/analytics';
import { trackEvent } from '../lib/analyticsEvents.js';

export default function TrackLink({ href, event, location, className, children, ...rest }) {
  return (
    <a
      href={href}
      className={className}
      {...rest}
      onClick={() => { trackEvent(track, event, { location }); }}
    >{children}</a>
  );
}
