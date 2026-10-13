'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { LandingClientCopy } from './types';

const LandingCopyContext = createContext<LandingClientCopy | null>(null);

/**
 * Hands the page's copy to its client components (header, rail, sample question, language wall, role tabs,
 * demo form, share button). Server components get their copy as props. Only the client part of the
 * dictionary crosses to the browser.
 */
export function LandingCopyProvider({ copy, children }: { copy: LandingClientCopy; children: ReactNode }) {
  return <LandingCopyContext.Provider value={copy}>{children}</LandingCopyContext.Provider>;
}

export function useLandingCopy(): LandingClientCopy {
  const copy = useContext(LandingCopyContext);
  if (!copy)
    throw new Error('useLandingCopy() needs a <LandingCopyProvider> (components/landing/landing-page.tsx).');
  return copy;
}
