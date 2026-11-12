import { Geist, Instrument_Serif } from 'next/font/google';
import { SITE } from './site.js';
import './globals.css';
import { Analytics } from '@vercel/analytics/next';
import VisitSource from './VisitSource.js';
import SiteHeader from './SiteHeader.js';

const sans = Geist({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
  adjustFontFallback: true,
});

const serif = Instrument_Serif({
  weight: '400',
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-serif',
  adjustFontFallback: true,
});

const title = 'Free AI Visibility Checker: Does ChatGPT Recommend Your Brand?';
const description = 'Free AI search visibility check. See if ChatGPT mentions your brand for buyer questions in your category, your rank, which competitors show up and which sources AI cites. Instant GEO / AEO / LLM SEO score.';
export const metadata = {
  metadataBase: new URL(SITE),
  title, description,
  keywords: ['AI visibility checker', 'ChatGPT brand mentions', 'AI search visibility', 'generative engine optimization', 'GEO', 'AEO', 'LLM SEO', 'does ChatGPT recommend my brand'],
  authors: [{ name: 'Kendall Sorenson' }],
  openGraph: { title, description, type: 'website', siteName: 'AI Visibility Checker' },
  twitter: { card: 'summary_large_image', title, description },
  alternates: { canonical: '/' },
  icons: {
    icon: [{ url: '/favicon.ico', type: 'image/x-icon' }],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180' }],
  },
};
export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f3f0e8' },
    { media: '(prefers-color-scheme: dark)', color: '#101412' },
  ],
};
export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable}`}>
      <body className={sans.className}>
        <a className="skip" href="#content">Skip to content</a>
        <SiteHeader />
        <div id="content">{children}</div>
        <Analytics />
        <VisitSource />
      </body>
    </html>
  );
}
