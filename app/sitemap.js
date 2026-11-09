import { SITE } from './site.js';
export default function sitemap() {
  const d = new Date('2026-11-09');
  return ['', '/best-ai-visibility-tools', '/how-to-check-chatgpt-brand-mentions', '/why-chatgpt-recommends-competitors', '/which-sites-ai-cites-in-your-niche', '/free-ai-visibility-checker', '/ai-visibility-tracker-vs-otterly-profound-peec-semrush', '/how-to-see-which-sources-chatgpt-cites'].map((p) => ({ url: SITE + p, lastModified: d, changeFrequency: 'weekly', priority: p ? 0.8 : 1 }));
}
