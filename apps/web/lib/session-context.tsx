'use client';
import { createContext, useContext, type ReactNode } from 'react';
import type { SessionUser } from '@classiq/shared';

const SessionContext = createContext<SessionUser | null>(null);

/** Provided by each area layout after the server-side role check. */
export function SessionProvider({ user, children }: { user: SessionUser; children: ReactNode }) {
  return <SessionContext.Provider value={user}>{children}</SessionContext.Provider>;
}

export function useSessionUser(): SessionUser {
  const user = useContext(SessionContext);
  if (!user) throw new Error('useSessionUser must be used inside an authenticated area');
  return user;
}
