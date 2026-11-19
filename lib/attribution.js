// First-touch channel for this browser tab.
// Stores campaign tags and the referring hostname only. Never a full URL, email, brand, or IP.

import { referrerHost } from './analyticsEvents.js';

export const CHANNEL_KEY = 'aiv_channel';

function clip(value) {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 80);
}

export function emptyChannel() {
  return { utm_source: '', utm_medium: '', utm_campaign: '', referrer_host: 'direct' };
}

/** Re-check a stored hostname. Paths, queries, and addresses become "other". */
export function storedReferrerHost(value) {
  const raw = clip(value).toLowerCase();
  if (raw === 'direct') return 'direct';
  if (!raw || /[/?:@\s]/.test(raw)) return 'other';
  return referrerHost(`https://${raw}/`);
}

export function readChannel(storage) {
  if (!storage || typeof storage.getItem !== 'function') return null;
  let raw;
  try { raw = storage.getItem(CHANNEL_KEY); } catch { return null; }
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return null;
    return {
      utm_source: clip(data.utm_source),
      utm_medium: clip(data.utm_medium),
      utm_campaign: clip(data.utm_campaign),
      referrer_host: storedReferrerHost(data.referrer_host),
    };
  } catch {
    return null;
  }
}

/** Keep the first landing. Later calls in the same tab do not replace it. */
export function captureFirstTouch({ search = '', referrer = '', storage } = {}) {
  const existing = readChannel(storage);
  if (existing) return existing;
  const params = new URLSearchParams(String(search).replace(/^\?/, ''));
  const channel = {
    utm_source: clip(params.get('utm_source')),
    utm_medium: clip(params.get('utm_medium')),
    utm_campaign: clip(params.get('utm_campaign')),
    referrer_host: referrerHost(referrer),
  };
  try { storage?.setItem?.(CHANNEL_KEY, JSON.stringify(channel)); } catch { /* private mode */ }
  return channel;
}

export function channelProps(channel) {
  const value = channel && typeof channel === 'object' ? channel : emptyChannel();
  return {
    utm_source: clip(value.utm_source),
    utm_medium: clip(value.utm_medium),
    utm_campaign: clip(value.utm_campaign),
    referrer_host: storedReferrerHost(value.referrer_host || 'direct'),
  };
}

export function browserChannel() {
  if (typeof sessionStorage === 'undefined') return emptyChannel();
  return readChannel(sessionStorage) || emptyChannel();
}
