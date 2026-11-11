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

// AI Visibility Tracker, Apify Free tier. Updated 2026-11-11:
// $0.0375 per answer. Bronze $0.034, Silver $0.03, Gold and up $0.028. No subscription.
export const tracker = {
  pricePerAnswer: 0.0375,
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

// Cheapest AI Visibility monthly plan on https://keyword.com/pricing/, read 2026-11-10.
// Package list: billing_cycle monthly, price 9.80, 100 credits. The page shows $9.80/month.
// Search Visibility is $4/month but it is rank tracking, not AI answer tracking.
// Annual AI Visibility is $94/year. $57 is the 1,000-credit monthly tier, not the start.
export const keyword = {
  name: 'Keyword.com',
  plan: 'AI Visibility',
  monthlyPrice: 9.8,
  currency: 'USD',
  source: 'https://keyword.com/pricing/',
};
