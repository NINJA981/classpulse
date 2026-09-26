'use client';

import React, { useState, useEffect } from 'react';
import { useClassPulse } from '../context/ClassPulseContext';
import {
  RefreshCw,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Building2,
  Users,
  BookOpen,
  School,
  BrainCircuit,
  Layers,
  ArrowUpRight,
  ShieldCheck,
  Calendar,
  Sparkles
} from 'lucide-react';

export const ManagementView = () => {
  const {
    overview,
    institution,
    courses = [],
    lessons = [],
    classrooms = [],
    teachers = [],
    students = [],
    timetables = {},
    addTimetableSlot,
    adminSubTab = 'overview',
    accessControls,
    toggleUserPermission,
    refreshData,
    loadingData,
    backendConnected,
    setActiveTab,
    setOnboardingStep
  } = useClassPulse();

  const activeSubTab = adminSubTab;
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isModalOpen) {
        setIsModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen]);

  // Timetable State
  const [selectedTimetableClass, setSelectedTimetableClass] = useState(classrooms[0]?.name || 'Class 12-A');
  const [selectedTimetableDay, setSelectedTimetableDay] = useState('Monday');

  useEffect(() => {
    if (classrooms.length > 0 && !classrooms.some(c => c.name === selectedTimetableClass)) {
      setSelectedTimetableClass(classrooms[0].name);
    }
  }, [classrooms, selectedTimetableClass]);

  // Timetable Slot Form
  const [newSlotForm, setNewSlotForm] = useState({
    time: '02:30 - 03:30 PM',
    subject: courses[0]?.title || 'Mathematics XII',
    teacher: teachers[0]?.name || 'Demo Teacher',
    room: 'Science Lab 2'
  });

  const permissionRows = [
    { key: 'manageClassrooms', label: 'Create & Manage Classrooms Stream' },
    { key: 'manageTeachers', label: 'Add & Manage Faculty Profiles' },
    { key: 'manageStudents', label: 'Add & Roster Student Accounts' },
    { key: 'assignTimetables', label: 'Create & Edit Weekly Schedules' },
    { key: 'controlAccess', label: 'Modify Access Control Policies' },
    { key: 'launchQuizzes', label: 'Launch AI Interactive Quizzes' },
    { key: 'viewAnalytics', label: 'View Performance Analytics & Logs' }
  ];

  const instData = institution || overview?.institution;
  const counts = overview?.counts || {};
  const recentLessons = overview?.recentLessons || [];
  const lessonsByStatus = overview?.lessonsByStatus || [];

  const getStatusBadge = (status) => {
    switch (status) {
      case 'published':
        return <span className="cp-badge bg-emerald-100 text-emerald-900 border border-emerald-300">Published</span>;
      case 'ready_for_review':
        return <span className="cp-badge bg-amber-100 text-amber-900 border border-amber-300">Ready for Review</span>;
      case 'queued':
      case 'transcribing':
      case 'generating':
        return <span className="cp-badge bg-sky-100 text-sky-900 border border-sky-300">Processing</span>;
      case 'failed':
        return <span className="cp-badge bg-red-100 text-red-900 border border-red-300">Failed</span>;
      case 'draft':
      default:
        return <span className="cp-badge bg-gray-100 text-gray-800 border border-gray-300">Draft</span>;
    }
  };

  return (
    <>
      <section className="space-y-5">
        {/* ----------------- SECTION 0: INSTITUTIONAL OVERVIEW (LIVE BACKEND) ----------------- */}
        {activeSubTab === 'overview' && (
          <div className="space-y-5">
            {/* Live Institution Banner */}
            <div className="border border-border bg-surface shadow-sm p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-ink text-white flex items-center justify-center font-mono font-black text-sm shadow-[2px_2px_0_#111]">
                    CP
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="cp-h2 font-black">
                        {instData?.name || 'ClasePulse Institutional Command'}
                      </h2>
                      <span className="cp-badge is-ink font-mono text-[9px]">
                        CODE: {instData?.code || 'INST-01'}
                      </span>
                    </div>
                    <p className="text-secondary text-xs mt-0.5">
                      Academic Year: <strong>{instData?.academicYear || '2026-2027'}</strong> • Timezone: <strong>{instData?.timezone || 'Asia/Kolkata'}</strong>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`cp-badge ${backendConnected ? 'bg-emerald-50 text-emerald-800 border border-emerald-400' : 'bg-amber-50 text-amber-800 border border-amber-400'} flex items-center gap-1.5 py-1 px-2.5 text-[10px]`}>
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>{backendConnected ? 'LIVE BACKEND CONNECTED' : 'CONNECTING API...'}</span>
                  </span>
                  {refreshData && (
                    <button
                      onClick={refreshData}
                      disabled={loadingData}
                      className="cp-btn cp-btn-ghost h-8 px-3 text-xs flex items-center gap-1.5 border border-border"
                      title="Sync live records from backend"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${loadingData ? 'animate-spin' : ''}`} />
                      <span>{loadingData ? 'Syncing...' : 'Refresh'}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* KPI Statistics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="border border-border bg-surface-sunken p-3.5 flex flex-col justify-between">
                  <div className="flex items-center justify-between text-muted text-xs">
                    <span className="font-mono text-[10px] uppercase font-bold tracking-wider">Faculty</span>
                    <Users className="w-3.5 h-3.5" />
                  </div>
                  <div className="mt-2">
                    <strong className="text-2xl font-black text-ink">{counts.teachers ?? teachers.length}</strong>
                    <p className="text-[10px] text-muted mt-0.5">Instructors</p>
                  </div>
                </div>

                <div className="border border-border bg-surface-sunken p-3.5 flex flex-col justify-between">
                  <div className="flex items-center justify-between text-muted text-xs">
                    <span className="font-mono text-[10px] uppercase font-bold tracking-wider">Students</span>
                    <School className="w-3.5 h-3.5" />
                  </div>
                  <div className="mt-2">
                    <strong className="text-2xl font-black text-ink">{counts.students ?? students.length}</strong>
                    <p className="text-[10px] text-muted mt-0.5">Enrolled</p>
                  </div>
                </div>

                <div className="border border-border bg-surface-sunken p-3.5 flex flex-col justify-between">
                  <div className="flex items-center justify-between text-muted text-xs">
                    <span className="font-mono text-[10px] uppercase font-bold tracking-wider">Courses</span>
                    <BookOpen className="w-3.5 h-3.5" />
                  </div>
                  <div className="mt-2">
                    <strong className="text-2xl font-black text-ink">{counts.courses ?? courses.length}</strong>
                    <p className="text-[10px] text-muted mt-0.5">Curricula</p>
                  </div>
                </div>

                <div className="border border-border bg-surface-sunken p-3.5 flex flex-col justify-between">
                  <div className="flex items-center justify-between text-muted text-xs">
                    <span className="font-mono text-[10px] uppercase font-bold tracking-wider">Sections</span>
                    <Layers className="w-3.5 h-3.5" />
                  </div>
                  <div className="mt-2">
                    <strong className="text-2xl font-black text-ink">{counts.sections ?? classrooms.length}</strong>
                    <p className="text-[10px] text-muted mt-0.5">Cohorts</p>
                  </div>
                </div>

                <div className="border border-border bg-surface-sunken p-3.5 flex flex-col justify-between">
                  <div className="flex items-center justify-between text-muted text-xs">
                    <span className="font-mono text-[10px] uppercase font-bold tracking-wider">Lessons</span>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  </div>
                  <div className="mt-2">
                    <strong className="text-2xl font-black text-ink">{counts.lessons ?? lessons.length}</strong>
                    <p className="text-[10px] text-muted mt-0.5">{counts.publishedLessons ?? 0} Published</p>
                  </div>
                </div>

                <div className="border border-border bg-surface-sunken p-3.5 flex flex-col justify-between">
                  <div className="flex items-center justify-between text-muted text-xs">
                    <span className="font-mono text-[10px] uppercase font-bold tracking-wider">Questions</span>
                    <BrainCircuit className="w-3.5 h-3.5 text-indigo-600" />
                  </div>
                  <div className="mt-2">
                    <strong className="text-2xl font-black text-ink">{counts.questions ?? 0}</strong>
                    <p className="text-[10px] text-muted mt-0.5">{counts.approvedQuestions ?? 0} Approved</p>
                  </div>
                </div>
              </div>
            </div>

            {/* AI Pipeline Distribution */}
            {lessonsByStatus.length > 0 && (
              <div className="border border-border bg-surface shadow-sm p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="cp-eyebrow">Pipeline Lifecycle</span>
                  <span className="text-xs text-muted font-bold">Total: {counts.lessons || 0} Lessons</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  {lessonsByStatus.map((row) => (
                    <div key={row.status} className="border border-border p-3 bg-surface-sunken flex items-center justify-between">
                      <div>
                        {getStatusBadge(row.status)}
                      </div>
                      <span className="text-lg font-black text-ink">{row.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Live Recent Lectures Table */}
            <div className="border border-border bg-surface shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-border bg-surface">
                <div>
                  <span className="cp-eyebrow">Realtime Activity</span>
                  <h3 className="cp-h3 mt-0.5">Recent Classroom Lessons & Ingestion Jobs</h3>
                  <p className="text-secondary text-xs mt-0.5">
                    Live telemetry from audio recordings, syllabus uploads, and AI evaluation pipeline.
                  </p>
                </div>
                <button
                  onClick={() => {
                    if (setActiveTab) setActiveTab('onboarding');
                    if (setOnboardingStep) setOnboardingStep('classrooms');
                  }}
                  className="cp-btn cp-btn-ghost h-8 text-xs flex items-center gap-1 border border-border"
                >
                  <span>Classrooms Directory</span>
                  <ArrowUpRight className="w-3 h-3" />
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="cp-table w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-border bg-surface-sunken text-[10px] uppercase font-black tracking-wider text-muted">
                      <th className="py-2.5 px-4">Lecture / Topic Title</th>
                      <th className="py-2.5 px-4">Subject</th>
                      <th className="py-2.5 px-4">Classroom Cohort</th>
                      <th className="py-2.5 px-4 text-center">Pipeline Status</th>
                      <th className="py-2.5 px-4 text-right">Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentLessons.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-muted text-xs">
                          No recent lessons found in the backend database.
                        </td>
                      </tr>
                    ) : (
                      recentLessons.map((item) => (
                        <tr key={item.id} className="border-b border-border-faint last:border-b-0 hover:bg-surface-hover">
                          <td className="py-3 px-4 font-bold text-xs text-primary">
                            {item.title}
                          </td>
                          <td className="py-3 px-4 text-xs font-semibold text-muted">
                            <span className="cp-badge">{item.subject || 'General'}</span>
                          </td>
                          <td className="py-3 px-4 text-xs font-medium text-ink">
                            {item.className || 'General Cohort'}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {getStatusBadge(item.status)}
                          </td>
                          <td className="py-3 px-4 text-right text-[11px] font-mono text-muted">
                            {new Date(item.updatedAt).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ----------------- SECTION 1: ACCESS CONTROL (RBAC MATRIX) ----------------- */}
        {activeSubTab === 'access' && (
          <div className="border border-border bg-surface shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-border bg-surface">
              <div>
                <span className="cp-eyebrow">Security</span>
                <h3 className="cp-h3 mt-0.5">Role-Based Access Control (RBAC) Matrix</h3>
                <p className="cp-lead text-secondary text-xs mt-0.5">
                  Configure feature privileges across Admin, Teacher, and Student user roles.
                </p>
              </div>
              <span className="cp-badge is-ink">Security Enforced</span>
            </div>

            <div className="overflow-x-auto">
              <table className="cp-table w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border bg-surface-sunken text-[10px] uppercase font-black tracking-wider text-muted">
                    <th className="py-2.5 px-4">Capability / Permission</th>
                    <th className="py-2.5 px-4 text-center">Admin</th>
                    <th className="py-2.5 px-4 text-center">Teacher</th>
                    <th className="py-2.5 px-4 text-center">Student</th>
                  </tr>
                </thead>
                <tbody>
                  {permissionRows.map((perm) => (
                    <tr key={perm.key} className="border-b border-border-faint last:border-b-0 hover:bg-surface-hover">
                      <td className="py-2.5 px-4 font-bold text-xs text-primary">{perm.label}</td>
                      {['Admin', 'Teacher', 'Student'].map((role) => {
                        const isGranted = accessControls.roles[role]?.permissions[perm.key];
                        return (
                          <td key={role} className="py-2.5 px-4 text-center">
                            <label className={`cp-toggle cursor-pointer ${isGranted ? 'is-on' : ''}`}>
                              <input
                                type="checkbox"
                                checked={!!isGranted}
                                onChange={() => toggleUserPermission(role, perm.key)}
                                className="cursor-pointer"
                              />
                              <span>{isGranted ? 'Granted' : 'Restricted'}</span>
                            </label>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ----------------- SECTION 2: TIMETABLE & SCHEDULES ----------------- */}
        {activeSubTab === 'timetables' && (
          <div className="border border-border bg-surface shadow-sm">
            {/* Top Timetable Header with Stream Selector & Add Slot Button */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-border bg-surface">
              <div>
                <span className="cp-eyebrow">Schedules</span>
                <h3 className="cp-h3 mt-0.5">Schedule Management: {selectedTimetableClass}</h3>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <label className="cp-label text-[10px] text-muted whitespace-nowrap" htmlFor="timetable-stream-select">
                    Stream:
                  </label>
                  <select
                    id="timetable-stream-select"
                    value={selectedTimetableClass}
                    onChange={(e) => setSelectedTimetableClass(e.target.value)}
                    className="cp-select text-xs py-1 px-3 h-8"
                  >
                    {classrooms.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={() => setIsModalOpen(true)}
                  className="cp-btn cp-btn-primary min-h-0 h-8 px-3 text-xs shrink-0"
                >
                  <span aria-hidden="true">＋</span>
                  <span>Add Timetable Slot</span>
                </button>
              </div>
            </div>

            <div className="p-4 space-y-3">
              <div className="cp-segment flex-wrap">
                {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map((day) => (
                  <button
                    key={day}
                    onClick={() => setSelectedTimetableDay(day)}
                    className={`cp-segment-item ${selectedTimetableDay === day ? 'is-active' : ''}`}
                  >
                    {day}
                  </button>
                ))}
              </div>

              <div className="cp-list-bordered">
                {(timetables[selectedTimetableClass]?.[selectedTimetableDay] || []).map((slot, idx) => (
                  <div key={idx} className="cp-row">
                    <span className="cp-row-icon" aria-hidden="true">
                      □
                    </span>
                    <div className="cp-row-content">
                      <div className="cp-row-title flex items-center gap-2 flex-wrap">
                        <span>{slot.time}</span>
                        <span className="cp-badge">{slot.subject}</span>
                      </div>
                      <p className="cp-row-sub">
                        Instructor: {slot.teacher} • Location: {slot.room}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ----------------- CREATION MODAL ----------------- */}
      {isModalOpen && (
        <div className="cp-overlay">
          <div className="cp-modal">
            <div className="cp-modal-header flex items-center justify-between gap-4">
              <div>
                <span className="cp-eyebrow is-tight">Management</span>
                <h2>Create New Timetable Slot</h2>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="cp-icon-btn shrink-0"
                title="Close"
                aria-label="Close"
              >
                <span aria-hidden="true">×</span>
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                addTimetableSlot(selectedTimetableClass, selectedTimetableDay, newSlotForm);
                setIsModalOpen(false);
              }}
            >
              <div className="cp-modal-body space-y-4">
                <div className="cp-field">
                  <label className="cp-label">Time Interval</label>
                  <input
                    type="text"
                    required
                    value={newSlotForm.time}
                    onChange={(e) => setNewSlotForm({ ...newSlotForm, time: e.target.value })}
                    className="cp-input"
                    placeholder="02:30 - 03:30 PM"
                  />
                </div>
                <div className="cp-field">
                  <label className="cp-label">Subject</label>
                  <input
                    type="text"
                    required
                    value={newSlotForm.subject}
                    onChange={(e) => setNewSlotForm({ ...newSlotForm, subject: e.target.value })}
                    className="cp-input"
                    placeholder="Biology Lab"
                  />
                </div>
                <div className="cp-field">
                  <label className="cp-label">Assigned Teacher</label>
                  <select
                    value={newSlotForm.teacher}
                    onChange={(e) => setNewSlotForm({ ...newSlotForm, teacher: e.target.value })}
                    className="cp-select"
                  >
                    {teachers.map((t) => (
                      <option key={t.id} value={t.name}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="cp-modal-footer">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="cp-btn cp-btn-ghost"
                >
                  Cancel
                </button>
                <button type="submit" className="cp-btn cp-btn-primary">
                  Add Slot
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
