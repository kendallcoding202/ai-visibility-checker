import './globals.css';
const title = 'Free AI Visibility Checker: Does ChatGPT Recommend Your Brand?';
const description = 'Free AI search visibility check. See if ChatGPT mentions your brand for buyer questions in your category, your rank, which competitors show up and which sources AI cites. Instant GEO / AEO / LLM SEO score.';
export const metadata = {
  metadataBase: new URL(process.env.SITE_URL || 'https://aivisibilitychecker.app'),
  title, description,
  keywords: ['AI visibility checker', 'ChatGPT brand mentions', 'AI search visibility', 'generative engine optimization', 'GEO', 'AEO', 'LLM SEO', 'does ChatGPT recommend my brand'],
  authors: [{ name: 'Kendall Sorenson' }],
  openGraph: { title, description, type: 'website', siteName: 'AI Visibility Checker' },
  twitter: { card: 'summary_large_image', title, description },
  alternates: { canonical: '/' },
};
export const viewport = { width: 'device-width', initialScale: 1, themeColor: '#0b1020' };
export default function RootLayout({ children }) {
  return <html lang="en"><body>{children}</body></html>;
}
