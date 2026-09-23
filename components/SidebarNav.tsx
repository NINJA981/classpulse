'use client';

import React, { useState, useEffect, useRef } from 'react';
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
  ChevronDown,
  ChevronRight,
  LogOut,
  FolderPlus,
  ListOrdered,
  Users,
  CheckCircle2,
  Sparkles,
  Layers,
  GraduationCap,
  X,
  Menu
} from 'lucide-react';

interface SidebarNavProps {
  mobileOpen: boolean;
  onCloseMobile: () => void;
  selectedCohort: string;
  onSelectCohort: (cohort: string) => void;
}

export default function SidebarNav({
  mobileOpen,
  onCloseMobile,
  selectedCohort,
  onSelectCohort
}: SidebarNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [teacher, setTeacher] = useState<TeacherProfile | null>(null);

  // Dropdown states for collapsible groups
  const [cohortDropdownOpen, setCohortDropdownOpen] = useState(false);
  const cohortMenuRef = useRef<HTMLDivElement | null>(null);

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    sessions: true,
    curriculum: true,
    liveTools: true,
    assessment: true
  });

  useEffect(() => {
    setTeacher(getAuthTeacher());
  }, [pathname]);

  // Close cohort dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (cohortMenuRef.current && !cohortMenuRef.current.contains(e.target as Node)) {
        setCohortDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto-expand group containing current route
  useEffect(() => {
    if (pathname.startsWith('/lessons') || pathname === '/previous-classes' || pathname === '/timetable') {
      setOpenGroups((prev) => ({ ...prev, sessions: true }));
    } else if (pathname === '/notes-syllabus') {
      setOpenGroups((prev) => ({ ...prev, curriculum: true }));
    } else if (pathname === '/record-transcribe' || pathname === '/live-qa') {
      setOpenGroups((prev) => ({ ...prev, liveTools: true }));
    } else if (pathname === '/classes-circle') {
      setOpenGroups((prev) => ({ ...prev, assessment: true }));
    }
  }, [pathname]);

  const toggleGroup = (groupKey: string) => {
    setOpenGroups((prev) => ({ ...prev, [groupKey]: !prev[groupKey] }));
  };

  const handleLogout = () => {
    logoutTeacher();
    router.push('/login');
  };

  const assignedClasses = teacher?.assignedClasses || [
    'Grade 10 - Section B',
    'Grade 11 - Section A',
    'Grade 9 - Section C',
    'Grade 11 - Advanced Physics'
  ];

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {mobileOpen && (
        <div
          className="sidebar-backdrop"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside className={`app-sidebar ${mobileOpen ? 'open' : ''}`}>
        {/* Brand Header */}
        <div className="sidebar-brand-box">
          <Link href="/dashboard" className="sidebar-brand-link" onClick={onCloseMobile}>
            <div className="brand-mark-cube">CP</div>
            <div className="sidebar-brand-text">
              <span className="brand-title">CLASEPULSE</span>
              <span className="brand-subtitle">TEACHER PORTAL</span>
            </div>
          </Link>

          {/* Close button on mobile */}
          <button
            type="button"
            className="sidebar-mobile-close"
            onClick={onCloseMobile}
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        {/* Active Class / Cohort Dropdown Selector */}
        <div className="sidebar-cohort-wrapper" ref={cohortMenuRef}>
          <div className="sidebar-cohort-label">
            <span>ACTIVE COHORT</span>
            <span className="live-indicator-dot" title="Active Classroom Context" />
          </div>

          <button
            type="button"
            className="sidebar-cohort-btn"
            onClick={() => setCohortDropdownOpen(!cohortDropdownOpen)}
            aria-haspopup="listbox"
            aria-expanded={cohortDropdownOpen}
          >
            <div className="cohort-info">
              <GraduationCap size={14} className="cohort-icon" />
              <span className="cohort-name">{selectedCohort}</span>
            </div>
            <ChevronDown
              size={14}
              className={`dropdown-chevron ${cohortDropdownOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {cohortDropdownOpen && (
            <div className="sidebar-cohort-menu">
              <div className="cohort-menu-header">SWITCH CLASS COHORT</div>
              {assignedClasses.map((cls) => {
                const isSelected = cls === selectedCohort;
                return (
                  <button
                    key={cls}
                    type="button"
                    className={`cohort-menu-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => {
                      onSelectCohort(cls);
                      setCohortDropdownOpen(false);
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="cohort-bullet">{isSelected ? '●' : '○'}</span>
                      <span>{cls}</span>
                    </div>
                    {isSelected && <CheckCircle2 size={12} />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Scrollable Navigation Sections */}
        <nav className="sidebar-scrollable-nav">
          {/* Section 0: Main Command Hub */}
          <div className="nav-group">
            <Link
              href="/dashboard"
              className={`sidebar-nav-item ${pathname === '/dashboard' ? 'active' : ''}`}
              onClick={onCloseMobile}
            >
              <LayoutDashboard size={15} />
              <span>Dashboard</span>
            </Link>
          </div>

          {/* Section 1: Lectures & Timetable Dropdown Accordion */}
          <div className="nav-group">
            <button
              type="button"
              className="sidebar-group-trigger"
              onClick={() => toggleGroup('sessions')}
              aria-expanded={openGroups.sessions}
            >
              <div className="trigger-left">
                <span className="group-eyebrow">CLASSES & SCHEDULE</span>
              </div>
              <ChevronDown
                size={13}
                className={`dropdown-chevron ${openGroups.sessions ? 'rotate-180' : ''}`}
              />
            </button>

            {openGroups.sessions && (
              <div className="sidebar-sub-menu">
                <Link
                  href="/lessons/new"
                  className={`sidebar-sub-item ${pathname === '/lessons/new' ? 'active' : ''}`}
                  onClick={onCloseMobile}
                >
                  <PlusCircle size={14} />
                  <span>New Lesson</span>
                  <span className="sidebar-badge-accent">START</span>
                </Link>

                <Link
                  href="/previous-classes"
                  className={`sidebar-sub-item ${pathname === '/previous-classes' ? 'active' : ''}`}
                  onClick={onCloseMobile}
                >
                  <History size={14} />
                  <span>Previous Classes</span>
                  <span className="sidebar-badge-counter">18</span>
                </Link>

                <Link
                  href="/timetable"
                  className={`sidebar-sub-item ${pathname === '/timetable' ? 'active' : ''}`}
                  onClick={onCloseMobile}
                >
                  <Calendar size={14} />
                  <span>Timetable</span>
                  <span className="sidebar-badge-live">LIVE</span>
                </Link>
              </div>
            )}
          </div>

          {/* Section 2: Curriculum & Materials Dropdown Accordion */}
          <div className="nav-group">
            <button
              type="button"
              className="sidebar-group-trigger"
              onClick={() => toggleGroup('curriculum')}
              aria-expanded={openGroups.curriculum}
            >
              <div className="trigger-left">
                <span className="group-eyebrow">CURRICULUM & NOTES</span>
              </div>
              <ChevronDown
                size={13}
                className={`dropdown-chevron ${openGroups.curriculum ? 'rotate-180' : ''}`}
              />
            </button>

            {openGroups.curriculum && (
              <div className="sidebar-sub-menu">
                <Link
                  href="/notes-syllabus"
                  className={`sidebar-sub-item ${pathname === '/notes-syllabus' ? 'active' : ''}`}
                  onClick={onCloseMobile}
                >
                  <BookOpen size={14} />
                  <span>Notes & Syllabus</span>
                </Link>

                <div className="sidebar-nested-links">
                  <Link
                    href="/notes-syllabus#upload"
                    className="nested-sub-link"
                    onClick={onCloseMobile}
                  >
                    <span>↳ Upload Materials</span>
                  </Link>
                  <Link
                    href="/notes-syllabus#tracker"
                    className="nested-sub-link"
                    onClick={onCloseMobile}
                  >
                    <span>↳ Syllabus Tracker</span>
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Section 3: Live Classroom Hub Dropdown Accordion */}
          <div className="nav-group">
            <button
              type="button"
              className="sidebar-group-trigger"
              onClick={() => toggleGroup('liveTools')}
              aria-expanded={openGroups.liveTools}
            >
              <div className="trigger-left">
                <span className="group-eyebrow">LIVE CLASSROOM</span>
              </div>
              <ChevronDown
                size={13}
                className={`dropdown-chevron ${openGroups.liveTools ? 'rotate-180' : ''}`}
              />
            </button>

            {openGroups.liveTools && (
              <div className="sidebar-sub-menu">
                <Link
                  href="/record-transcribe"
                  className={`sidebar-sub-item ${pathname === '/record-transcribe' ? 'active' : ''}`}
                  onClick={onCloseMobile}
                >
                  <Radio size={14} />
                  <span>Record & Transcribe</span>
                  <span className="sidebar-badge-live">REC</span>
                </Link>

                <Link
                  href="/live-qa"
                  className={`sidebar-sub-item ${pathname === '/live-qa' ? 'active' : ''}`}
                  onClick={onCloseMobile}
                >
                  <MessageSquare size={14} />
                  <span>Q&A / Live Interaction</span>
                  <span className="sidebar-badge-counter">4 New</span>
                </Link>

                <Link
                  href="/model-settings"
                  className={`sidebar-sub-item ${pathname === '/model-settings' ? 'active' : ''}`}
                  onClick={onCloseMobile}
                >
                  <Radio size={14} />
                  <span>AI Model Settings</span>
                </Link>
              </div>
            )}
          </div>

          {/* Section 4: Testing & Student Circles Dropdown Accordion */}
          <div className="nav-group">
            <button
              type="button"
              className="sidebar-group-trigger"
              onClick={() => toggleGroup('assessment')}
              aria-expanded={openGroups.assessment}
            >
              <div className="trigger-left">
                <span className="group-eyebrow">TEST TECH & CIRCLES</span>
              </div>
              <ChevronDown
                size={13}
                className={`dropdown-chevron ${openGroups.assessment ? 'rotate-180' : ''}`}
              />
            </button>

            {openGroups.assessment && (
              <div className="sidebar-sub-menu">
                <Link
                  href="/classes-circle"
                  className={`sidebar-sub-item ${pathname === '/classes-circle' ? 'active' : ''}`}
                  onClick={onCloseMobile}
                >
                  <Zap size={14} />
                  <span>Fast Test & Circles</span>
                  <span className="sidebar-badge-accent">60s</span>
                </Link>

                <div className="sidebar-nested-links">
                  <Link
                    href="/classes-circle#fast-test"
                    className="nested-sub-link"
                    onClick={onCloseMobile}
                  >
                    <span>↳ Diagnostic Blitz</span>
                  </Link>
                  <Link
                    href="/classes-circle#roster"
                    className="nested-sub-link"
                    onClick={onCloseMobile}
                  >
                    <span>↳ Circle Group Roster</span>
                  </Link>
                </div>
              </div>
            )}
          </div>
        </nav>

        {/* Faculty Profile Footer */}
        <div className="sidebar-footer">
          {teacher ? (
            <div className="sidebar-profile-card">
              <div className="profile-avatar-box">
                {teacher.initials}
              </div>
              <div className="profile-details">
                <div className="profile-name">{teacher.name}</div>
                <div className="profile-role">{teacher.department || 'Faculty'}</div>
              </div>
              <button
                type="button"
                className="profile-logout-btn"
                onClick={handleLogout}
                title="Sign Out of Faculty Portal"
              >
                <LogOut size={15} />
              </button>
            </div>
          ) : (
            <Link href="/login" className="btn btn-sm btn-primary" style={{ width: '100%' }}>
              Faculty Sign In
            </Link>
          )}

          <div className="sidebar-terminal-tag">
            <span>CLASEPULSE TERMINAL v1.4 • ACTIVE</span>
          </div>
        </div>
      </aside>
    </>
  );
}
