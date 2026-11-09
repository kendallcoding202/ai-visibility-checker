const utm = (c) => `utm_source=ai-visibility-checker&utm_medium=referral&utm_campaign=free-checker&utm_content=${c}`;
export const TRACKER = (c = 'cta') => `https://apify.com/crunchy_galaxy_qcr/ai-visibility-tracker?${utm(c)}`;
export const ADS = `https://apify.com/crunchy_galaxy_qcr/google-ads-transparency-scraper?${utm('footer')}`;
export const CITATION = (c = 'cta') => `https://apify.com/crunchy_galaxy_qcr/ai-citation-tracker?${utm(c)}`;
export const CITATIONS = CITATION('footer');
