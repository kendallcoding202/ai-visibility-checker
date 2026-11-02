import { SITE } from './site.js';
const bots = ['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'PerplexityBot', 'Bingbot', 'Googlebot'];
export default function robots() {
  return { rules: [...bots.map((userAgent) => ({ userAgent, allow: '/', disallow: '/api/' })), { userAgent: '*', allow: '/', disallow: '/api/' }], sitemap: `${SITE}/sitemap.xml` };
}
