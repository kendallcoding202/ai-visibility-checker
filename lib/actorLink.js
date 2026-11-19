// Fixed store URL for the AI Visibility Tracker actor.
// Query values are only the three campaign placements. No brand, email, or visitor URL.

export const ACTOR_ORIGIN = 'https://apify.com';
export const ACTOR_PATH = '/crunchy_galaxy_qcr/ai-visibility-tracker';
export const ACTOR_URL = `${ACTOR_ORIGIN}${ACTOR_PATH}`;

const CAMPAIGNS = new Set(['result', 'home', 'footer']);

export function actorTrackingUrl(campaign) {
  const utmCampaign = CAMPAIGNS.has(campaign) ? campaign : 'home';
  const url = new URL(ACTOR_URL);
  url.searchParams.set('utm_source', 'aivisibilitychecker');
  url.searchParams.set('utm_medium', 'referral');
  url.searchParams.set('utm_campaign', utmCampaign);
  if (url.origin !== ACTOR_ORIGIN || url.pathname !== ACTOR_PATH) return ACTOR_URL;
  return url.toString();
}
