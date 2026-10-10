'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { getAuthTeacher, logoutTeacher, TeacherProfile } from '../lib/auth';
import {
  LayoutDashboard,
  PlusCircle,
  History,
  Calendar,
  BookOpen,
  Radio,
  MessageSquare,
  Zap,
  LogOut,
  LogIn,
  Menu,
  X
} from 'lucide-react';

export default function HeaderNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [teacher, setTeacher] = useState<TeacherProfile | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setTeacher(getAuthTeacher());
  }, [pathname]);

  const handleLogout = () => {
    logoutTeacher();
    setTeacher(null);
    router.push('/login');
  };

  const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/lessons/new', label: 'New Lesson', icon: PlusCircle },
    { href: '/previous-classes', label: 'Previous Classes', icon: History },
    { href: '/timetable', label: 'Timetable', icon: Calendar },
    { href: '/notes-syllabus', label: 'Notes & Syllabus', icon: BookOpen },
    { href: '/record-transcribe', label: 'Record & Transcribe', icon: Radio },
    { href: '/live-qa', label: 'Live Q&A', icon: MessageSquare },
    { href: '/classes-circle', label: 'Classes Circle / Fast Test', icon: Zap }
  ];

  const isLoginRoute = pathname === '/login';

  return (
    <header className="top-nav" style={{ flexWrap: 'wrap', height: 'auto', minHeight: '64px', padding: '0.5rem 1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', maxWidth: '100%' }}>
        {/* Brand */}
        <Link href={isLoginRoute ? '/login' : '/dashboard'} className="nav-brand">
          <span className="brand-mark">CLASEPULSE</span>
          <span className="brand-sub">TEACHER PORTAL</span>
        </Link>

        {/* Right side Teacher Session & Mobile Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {teacher && !isLoginRoute ? (
            <div className="nav-profile-badge" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div className="nav-avatar">{teacher.initials}</div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontWeight: 800, fontSize: '11px', lineHeight: 1.2 }}>{teacher.name}</span>
                <span className="text-secondary text-mono" style={{ fontSize: '9px' }}>
                  {teacher.assignedClasses[0] || 'Faculty'}
                </span>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                title="Sign out of Faculty Terminal"
                style={{
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  padding: '4px',
                  color: 'var(--ink-secondary)',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <LogOut size={14} />
              </button>
            </div>
          ) : !isLoginRoute ? (
            <Link href="/login" className="btn btn-sm btn-primary">
              <LogIn size={13} />
              Faculty Sign In
            </Link>
          ) : null}

          {/* Mobile hamburger button */}
          {!isLoginRoute && (
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              style={{ display: 'flex', padding: '6px 8px' }}
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X size={16} /> : <Menu size={16} />}
            </button>
          )}
        </div>
      </div>

      {/* Navigation Links Bar */}
      {!isLoginRoute && (
        <nav
          className="nav-links"
          style={{
            display: mobileMenuOpen ? 'flex' : 'flex',
            width: '100%',
            overflowX: 'auto',
            paddingTop: '8px',
            paddingBottom: '4px',
            borderTop: '1px solid var(--hairline)',
            marginTop: '6px',
            gap: '1.25rem',
            scrollbarWidth: 'none'
          }}
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href ||
              (item.href !== '/dashboard' && pathname.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-link ${isActive ? 'active' : ''}`}
                onClick={() => setMobileMenuOpen(false)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  whiteSpace: 'nowrap',
                  fontSize: '11px',
                  padding: '6px 2px'
                }}
              >
                <Icon size={13} style={{ opacity: isActive ? 1 : 0.7 }} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      )}
    </header>
  );
}
