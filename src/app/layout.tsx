import type { Metadata, Viewport } from 'next';
import { Fraunces, Inter } from 'next/font/google';

import { Shell } from '@/components/Shell';
import '@/styles/globals.css';

const fraunces = Fraunces({
  subsets: ['latin'],
  axes: ['opsz'],
  variable: '--font-fraunces',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: { default: 'Admin · Attar World', template: '%s · Admin' },
  description: 'Staff only.',
  robots: { index: false, follow: false, nocache: true },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // No maximumScale: pinch-zoom must stay available. Disabling it to stop
  // iOS focus-zoom would break the page for anyone who needs to magnify;
  // the 16px input font in globals.css solves that properly instead.
  themeColor: '#12132f',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable}`}>
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
