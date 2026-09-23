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
  Building2,
  FileSpreadsheet,
  BookOpen,
  KeyRound,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  Calendar
} from 'lucide-react';

export const Sidebar = () => {
  const {
    activeTab,
    setActiveTab,
    adminSubTab = 'access',
    setAdminSubTab,
    onboardingStep = 'institution',
    setOnboardingStep,
    userRole,
    currentUser,
    logout,
    classrooms = [],
    teachers = [],
    students = []
  } = useClassPulse();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [managementExpanded, setManagementExpanded] = useState(true);
  const [onboardingExpanded, setOnboardingExpanded] = useState(false);
  const isAdmin = userRole === 'admin';

  // Keep dropdown open when user navigates
  useEffect(() => {
    if (activeTab === 'management') {
      setManagementExpanded(true);
    } else if (activeTab === 'onboarding') {
      setOnboardingExpanded(true);
    }
  }, [activeTab]);

  const managementSubItems = [
    { id: 'access', label: 'Access Control (RBAC)', icon: ShieldCheck },
    { id: 'timetables', label: 'Schedules & Timetables', icon: Calendar }
  ];

  const onboardingSubItems = [
    { id: 'institution', label: 'Institution Setup', icon: Building2, tag: 'CAMPUS' },
    { id: 'classrooms', label: 'Classrooms Directory', icon: School, count: classrooms.length },
    { id: 'teachers', label: 'Faculty Directory', icon: UserCheck, count: teachers.length },
    { id: 'students', label: 'Student Roster', icon: GraduationCap, count: students.length },
    { id: 'roster', label: 'Roster Ingestion', icon: FileSpreadsheet, tag: 'ROSTER' },
    { id: 'syllabus', label: 'Courses & Syllabi', icon: BookOpen, tag: 'COURSES' },
    { id: 'sections', label: 'Section Tokens', icon: KeyRound, tag: 'TOKENS' }
  ];

  const adminNavItems = [
    {
      id: 'management',
      label: 'Admin Control Center',
      icon: Layers,
      hasDropdown: true
    },
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

  const handleManagementToggle = (e) => {
    e.stopPropagation();
    setManagementExpanded(!managementExpanded);
  };

  const handleManagementParentClick = () => {
    setActiveTab('management');
    setManagementExpanded(true);
    setMobileOpen(false);
  };

  const handleManagementSubClick = (subId) => {
    setActiveTab('management');
    if (setAdminSubTab) {
      setAdminSubTab(subId);
    }
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

          {/* Navigation Section */}
          <div className="flex flex-col gap-1.5">
            <span className="cp-nav-section-label">Navigation</span>
            <nav className="flex flex-col gap-1" aria-label="Primary">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;

                // Handle items with dropdown (Management & Onboarding)
                if (item.hasDropdown) {
                  const isManagement = item.id === 'management';
                  const isExpanded = isManagement ? managementExpanded : onboardingExpanded;
                  const onParentClick = isManagement ? handleManagementParentClick : handleOnboardingParentClick;
                  const onToggle = isManagement ? handleManagementToggle : handleOnboardingToggle;
                  const subList = isManagement ? managementSubItems : onboardingSubItems;
                  const onSubClick = isManagement ? handleManagementSubClick : handleSubStepClick;

                  return (
                    <div key={item.id} className="flex flex-col">
                      {/* Parent Item */}
                      <div
                        className={`cp-sidebar-link ${isActive ? 'is-active' : ''} group`}
                        onClick={onParentClick}
                        role="button"
                        tabIndex={0}
                        aria-expanded={isExpanded}
                      >
                        <div className="flex items-center gap-3">
                          <Icon className="w-4 h-4 shrink-0" />
                          <span className="font-semibold text-xs tracking-tight">{item.label}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={onToggle}
                            className="p-1 hover:bg-black/10 rounded transition-colors"
                            aria-label={isExpanded ? `Collapse ${item.label} menu` : `Expand ${item.label} menu`}
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-3.5 h-3.5 opacity-70" />
                            ) : (
                              <ChevronRight className="w-3.5 h-3.5 opacity-70" />
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Dropdown sub-items */}
                      {isExpanded && (
                        <div className="cp-sidebar-subnav" role="region" aria-label={`${item.label} Subsections`}>
                          {subList.map((sub) => {
                            const SubIcon = sub.icon;
                            const isSubActive = isManagement
                              ? (activeTab === 'management' && adminSubTab === sub.id)
                              : (activeTab === 'onboarding' && onboardingStep === sub.id);

                            return (
                              <button
                                key={sub.id}
                                type="button"
                                onClick={() => onSubClick(sub.id)}
                                className={`cp-sidebar-sublink ${isSubActive ? 'is-active' : ''}`}
                                aria-current={isSubActive ? 'step' : undefined}
                              >
                                <div className="flex items-center justify-between w-full min-w-0 pr-1">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <SubIcon className={`w-3.5 h-3.5 shrink-0 ${isSubActive ? 'text-slate-900' : 'text-slate-400'}`} />
                                    <span className="truncate">{sub.label}</span>
                                  </div>
                                  {sub.count !== undefined && (
                                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 shrink-0 ml-1">
                                      {sub.count}
                                    </span>
                                  )}
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

        {/* Bottom Area: User Profile */}
        <div className="flex flex-col gap-4 pt-4 border-t border-slate-200">
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
            {userRole === 'admin' && 'System Administrator'}
            {userRole === 'teacher' && 'Classroom Teacher'}
            {userRole === 'student' && 'Enrolled Student'}
          </strong>
          <p>Smart Classroom Administration & Telemetry System</p>
        </div>
      </div>
    </footer>
  );
};
