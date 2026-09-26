"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import {
  School,
  LayoutDashboard,
  ClipboardList,
  FileCheck2,
  Zap,
  UserCircle,
  LogOut,
} from "lucide-react";
import { diagnosticApi } from "@/lib/diagnosticApi";

/**
 * DashboardShell — ClassPulse Zine Explainer shell.
 *
 * Desktop: sticky 260px white sidebar (brand, nav, identity card) +
 * centred 1200px content column. The page hero acts as the page header.
 * Mobile (<768px): the sidebar becomes a sticky top bar (brand row +
 * horizontally scrolling nav strip + compact identity chip).
 *
 * Presentation only: primary nav links.
 * Active link is derived from the current pathname.
 */

type NavItem = {
  href: "/" | "/assignments" | "/tests" | "/quizzes" | "/profile";
  label: string;
  icon: typeof LayoutDashboard;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/assignments", label: "Assignments", icon: ClipboardList },
  { href: "/tests", label: "Tests", icon: FileCheck2 },
  { href: "/quizzes", label: "Quizzes", icon: Zap },
  { href: "/profile", label: "Profile", icon: UserCircle },
];

/** Brand mark (icon + wordmark). Reused by the focused live-quiz strip. */
export function BrandMark() {
  return (
    <div className="cp-brand">
      <div className="cp-brand__icon font-mono font-black text-sm" aria-hidden="true">
        CP
      </div>
      <div className="min-w-0">
        <p className="cp-brand__name">
          Clase<em>Pulse</em>
        </p>
        <p className="cp-brand__tag">Student Portal</p>
      </div>
    </div>
  );
}

type DashboardShellProps = {
  /** Small sans note rendered inside the sidebar identity card (desktop). */
  footerNote?: string;
  children: ReactNode;
};

export default function DashboardShell({
  footerNote,
  children,
}: DashboardShellProps) {
  const pathname = usePathname();
  const router = useRouter();

  const isActive = (href: NavItem["href"]) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  async function handleLogout() {
    await diagnosticApi.logout();
    router.push("/login");
  }

  return (
    <div className="cp-shell dashboard-page">
      {/* Sidebar / mobile top bar */}
      <aside className="dashboard-sidebar">
        <div className="cp-sidebar__top">
          <div className="cp-sidebar__brandrow">
            <BrandMark />
            {/* Mobile-only compact identity chip with logout */}
            <div className="cp-mobile-id items-center gap-2" aria-label="Student Portal">
              <Link href="/profile" className="flex items-center gap-1">
                <span className="cp-identity__avatar" aria-hidden="true">
                  S
                </span>
                <span className="cp-mobile-id__label">Profile</span>
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="p-1 text-red-700 hover:text-red-900"
                title="Log Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>

          <nav className="cp-nav" aria-label="Primary">
            {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
              const active = isActive(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`sidebar-link${active ? " sidebar-link-active" : ""}`}
                  aria-current={active ? "page" : undefined}
                >
                  <span className="cp-nav-item__left">
                    <Icon aria-hidden="true" />
                    <span>{label}</span>
                  </span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Log Out button */}
        <div className="cp-sidebar__foot">
          <button
            type="button"
            onClick={handleLogout}
            className="ui-button ui-button-secondary w-full justify-center text-xs py-2 text-red-700 hover:bg-pink-100 hover:text-red-900"
            title="Log out of student portal"
          >
            <LogOut className="w-3.5 h-3.5" />
            Log Out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="cp-shell__right">
        <main className="cp-main">
          <div className="cp-page">{children}</div>
        </main>
      </div>
    </div>
  );
}
