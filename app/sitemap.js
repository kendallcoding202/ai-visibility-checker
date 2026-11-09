import { SITE } from './site.js';
export default function sitemap() {
  const d = new Date('2026-11-09');
  const pages = ['', '/best-ai-visibility-tools', '/how-to-check-chatgpt-brand-mentions', '/why-chatgpt-recommends-competitors', '/which-sites-ai-cites-in-your-niche', '/free-ai-visibility-checker', '/ai-visibility-tracker-vs-otterly-profound-peec-semrush', '/how-to-see-which-sources-chatgpt-cites'].map((p) => ({ url: SITE + p, lastModified: d, changeFrequency: 'weekly', priority: p ? 0.8 : 1 }));
  pages.push({
    url: `${SITE}/what-chatgpt-business-dashboard-wont-tell-you`,
    lastModified: new Date('2026-11-09'),
    changeFrequency: 'monthly',
    priority: 0.7,
  });
  return pages;
}
