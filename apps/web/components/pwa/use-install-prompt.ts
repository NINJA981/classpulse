'use client';
import { useCallback, useSyncExternalStore } from 'react';

/** Chrome's `beforeinstallprompt` event (not in the DOM typings). */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

/*
 * The browser fires `beforeinstallprompt` once, early in the page's life, often before the component that
 * offers an "Install app" button mounts. So the event is captured at module load and shared through a tiny
 * external store. The browser's own install UI is left alone (no preventDefault).
 */
let deferred: BeforeInstallPromptEvent | null = null;
let installedNow = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    deferred = e as BeforeInstallPromptEvent;
    emit();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    installedNow = true;
    emit();
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** True when the app is running from the home screen (installed PWA) or was just installed. */
function isInstalled(): boolean {
  if (installedNow) return true;
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return iosStandalone || window.matchMedia('(display-mode: standalone)').matches;
}

export type InstallOutcome = 'accepted' | 'dismissed' | 'unavailable';

/** Whether the browser offers a one-tap install prompt right now, and a function that shows it. */
export function useInstallPrompt() {
  const canPrompt = useSyncExternalStore(subscribe, () => deferred !== null, () => false);
  const installed = useSyncExternalStore(subscribe, isInstalled, () => false);

  const promptInstall = useCallback(async (): Promise<InstallOutcome> => {
    const event = deferred;
    if (!event) return 'unavailable';
    try {
      await event.prompt();
      const choice = await event.userChoice;
      // The event can only be used once.
      deferred = null;
      if (choice.outcome === 'accepted') installedNow = true;
      emit();
      return choice.outcome;
    } catch {
      return 'unavailable';
    }
  }, []);

  return { canPrompt, installed, promptInstall };
}
