// Paths that render the brand form. The header link stays on the page there.

export const INLINE_CHECK_PATHS = [
  '/',
  '/free-ai-visibility-checker',
  '/why-chatgpt-recommends-competitors',
  '/which-sites-ai-cites-in-your-niche',
  '/ai-visibility-tracker-vs-otterly-profound-peec-semrush',
  '/business-hub-vs-ai-visibility-tracker',
  '/best-ai-visibility-tools',
  '/how-to-check-chatgpt-brand-mentions',
  '/how-to-see-which-sources-chatgpt-cites',
  '/what-chatgpt-business-dashboard-wont-tell-you',
  '/profound-alternatives',
  '/business-hub-vs-free-ai-visibility-checker',
  '/ai-visibility-tracker-vs-keyword',
  '/otterly-alternatives',
  '/ai-visibility-for-saas',
  '/how-to-check-if-chatgpt-mentions-your-brand',
];

const WITH_FORM = new Set(INLINE_CHECK_PATHS);

export function checkBrandHref(pathname) {
  const raw = String(pathname ?? '/').split('?')[0].split('#')[0];
  const path = raw.length > 1 && raw.endsWith('/') ? raw.slice(0, -1) : (raw || '/');
  return WITH_FORM.has(path) ? '#checker' : '/#checker';
}
