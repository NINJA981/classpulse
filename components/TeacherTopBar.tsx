'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, PlusCircle, Radio, Sparkles, Bell, Calendar } from 'lucide-react';

interface TeacherTopBarProps {
  onOpenMobileMenu: () => void;
  selectedCohort: string;
}

export default function TeacherTopBar({
  onOpenMobileMenu,
  selectedCohort
}: TeacherTopBarProps) {
  const pathname = usePathname();

  const getPageMeta = (path: string) => {
    if (path === '/dashboard') {
      return { section: 'OVERVIEW', title: 'Faculty Command Center' };
    }
    if (path.startsWith('/lessons/new')) {
      return { section: 'CLASSES & SCHEDULE', title: 'New Lesson & Session Setup' };
    }
    if (path === '/previous-classes') {
      return { section: 'CLASSES & SCHEDULE', title: 'Curriculum & Lecture Archive' };
    }
    if (path === '/timetable') {
      return { section: 'CLASSES & SCHEDULE', title: 'Weekly Timetable & Allocations' };
    }
    if (path === '/notes-syllabus') {
      return { section: 'CURRICULUM & NOTES', title: 'Lecture Notes & Syllabus Tracker' };
    }
    if (path === '/record-transcribe') {
      return { section: 'LIVE CLASSROOM', title: 'Record & Automated Transcription' };
    }
    if (path === '/live-qa') {
      return { section: 'LIVE CLASSROOM', title: 'Student Live Q&A & Discussions' };
    }
    if (path === '/classes-circle') {
      return { section: 'TEST TECH & CIRCLES', title: 'Fast Test Blitz & Student Circles' };
    }
    if (path.startsWith('/lessons/')) {
      return { section: 'CURRICULUM', title: 'Lesson Details & Quiz Review' };
    }
    return { section: 'TEACHER TERMINAL', title: 'Faculty Workspace' };
  };

  const meta = getPageMeta(pathname);

  return (
    <header className="teacher-topbar">
      {/* Left side: Hamburger button + Breadcrumbs */}
      <div className="topbar-left">
        <button
          type="button"
          className="topbar-mobile-trigger"
          onClick={onOpenMobileMenu}
          aria-label="Open navigation sidebar"
        >
          <Menu size={18} />
        </button>

        <div className="topbar-breadcrumbs">
          <span className="topbar-section-tag">{meta.section}</span>
          <span className="topbar-slash">/</span>
          <h1 className="topbar-title">{meta.title}</h1>
        </div>
      </div>

      {/* Right side: Active cohort indicator + Quick Action shortcuts */}
      <div className="topbar-right">
        <div className="topbar-cohort-badge" title="Active teaching cohort">
          <span className="cohort-pulse-dot" />
          <span className="cohort-badge-text">{selectedCohort}</span>
        </div>

        <div className="topbar-actions">
          <Link href="/lessons/new" className="btn btn-sm btn-primary">
            <PlusCircle size={13} />
            <span>+ New Lesson</span>
          </Link>
          <Link href="/record-transcribe" className="btn btn-sm btn-secondary">
            <Radio size={13} />
            <span>Record Live</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
