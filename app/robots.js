import { SITE } from './site.js';
const bots = ['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'PerplexityBot', 'Bingbot', 'Googlebot'];
const hidden = ['/api/', '/paid-report'];
export default function robots() {
  return { rules: [...bots.map((userAgent) => ({ userAgent, allow: '/', disallow: hidden })), { userAgent: '*', allow: '/', disallow: hidden }], sitemap: `${SITE}/sitemap.xml` };
}
