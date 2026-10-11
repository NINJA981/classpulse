'use client';
import { createContext, useContext, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import {
  Activity,
  BarChart3,
  Building2,
  LayoutDashboard,
  LogOut,
  Menu,
  Rocket,
  ScrollText,
  Search,
  Settings,
  ShieldCheck,
  X,
  type LucideIcon,
} from 'lucide-react';
import type { PlatformAdmin } from '@classpulse/shared';
import { api } from '@/lib/api';

interface PlatformNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
}

export const PLATFORM_NAV: PlatformNavItem[] = [
  { href: '/platform', label: 'Overview', icon: LayoutDashboard, exact: true },
  { href: '/platform/schools', label: 'Schools', icon: Building2 },
  { href: '/platform/users', label: 'Users', icon: Search },
  { href: '/platform/health', label: 'Health', icon: Activity },
  { href: '/platform/logs', label: 'Logs', icon: ScrollText },
  { href: '/platform/audit', label: 'Audit log', icon: ShieldCheck },
  { href: '/platform/usage', label: 'Usage & costs', icon: BarChart3 },
  { href: '/platform/deployments', label: 'Deployments', icon: Rocket },
  { href: '/platform/settings', label: 'Settings', icon: Settings },
];

const PlatformAdminContext = createContext<PlatformAdmin | null>(null);

/** The signed-in platform admin (inside the /platform console). */
export function usePlatformAdmin(): PlatformAdmin {
  const admin = useContext(PlatformAdminContext);
  if (!admin) throw new Error('usePlatformAdmin must be used inside the platform console');
  return admin;
}

export function PlatformShell({ admin, children }: { admin: PlatformAdmin; children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isActive = (href: string, exact?: boolean) => (exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`));

  async function logout() {
    await api.post('/platform/auth/logout').catch(() => undefined);
    window.location.assign('/platform/login');
  }

  const sidebar = (
    <nav aria-label="Platform" className="flex h-full flex-col">
      <div className="border-b border-line px-5 py-5">
        <Link href="/platform" className="font-display text-xl font-black tracking-tight">
          ClassPulse
        </Link>
        <p className="eyebrow mt-1">Platform console</p>
      </div>
      <ul className="flex-1 space-y-0.5 overflow-y-auto p-3">
        {PLATFORM_NAV.map((item) => {
          const active = isActive(item.href, item.exact);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={() => setOpen(false)}
                aria-current={active ? 'page' : undefined}
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
        <p className="truncate text-sm font-bold">{admin.name}</p>
        <p className="truncate text-xs text-muted">{admin.email}</p>
        <button type="button" onClick={logout} className="mt-3 inline-flex items-center gap-2 text-xs font-bold text-muted hover:text-ink">
          <LogOut className="size-3.5" aria-hidden /> Sign out
        </button>
      </div>
    </nav>
  );

  return (
    <PlatformAdminContext.Provider value={admin}>
      <div className="min-h-dvh lg:grid lg:grid-cols-[248px_1fr]">
        <aside className="hidden border-r border-line bg-surface lg:sticky lg:top-0 lg:block lg:h-dvh">{sidebar}</aside>

        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-surface px-4 py-3 lg:hidden">
          <span className="font-display text-lg font-black">ClassPulse platform</span>
          <button type="button" onClick={() => setOpen(true)} aria-label="Open menu" className="p-1.5">
            <Menu className="size-5" />
          </button>
        </header>
        {open && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <button type="button" aria-label="Close menu" className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
            <div className="absolute inset-y-0 left-0 w-72 max-w-[85%] bg-surface shadow-pop">
              <button type="button" onClick={() => setOpen(false)} aria-label="Close menu" className="absolute right-3 top-4 p-1">
                <X className="size-5" />
              </button>
              {sidebar}
            </div>
          </div>
        )}

        <main id="main" className="min-w-0 px-4 py-6 sm:px-8 sm:py-8">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>
    </PlatformAdminContext.Provider>
  );
}
