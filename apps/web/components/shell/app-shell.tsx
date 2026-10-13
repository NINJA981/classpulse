'use client';
import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { LogOut, Menu, X } from 'lucide-react';
import { ROLE_LOGIN, type MeResponse, type SessionUser } from '@classpulse/shared';
import { NoticeBanners } from '@/components/auth/platform-notice';
import { LegalLinks } from '@/components/legal/legal-links';
import { NotificationBell, NotificationsProvider } from '@/components/notifications';
import { api } from '@/lib/api';
import { SessionProvider } from '@/lib/session-context';
import { NAV, NAV_FEATURE } from './nav';

export function AppShell({ user, children }: { user: SessionUser; children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  // Platform banner/maintenance notice and the school's feature switches (refreshed every minute).
  const { data: me } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => api.get<MeResponse>('/auth/me'),
    refetchInterval: 60_000,
  });
  const nav = NAV[user.role];
  const items = nav.items.filter((item) => {
    const feature = NAV_FEATURE[item.href];
    return !feature || !me || me.features[feature];
  });

  const isActive = (href: string, exact?: boolean) => (exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`));

  async function logout() {
    await api.post('/auth/logout').catch(() => undefined);
    // Full navigation: the area layout must not survive into the sign-in page.
    window.location.assign(ROLE_LOGIN[user.role]);
  }

  const sidebar = (
    <nav aria-label="Main" className="flex h-full flex-col">
      <div className="border-b border-line px-5 py-5">
        <Link href={nav.items[0]!.href} className="font-display text-xl font-black tracking-tight">
          ClassPulse
        </Link>
        <p className="eyebrow mt-1">{nav.title}</p>
      </div>
      <ul className="flex-1 space-y-0.5 overflow-y-auto p-3">
        {items.map((item) => {
          const active = isActive(item.href, item.exact);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={() => setOpen(false)}
                aria-current={active ? 'page' : undefined}
                data-tour={`nav${item.href.replace(/\//g, '-')}`}
                className={clsx(
                  'flex items-center gap-3 px-3 py-2.5 text-sm font-bold rounded-control',
                  active ? 'bg-accent text-accent-ink' : 'text-ink-2 hover:bg-surface-2 hover:text-ink',
                )}
              >
                <Icon className="size-4 shrink-0" aria-hidden />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="border-t border-line p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold">{user.name}</p>
            <p className="truncate text-xs text-muted">{user.email ?? user.rollNumber}</p>
          </div>
          <NotificationBell onNavigate={() => setOpen(false)} />
        </div>
        <button
          type="button"
          onClick={logout}
          className="mt-3 inline-flex items-center gap-2 text-xs font-bold text-muted hover:text-ink"
        >
          <LogOut className="size-3.5" aria-hidden /> Sign out
        </button>
      </div>
    </nav>
  );

  return (
    <SessionProvider user={user}>
      <NotificationsProvider scope="school">
        <div className="min-h-dvh lg:grid lg:grid-cols-[248px_1fr]">
          <aside className="hidden border-r border-line bg-surface lg:sticky lg:top-0 lg:z-40 lg:block lg:h-dvh">{sidebar}</aside>

          <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-surface px-4 py-3 lg:hidden">
            <span className="font-display text-lg font-black">ClassPulse</span>
            <div className="flex items-center gap-1">
              <NotificationBell />
              <button type="button" onClick={() => setOpen(true)} aria-label="Open menu" data-tour="nav-menu" className="p-1.5">
                <Menu className="size-5" />
              </button>
            </div>
          </header>
          {open && (
            <div className="fixed inset-0 z-40 lg:hidden">
              <button type="button" aria-label="Close menu" className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
              <div className="absolute inset-y-0 left-0 w-72 max-w-[85%] bg-surface shadow-pop">
                <button type="button" onClick={() => setOpen(false)} aria-label="Close menu" className="absolute right-3 top-4 p-1">
                  <X className="size-5" />
                </button>
                {sidebar}
              </div>
            </div>
          )}

          {/* tabIndex -1: focus can land here programmatically (e.g. when a guided tour closes). */}
          <main id="main" tabIndex={-1} className="min-w-0 px-4 py-6 outline-none sm:px-8 sm:py-8">
            <div className="mx-auto max-w-6xl">
              <NoticeBanners notice={me?.notice} className="mb-6" />
              {children}
              <footer className="mt-12 border-t border-line pt-4">
                <LegalLinks />
              </footer>
            </div>
          </main>
        </div>
      </NotificationsProvider>
    </SessionProvider>
  );
}
