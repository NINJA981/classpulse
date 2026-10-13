'use client';
import { useEffect } from 'react';

/**
 * Registers the service worker (public/sw.js) in production builds only, so dev never serves stale pages.
 * Set NEXT_PUBLIC_SW_DEV=1 to register it in development too (to try Web Push locally).
 */
export function RegisterServiceWorker() {
  useEffect(() => {
    const enabled = process.env.NODE_ENV === 'production' || process.env.NEXT_PUBLIC_SW_DEV === '1';
    if (!enabled || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).catch(() => undefined);
  }, []);
  return null;
}
