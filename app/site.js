export const SITE = 'https://aivisibilitychecker.app';
export const ONE_LINER = 'Free AI visibility checker that shows in about 30 seconds whether ChatGPT recommends your brand, where you rank and which competitors it picks instead.';
export const AUTHOR = 'Kendall Sorenson';
export const orgLd = { '@context': 'https://schema.org', '@type': 'Organization', name: 'AI Visibility Checker', url: SITE, founder: { '@type': 'Person', name: AUTHOR }, description: ONE_LINER,
  sameAs: ['https://apify.com/crunchy_galaxy_qcr/ai-visibility-tracker', 'https://apify.com/crunchy_galaxy_qcr/ai-citation-tracker', 'https://apify.com/crunchy_galaxy_qcr/google-ads-transparency-scraper', 'https://github.com/kendallcoding202/ai-visibility-checker'] };
export const appLd = { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'AI Visibility Checker', url: SITE, applicationCategory: 'BusinessApplication', operatingSystem: 'Web', description: ONE_LINER,
  author: { '@type': 'Person', name: AUTHOR }, offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } };
export const Ld = ({ data }) => <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />;
export const faqLd = (faq) => ({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) });
