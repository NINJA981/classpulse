'use client';
import { useEffect } from 'react';

/** Registers the service worker (public/sw.js) in production builds only, so dev never serves stale pages. */
export function RegisterServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).catch(() => undefined);
  }, []);
  return null;
}
