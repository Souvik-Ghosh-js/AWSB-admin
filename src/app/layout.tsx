import type { Metadata, Viewport } from 'next';
import { Cormorant_Garamond, Inter } from 'next/font/google';

import '@/styles/globals.css';

/**
 * Root layout for the admin panel.
 *
 * The storefront's fonts and tokens are kept so the two surfaces feel like one
 * house, but there is no Header or Footer here: this app has no customer-facing
 * chrome, no navigation to the shop, and no marketing metadata.
 */
const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  variable: '--font-cormorant',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Admin · Attar World Sonar Bangla',
    template: '%s · Admin',
  },
  description: 'Staff only.',
  // Belt and braces alongside the X-Robots-Tag header in next.config.ts.
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false },
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#14432A',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${cormorant.variable} ${inter.variable}`}>
      <body>{children}</body>
    </html>
  );
}
