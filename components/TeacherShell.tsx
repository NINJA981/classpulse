'use client';

import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import SidebarNav from './SidebarNav';
import TeacherTopBar from './TeacherTopBar';

export default function TeacherShell({
  children
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [selectedCohort, setSelectedCohort] = useState('Grade 10 - Section B');

  // Load cohort from localStorage if present
  useEffect(() => {
    try {
      const saved = localStorage.getItem('clasepulse_selected_cohort');
      if (saved) {
        setSelectedCohort(saved);
      }
    } catch {
      // ignore
    }
  }, []);

  const handleSelectCohort = (cohort: string) => {
    setSelectedCohort(cohort);
    try {
      localStorage.setItem('clasepulse_selected_cohort', cohort);
    } catch {
      // ignore
    }
  };

  const isLoginRoute = pathname === '/login';

  if (isLoginRoute) {
    return (
      <div className="login-shell-wrapper">
        {children}
      </div>
    );
  }

  return (
    <div className="teacher-app-shell">
      {/* Sidebar with dropdown navigation */}
      <SidebarNav
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
        selectedCohort={selectedCohort}
        onSelectCohort={handleSelectCohort}
      />

      {/* Main Workspace Area */}
      <div className="teacher-main-area">
        <TeacherTopBar
          onOpenMobileMenu={() => setMobileOpen(true)}
          selectedCohort={selectedCohort}
        />
        <main className="main-content">{children}</main>
      </div>
    </div>
  );
}
