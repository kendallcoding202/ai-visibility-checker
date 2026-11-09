// Pure builders for the Apify inputs the result page hands over. No user data goes into any URL:
// the brand, competitors and prompts stay in the clipboard JSON only.
export const VIS_PRICE = 0.04; // AI Visibility Tracker, free-tier price per answer
export const CIT_PRICE = 0.05; // AI Citation Tracker, free-tier price per answer
// Visibility engines are the checker's existing set (all valid on that actor).
export const VIS_ENGINES = ['chatgpt-search', 'gemini-knowledge', 'perplexity-search'];
// Citation actor default. Google AI Overviews and AI Mode are opt-in, so they are not included.
export const CIT_ENGINES = ['chatgpt', 'perplexity'];

export function trackerInput(d) {
  const comps = [...new Set([...(d.competitorHits ?? []).map((c) => c.name), ...(d.topBrands ?? []).map((b) => b.name)])].slice(0, 5);
  return {
    brand: d.brand, competitors: comps, prompts: (d.rows ?? []).map((r) => r.prompt), category: d.category,
    engines: VIS_ENGINES, samplesPerPrompt: 1,
    trackingName: `${d.brand}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-weekly',
  };
}

export function citationInput(d) {
  return { prompts: (d.rows ?? []).map((r) => r.prompt), yourDomains: [], engines: CIT_ENGINES, samplesPerPrompt: 1 };
}

export const runCost = (input, price) => +(input.prompts.length * input.engines.length * (input.samplesPerPrompt ?? 1) * price).toFixed(2);
