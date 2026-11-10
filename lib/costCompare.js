// Starting prices for the homepage cost comparison.
// Update a number only after reading its source URL, then set COST_AS_OF to that day.
// Competitor rows are monthly starting prices only. No per-check or per-credit math.

export const COST_AS_OF = '2026-11-10';
export const COST_AS_OF_LABEL = 'Nov 10 2026';

// This site. Default cap is 3 checks per IP per day.
export const freeChecker = {
  price: 0,
  checksPerIpPerDay: 3,
};

// AI Visibility Tracker, Apify Free plan. Verified on the actor page 2026-11-10:
// "$0.04 per AI answer (FREE tier)." No subscription.
export const tracker = {
  pricePerAnswer: 0.04,
  currency: 'USD',
  source: 'https://apify.com/crunchy_galaxy_qcr/ai-visibility-tracker',
};

// Cheapest paid monthly plan on https://otterly.ai/pricing, read 2026-11-10.
// Plan data: Lite price 29. The page says USD and EUR use the same number.
// Premium is $489 and is not the starting price.
export const otterly = {
  name: 'Otterly.AI',
  plan: 'Lite',
  monthlyPrice: 29,
  currency: 'USD',
  source: 'https://otterly.ai/pricing',
};

// Cheapest paid monthly plan on https://keyword.com/pricing/, read 2026-11-10.
// Search Visibility is $4/month. AI Visibility starts at $9.80/month.
// The $57 figure is the 1,000-credit tier, not the starting price.
// Annual Search Visibility is shown as $3/month ($36/year); $4 is the monthly plan.
export const keyword = {
  name: 'Keyword.com',
  plan: 'Search Visibility',
  monthlyPrice: 4,
  currency: 'USD',
  source: 'https://keyword.com/pricing/',
};
