import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono, Outfit, Plus_Jakarta_Sans } from 'next/font/google';
import { RegisterServiceWorker } from '@/components/pwa/register-sw';
import { Providers } from './providers';
import './globals.css';

const inter = Inter({ variable: '--font-inter', subsets: ['latin'], display: 'swap' });
const jakarta = Plus_Jakarta_Sans({ variable: '--font-jakarta', subsets: ['latin'], display: 'swap' });
const outfit = Outfit({ variable: '--font-outfit', subsets: ['latin'], display: 'swap' });
const mono = JetBrains_Mono({ variable: '--font-mono-jb', subsets: ['latin'], display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'ClassIQ', template: '%s · ClassIQ' },
  description: 'AI-assisted lectures, quizzes and live classroom engagement.',
  applicationName: 'ClassIQ',
  appleWebApp: { capable: true, title: 'ClassIQ', statusBarStyle: 'default' },
  icons: {
    icon: [
      { url: '/icons/icon.svg', type: 'image/svg+xml' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180' }],
  },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#111111' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jakarta.variable} ${outfit.variable} ${mono.variable} antialiased`}>
      <body className="min-h-dvh">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[100] focus:bg-surface focus:p-2">
          Skip to content
        </a>
        <Providers>{children}</Providers>
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
