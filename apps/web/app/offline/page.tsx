import type { Metadata } from 'next';
import { WifiOff } from 'lucide-react';
import { OfflineRetry } from '@/components/pwa/offline-retry';

export const metadata: Metadata = { title: 'Offline' };

/** Served by the service worker when a page can't be loaded without a connection. */
export default function OfflinePage() {
  return (
    <main id="main" className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-md border border-line-strong bg-surface p-8 text-center shadow-hard rounded-card">
        <WifiOff className="mx-auto size-8 text-muted" aria-hidden />
        <h1 className="mt-3 font-display text-2xl font-black">You’re offline</h1>
        <p className="mt-2 text-sm text-muted">ClassIQ needs an internet connection. Check your Wi-Fi or mobile data, then try again.</p>
        <div className="mt-6">
          <OfflineRetry />
        </div>
      </div>
    </main>
  );
}
