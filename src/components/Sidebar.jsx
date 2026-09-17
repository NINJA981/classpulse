'use client';

import React, { useState, useEffect } from 'react';
import { useClassPulse } from '../context/ClassPulseContext';
import {
  Layers,
  UserPlus,
  BarChart3,
  UserCheck,
  School,
  BrainCircuit,
  Tv2,
  GraduationCap,
  LogOut,
  Menu,
  X,
  Radio,
  Building2,
  FileSpreadsheet,
  BookOpen,
  KeyRound,
  ChevronDown,
  ChevronRight
} from 'lucide-react';

export const Sidebar = () => {
  const {
    activeTab,
    setActiveTab,
    onboardingStep = 'institution',
    setOnboardingStep,
    userRole,
    currentUser,
    logout
  } = useClassPulse();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [onboardingExpanded, setOnboardingExpanded] = useState(true);
  const isAdmin = userRole === 'admin';

  // Keep dropdown open when user navigates to onboarding
  useEffect(() => {
    if (activeTab === 'onboarding') {
      setOnboardingExpanded(true);
    }
  }, [activeTab]);

  const onboardingSubItems = [
    { id: 'institution', label: 'Institution Setup', icon: Building2, tag: 'CAMPUS' },
    { id: 'roster', label: 'Roster Ingestion', icon: FileSpreadsheet, tag: 'ROSTER' },
    { id: 'syllabus', label: 'Courses & Syllabi', icon: BookOpen, tag: 'COURSES' },
    { id: 'sections', label: 'Section Tokens', icon: KeyRound, tag: 'TOKENS' }
  ];

  const adminNavItems = [
    { id: 'management', label: 'Admin Control Center', icon: Layers, badge: 'CORE' },
    {
      id: 'onboarding',
      label: 'Onboarding & Setup',
      icon: UserPlus,
      hasDropdown: true
    },
    { id: 'analytics', label: 'Classroom Analytics', icon: BarChart3 }
  ];

  const teacherNavItems = [
    { id: 'teacher-dash', label: 'Teacher Dashboard', icon: UserCheck, badge: 'MY CLASS' },
    { id: 'management', label: 'Class & Timetables', icon: School },
    { id: 'quiz', label: 'AI Quiz Workbench', icon: BrainCircuit },
    { id: 'projector', label: 'Projector Kiosk', icon: Tv2 }
  ];

  const studentNavItems = [
    { id: 'student-dash', label: 'Student Portal', icon: GraduationCap, badge: 'TIMETABLE' },
    { id: 'projector', label: 'Live Quiz Screen', icon: Tv2 }
  ];

  const navItems = isAdmin ? adminNavItems : userRole === 'teacher' ? teacherNavItems : studentNavItems;

  const handleNavClick = (id) => {
    setActiveTab(id);
    setMobileOpen(false);
  };

  const handleOnboardingToggle = (e) => {
    e.stopPropagation();
    setOnboardingExpanded(!onboardingExpanded);
  };

  const handleOnboardingParentClick = () => {
    setActiveTab('onboarding');
    setOnboardingExpanded(true);
    setMobileOpen(false);
  };

  const handleSubStepClick = (stepId) => {
    setActiveTab('onboarding');
    if (setOnboardingStep) {
      setOnboardingStep(stepId);
    }
    setMobileOpen(false);
  };

  return (
    <>
      {/* Mobile Topbar with Hamburger Toggle (< 1024px) */}
      <div className="cp-mobile-header lg:hidden">
        <div className="flex items-center gap-3">
          <div className="cp-brand-mark" aria-hidden="true">CP</div>
          <div>
            <div className="cp-brand text-sm">ClassPulse Hub</div>
            <div className="cp-brand-subtitle text-[8px]">
              {isAdmin ? 'EXECUTIVE ADMIN' : 'SMART SYSTEM'}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setMobileOpen(!mobileOpen)}
          className="cp-icon-btn"
          aria-label={mobileOpen ? 'Close Menu' : 'Open Menu'}
        >
          {mobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
        </button>
      </div>

      {/* Mobile Backdrop Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden backdrop-blur-xs"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Primary Sidebar */}
      <aside
        className={`cp-sidebar ${mobileOpen ? 'is-mobile-open' : ''} select-none`}
        aria-label="Sidebar Navigation"
      >
        <div className="flex flex-col gap-6">
          {/* Brand block */}
          <div className="cp-brand-area">
            <div className="cp-brand-mark" aria-hidden="true">CP</div>
            <div>
              <div className="cp-brand">
                ClassPulse Hub
              </div>
              <div className="cp-brand-subtitle">
                {isAdmin ? 'EXECUTIVE ADMIN' : 'SMART SYSTEM'}
                <span> · {isAdmin ? 'v2.5' : 'System Edition'}</span>
              </div>
            </div>
          </div>

          {/* Role / Status Badge Card */}
          <div className="cp-role-card">
            <div className="flex items-center justify-between">
              <span className="cp-eyebrow is-tight">Active Workspace</span>
              <span className="cp-live inline-flex items-center gap-1.5 text-[9px]">
                <span className="cp-dot is-live" />
                LIVE
              </span>
            </div>
            <div className="text-xs font-bold mt-1 text-slate-900 flex items-center gap-1.5">
              {userRole === 'admin' && '🔐 System Administrator'}
              {userRole === 'teacher' && '👨‍🏫 Teacher Workbench'}
              {userRole === 'student' && '🎓 Student Portal'}
            </div>
          </div>

          {/* Navigation Section */}
          <div className="flex flex-col gap-1.5">
            <span className="cp-nav-section-label">Navigation</span>
            <nav className="flex flex-col gap-1" aria-label="Primary">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;

                // Handle Onboarding with dropdown
                if (item.hasDropdown) {
                  return (
                    <div key={item.id} className="flex flex-col">
                      {/* Parent Item */}
                      <div
                        className={`cp-sidebar-link ${isActive ? 'is-active' : ''} group`}
                        onClick={handleOnboardingParentClick}
                        role="button"
                        tabIndex={0}
                        aria-expanded={onboardingExpanded}
                      >
                        <div className="flex items-center gap-3">
                          <Icon className="w-4 h-4 shrink-0" />
                          <span className="font-semibold text-xs tracking-tight">{item.label}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={handleOnboardingToggle}
                            className="p-1 hover:bg-black/10 rounded transition-colors"
                            aria-label={onboardingExpanded ? 'Collapse onboarding menu' : 'Expand onboarding menu'}
                          >
                            {onboardingExpanded ? (
                              <ChevronDown className="w-3.5 h-3.5 opacity-70" />
                            ) : (
                              <ChevronRight className="w-3.5 h-3.5 opacity-70" />
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Dropdown sub-items */}
                      {onboardingExpanded && (
                        <div className="cp-sidebar-subnav" role="region" aria-label="Onboarding Steps">
                          {onboardingSubItems.map((sub) => {
                            const SubIcon = sub.icon;
                            const isSubActive = activeTab === 'onboarding' && onboardingStep === sub.id;
                            return (
                              <button
                                key={sub.id}
                                type="button"
                                onClick={() => handleSubStepClick(sub.id)}
                                className={`cp-sidebar-sublink ${isSubActive ? 'is-active' : ''}`}
                                aria-current={isSubActive ? 'step' : undefined}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <SubIcon className={`w-3.5 h-3.5 shrink-0 ${isSubActive ? 'text-slate-900' : 'text-slate-400'}`} />
                                  <span className="truncate">{sub.label}</span>
                                </div>
                                <span className="cp-subdot shrink-0" />
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                }

                // Regular Nav item
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleNavClick(item.id)}
                    className={`cp-sidebar-link ${isActive ? 'is-active' : ''}`}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="font-semibold text-xs tracking-tight">{item.label}</span>
                    </div>
                    {item.badge && (
                      <span className="cp-nav-badge text-[8px]">{item.badge}</span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Bottom Area: System Status & User Profile */}
        <div className="flex flex-col gap-4 pt-4 border-t border-slate-200">
          {/* Telemetry info pill */}
          <div className="cp-sidebar-telemetry">
            <Radio className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span className="text-[10px] text-slate-600 font-medium">
              Edge Telemetry Online (18ms)
            </span>
          </div>

          {/* User Profile Card */}
          <div className="cp-sidebar-profile">
            <div className="flex items-center gap-3 min-w-0">
              <div className="cp-avatar shrink-0" aria-hidden="true">
                {currentUser?.name ? currentUser.name[0] : 'A'}
              </div>
              <div className="flex flex-col min-w-0">
                <strong className="text-xs font-bold text-slate-900 truncate">
                  {currentUser?.name || 'Administrator'}
                </strong>
                <span className="text-[10px] text-slate-500 capitalize tracking-wide">
                  {userRole}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={logout}
              className="cp-icon-btn shrink-0"
              title="Switch Role / Logout"
              aria-label="Switch Role / Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
