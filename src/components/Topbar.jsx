'use client';

import React from 'react';
import { useClassPulse } from '../context/ClassPulseContext';

/**
 * Shared app shell: sticky white topbar with brand mark, text-only nav links and profile.
 * Replaces the former left <Sidebar/> + <Header/> pair. Presentation only —
 * nav ids, setActiveTab and logout are unchanged.
 */
export const Topbar = () => {
  const { activeTab, setActiveTab, userRole, currentUser, logout } = useClassPulse();
  const isAdmin = userRole === 'admin';

  const adminNavItems = [
    { id: 'management', label: 'Admin Control Center', badge: 'CORE' },
    { id: 'analytics', label: 'Classroom Analytics' }
  ];

  const teacherNavItems = [
    { id: 'teacher-dash', label: 'Teacher Dashboard', badge: 'MY CLASS' },
    { id: 'management', label: 'Class & Timetables' },
    { id: 'quiz', label: 'AI Quiz Workbench' },
    { id: 'projector', label: 'Projector Kiosk' }
  ];

  const studentNavItems = [
    { id: 'student-dash', label: 'Student Portal', badge: 'TIMETABLE' },
    { id: 'projector', label: 'Live Quiz Screen' }
  ];

  const navItems = isAdmin ? adminNavItems : userRole === 'teacher' ? teacherNavItems : studentNavItems;

  return (
    <header className="cp-topbar select-none">
      {/* Brand block */}
      <div className="cp-brand-area">
        <div className="cp-brand-mark" aria-hidden="true">CP</div>
        <div>
          <div className="cp-brand">
            ClassPulse Hub
          </div>
          <div className="cp-brand-subtitle">
            {isAdmin ? 'EXECUTIVE ADMIN' : 'SMART SYSTEM'}
            <span className="hidden sm:inline"> · {isAdmin ? 'Executive v2.5' : 'System Edition'}</span>
          </div>
        </div>
      </div>

      {/* Navigation — text-only links per the editorial system */}
      <nav className="cp-nav" aria-label="Primary">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`cp-nav-link ${isActive ? 'is-active' : ''}`}
              aria-current={isActive ? 'page' : undefined}
            >
              <span>{item.label}</span>
              {item.badge && <span className="cp-nav-badge">{item.badge}</span>}
            </button>
          );
        })}
      </nav>

      {/* Profile + status + logout */}
      <div className="cp-profile">
        <span className="cp-live hidden sm:inline-flex items-center gap-2">
          <span className="cp-dot is-live" />
          {userRole === 'admin' && '🔐 ADMIN CONTROL (PORT 5173)'}
          {userRole === 'teacher' && '👨‍🏫 TEACHER WORKBENCH'}
          {userRole === 'student' && '🎓 STUDENT PORTAL'}
        </span>
        <div className="cp-avatar" aria-hidden="true">
          {currentUser?.name ? currentUser.name[0] : 'A'}
        </div>
        <div className="cp-profile-info">
          <strong>{currentUser?.name || 'Administrator'}</strong>
          <span>{userRole}</span>
        </div>
        <button
          type="button"
          onClick={logout}
          className="cp-icon-btn"
          title="Switch Role / Logout"
          aria-label="Switch Role / Logout"
        >
          <span aria-hidden="true">→</span>
        </button>
      </div>
    </header>
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
