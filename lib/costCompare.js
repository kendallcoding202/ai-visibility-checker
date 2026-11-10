// Public prices for the homepage cost comparison.
// Update the numbers only after reading each source URL, then set COST_AS_OF to that day.
// Derived figures are calculated in code from these inputs. Do not paste a per-check price here.

export const COST_AS_OF = '2026-11-10';

// This site. One check asks ChatGPT the three questions in buildPrompts.
export const freeChecker = {
  price: 0,
  checksPerIpPerDay: 3,
  questionsPerCheck: 3,
};

// AI Visibility Tracker, Apify Free plan. Verified on the actor page 2026-11-10:
// "$0.04 per AI answer (FREE tier). One answer = one prompt × one engine × one sample."
// The store header also says "from $28.00 / 1,000" answers, which is the discounted price
// on higher Apify plans, not the no-subscription price.
export const tracker = {
  pricePerAnswer: 0.04,
  currency: 'USD',
  source: 'https://apify.com/crunchy_galaxy_qcr/ai-visibility-tracker',
  storeFromPrice: 28,
  storeFromAnswers: 1000,
};

// Otterly.AI Premium, read from https://otterly.ai/pricing on 2026-11-10.
// The page's plan data is price 489, 403 prompts, 50,000 credits, and it says USD and EUR
// use the same number. FAQ: one credit is one prompt checked once on one engine; a prompt
// tracked daily on one engine uses 31 credits a month; Claude counts as 3 credits.
// The plan card says 4 of 7 engines. A reported "$0.91 per tracked prompt" was not on the page.
export const otterlyPremium = {
  name: 'Otterly.AI Premium',
  price: 489,
  currency: 'USD',
  prompts: 403,
  credits: 50000,
  dailyCreditsPerEngine: 31,
  enginesOnCard: 4,
  claudeCredits: 3,
  source: 'https://otterly.ai/pricing',
};

// Keyword.com AI Visibility, read from https://keyword.com/pricing/ on 2026-11-10.
// The monthly 1,000-credit tier in the page's package list is $57. The credit calculator
// on that page prices a ChatGPT chat-app run at 0.25 credits. API-model runs cost more.
// A reported "1,000 ChatGPT checks for $15" was not on the page.
export const keywordCredits = {
  name: 'Keyword.com AI Visibility',
  price: 57,
  credits: 1000,
  billing: 'monthly',
  chatgptCreditsPerRun: 0.25,
  source: 'https://keyword.com/pricing/',
};

export const per = (price, units) => price / units;

/** Whole cents use two places ($0.04, $1.21). Smaller amounts use four ($0.0098, $0.0143). */
export function usd(amount) {
  const cents = amount * 100;
  const digits = amount >= 1 || Math.abs(cents - Math.round(cents)) < 1e-8 ? 2 : 4;
  const p = 10 ** digits;
  return `$${(Math.round(amount * p) / p).toFixed(digits)}`;
}
