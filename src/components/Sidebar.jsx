'use client';

import React, { useState } from 'react';
import { useClassPulse } from '../context/ClassPulseContext';

/**
 * Editorial Brutalist / Swiss Monochrome Sidebar.
 * Pinned navigation shell for ClassPulse Admin & Hub.
 */
export const Sidebar = () => {
  const { activeTab, setActiveTab, userRole, currentUser, logout } = useClassPulse();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const isAdmin = userRole === 'admin';

  const adminNavItems = [
    { id: 'management', label: 'Admin Control Center', icon: '⚡' },
    { id: 'onboarding', label: 'Onboarding & Setup', icon: '🏛️' },
    { id: 'analytics', label: 'Classroom Analytics', icon: '📊' }
  ];

  const teacherNavItems = [
    { id: 'teacher-dash', label: 'Teacher Dashboard', badge: 'MY CLASS', icon: '📋' },
    { id: 'management', label: 'Class & Timetables', icon: '📅' },
    { id: 'quiz', label: 'AI Quiz Workbench', icon: '🧠' },
    { id: 'projector', label: 'Projector Kiosk', icon: '📺' }
  ];

  const studentNavItems = [
    { id: 'student-dash', label: 'Student Portal', badge: 'TIMETABLE', icon: '🎓' },
    { id: 'projector', label: 'Live Quiz Screen', icon: '📺' }
  ];

  const navItems = isAdmin ? adminNavItems : userRole === 'teacher' ? teacherNavItems : studentNavItems;

  const handleNavClick = (id) => {
    setActiveTab(id);
    setIsMobileOpen(false);
  };

  return (
    <>
      {/* Mobile Top Strip (Only visible on viewport < 1024px) */}
      <header className="cp-mobile-header select-none">
        <div className="flex items-center gap-3">
          <div className="cp-brand-mark" aria-hidden="true">CP</div>
          <div>
            <div className="cp-brand text-xs">ClassPulse Hub</div>
            <div className="cp-brand-subtitle text-[8px]">{isAdmin ? 'EXECUTIVE ADMIN' : 'SMART SYSTEM'}</div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsMobileOpen(!isMobileOpen)}
          className="cp-btn is-secondary text-xs px-3 py-1.5"
          aria-label={isMobileOpen ? 'Close Navigation Menu' : 'Open Navigation Menu'}
        >
          {isMobileOpen ? '✕ CLOSE' : '≡ MENU'}
        </button>
      </header>

      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          className="cp-sidebar-backdrop"
          onClick={() => setIsMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Main Sidebar */}
      <aside className={`cp-sidebar select-none ${isMobileOpen ? 'is-open' : ''}`} aria-label="Sidebar Navigation">
        {/* Top Section: Brand & Session Status */}
        <div className="space-y-6">
          <div className="cp-brand-area">
            <div className="cp-brand-mark" aria-hidden="true">CP</div>
            <div>
              <div className="cp-brand">
                Class<span>Pulse</span>
              </div>
              <div className="cp-brand-subtitle">
                {isAdmin ? 'EXECUTIVE ADMIN' : 'SMART SYSTEM'} · v2.5
              </div>
            </div>
          </div>

          {/* Role Status Tag */}
          <div className="cp-status-pill">
            <span className="cp-dot is-live" aria-hidden="true" />
            <span className="text-[10px] font-black uppercase tracking-wider text-ink">
              {isAdmin && '🔐 ADMIN CONTROL'}
              {userRole === 'teacher' && '👨‍🏫 TEACHER WORKBENCH'}
              {userRole === 'student' && '🎓 STUDENT PORTAL'}
            </span>
          </div>

          {/* Navigation Items */}
          <div className="space-y-2 pt-2">
            <div className="cp-eyebrow px-1 pb-1">
              SYSTEM WORKBENCH
            </div>
            <nav className="cp-sidebar-nav" aria-label="Primary">
              {navItems.map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleNavClick(item.id)}
                    className={`cp-sidebar-link ${isActive ? 'is-active' : ''}`}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <span className="flex items-center gap-2.5">
                      <span className="text-xs opacity-75" aria-hidden="true">{item.icon}</span>
                      <span>{item.label}</span>
                    </span>
                    {item.badge && <span className="cp-nav-badge">{item.badge}</span>}
                    {isActive && !item.badge && <span className="text-[10px]" aria-hidden="true">▪</span>}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Bottom Section: Telemetry & Profile & Logout */}
        <div className="space-y-4 pt-6 border-t border-line-soft">
          {/* Quick System Telemetry Box */}
          <div className="cp-sidebar-meta">
            <div className="flex justify-between items-center text-[9px] font-mono uppercase tracking-wider text-muted">
              <span>PORT</span>
              <span className="font-bold text-ink">5171</span>
            </div>
            <div className="flex justify-between items-center text-[9px] font-mono uppercase tracking-wider text-muted mt-1">
              <span>STATUS</span>
              <span className="font-bold text-ink flex items-center gap-1">
                <span className="inline-block w-1.5 h-1.5 bg-ink" /> ONLINE
              </span>
            </div>
          </div>

          {/* User Profile Card */}
          <div className="flex items-center gap-3 p-2 bg-surface-sunken border border-line-soft">
            <div className="cp-avatar" aria-hidden="true">
              {currentUser?.name ? currentUser.name[0] : 'A'}
            </div>
            <div className="min-w-0 flex-1">
              <strong className="block text-[11px] font-bold text-ink truncate">
                {currentUser?.name || 'Administrator'}
              </strong>
              <span className="block text-[9px] uppercase tracking-wider text-muted truncate">
                {userRole || 'admin'}
              </span>
            </div>
          </div>

          {/* Logout Action */}
          <button
            type="button"
            onClick={logout}
            className="cp-sidebar-logout"
            title="Switch Role / Logout"
          >
            <span>SIGN OUT / SWITCH</span>
            <span aria-hidden="true">→</span>
          </button>
        </div>
      </aside>
    </>
  );
};

/**
 * Shared footer band: 1px top rule, brand mark, role copy.
 */
export const AppFooter = () => {
  const { userRole } = useClassPulse();
  const isAdmin = userRole === 'admin';

  return (
    <footer className="cp-footer">
      <div className="cp-footer-brand">
        <div className="cp-footer-mark" aria-hidden="true">CP</div>
        <div>
          <strong>{isAdmin ? 'Executive System' : 'ClassPulse v2.5'}</strong>
          <p>
            {isAdmin
              ? 'ClassPulse Executive Administration & Telemetry System.'
              : 'ClassPulse Administration System & Learning Workbench.'}
          </p>
        </div>
      </div>
      <div className="cp-footer-brand">
        <div>
          <span className="cp-eyebrow is-tight">Active Mode:</span>
          <strong>
            {userRole === 'admin' && '🔐 System Administrator'}
            {userRole === 'teacher' && '👨‍🏫 Classroom Teacher'}
            {userRole === 'student' && '🎓 Enrolled Student'}
          </strong>
          <p>Smart Classroom Administration & Telemetry System</p>
        </div>
      </div>
    </footer>
  );
};
