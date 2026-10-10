'use client';

import React, { useState, useEffect, useMemo } from 'react';
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
  Sparkles,
  Pencil,
  Trash2,
  UserCheck,
  Plus
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
    updateTimetableSlot,
    deleteTimetableSlot,
    timetableMode,
    setTimetableMode,
    selectedFacultyTimetable,
    setSelectedFacultyTimetable,
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
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState(null);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (isModalOpen) setIsModalOpen(false);
        if (isEditModalOpen) setIsEditModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen, isEditModalOpen]);

  // Timetable State
  const [activeTimetableMode, setActiveTimetableMode] = useState(timetableMode || 'classroom'); // 'classroom' | 'faculty'
  const [selectedTimetableClass, setSelectedTimetableClass] = useState(classrooms[0]?.name || 'Class 12-A');
  const [selectedTeacher, setSelectedTeacher] = useState(selectedFacultyTimetable || teachers[0]?.name || 'Demo Teacher');
  const [selectedTimetableDay, setSelectedTimetableDay] = useState('Monday');

  useEffect(() => {
    if (selectedFacultyTimetable) {
      setSelectedTeacher(selectedFacultyTimetable);
      setActiveTimetableMode('faculty');
    }
  }, [selectedFacultyTimetable]);

  useEffect(() => {
    if (classrooms.length > 0 && !classrooms.some(c => c.name === selectedTimetableClass)) {
      setSelectedTimetableClass(classrooms[0].name);
    }
  }, [classrooms, selectedTimetableClass]);

  useEffect(() => {
    if (teachers.length > 0 && (!selectedTeacher || !teachers.some(t => t.name === selectedTeacher))) {
      setSelectedTeacher(teachers[0].name);
    }
  }, [teachers, selectedTeacher]);

  // Timetable Slot Form (Create)
  const [newSlotForm, setNewSlotForm] = useState({
    time: '02:30 - 03:30 PM',
    subject: courses[0]?.title || 'Mathematics XII',
    teacher: teachers[0]?.name || 'Demo Teacher',
    className: classrooms[0]?.name || 'Class 12-A',
    day: 'Monday',
    room: 'Science Lab 2'
  });

  // Timetable Slot Form (Edit)
  const [editSlotForm, setEditSlotForm] = useState({
    time: '',
    subject: '',
    teacher: '',
    className: '',
    day: 'Monday',
    room: ''
  });

  const currentSlots = useMemo(() => {
    if (activeTimetableMode === 'faculty') {
      if (!selectedTeacher) return [];
      const list = [];
      Object.entries(timetables || {}).forEach(([className, days]) => {
        const daySlots = days?.[selectedTimetableDay] || [];
        daySlots.forEach((slot, slotIndex) => {
          if (
            slot.teacher?.toLowerCase() === selectedTeacher?.toLowerCase() ||
            slot.teacher?.toLowerCase().includes(selectedTeacher?.toLowerCase())
          ) {
            list.push({
              ...slot,
              className,
              slotIndex
            });
          }
        });
      });
      return list;
    } else {
      return (timetables[selectedTimetableClass]?.[selectedTimetableDay] || []).map((slot, slotIndex) => ({
        ...slot,
        className: selectedTimetableClass,
        slotIndex
      }));
    }
  }, [activeTimetableMode, selectedTeacher, selectedTimetableClass, selectedTimetableDay, timetables]);

  const handleOpenEdit = (slot) => {
    setEditingSlot(slot);
    setEditSlotForm({
      time: slot.time || '09:00 - 10:00 AM',
      subject: slot.subject || (courses[0]?.title || 'Mathematics XII'),
      teacher: slot.teacher || (teachers[0]?.name || 'Demo Teacher'),
      className: slot.className || selectedTimetableClass,
      day: selectedTimetableDay,
      room: slot.room || 'Science Lab 2'
    });
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = (e) => {
    e.preventDefault();
    if (editingSlot) {
      if (editSlotForm.className === editingSlot.className) {
        updateTimetableSlot(editingSlot.className, selectedTimetableDay, editingSlot.slotIndex, {
          time: editSlotForm.time,
          subject: editSlotForm.subject,
          teacher: editSlotForm.teacher,
          room: editSlotForm.room
        });
      } else {
        deleteTimetableSlot(editingSlot.className, selectedTimetableDay, editingSlot.slotIndex);
        addTimetableSlot(editSlotForm.className, selectedTimetableDay, {
          time: editSlotForm.time,
          subject: editSlotForm.subject,
          teacher: editSlotForm.teacher,
          room: editSlotForm.room
        });
      }
    }
    setIsEditModalOpen(false);
    setEditingSlot(null);
  };

  const handleDeleteSlot = (slot) => {
    if (window.confirm(`Remove ${slot.subject} (${slot.time}) taught by ${slot.teacher} from ${slot.className}?`)) {
      deleteTimetableSlot(slot.className, selectedTimetableDay, slot.slotIndex);
    }
  };

  const handleCreateSlot = (e) => {
    e.preventDefault();
    const targetClass = newSlotForm.className || selectedTimetableClass;
    addTimetableSlot(targetClass, selectedTimetableDay, {
      time: newSlotForm.time,
      subject: newSlotForm.subject,
      teacher: newSlotForm.teacher,
      room: newSlotForm.room
    });
    setIsModalOpen(false);
  };

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
            {/* Top Timetable Header */}
            <div className="flex flex-wrap items-center justify-between gap-4 p-4 border-b border-border bg-surface">
              <div>
                <div className="flex items-center gap-2">
                  <span className="cp-eyebrow">Schedules & Timetable Matrix</span>
                  <span className="cp-badge bg-emerald-100 text-emerald-900 border border-emerald-300 text-[10px]">
                    LIVE SYNCED
                  </span>
                </div>
                <h3 className="cp-h3 mt-0.5">
                  {activeTimetableMode === 'faculty'
                    ? `Faculty Teaching Schedule: ${selectedTeacher || 'Instructor'}`
                    : `Classroom Cohort Schedule: ${selectedTimetableClass || 'Section'}`}
                </h3>
              </div>

              {/* Mode Toggle & Selectors */}
              <div className="flex items-center gap-3 flex-wrap">
                {/* View Mode Toggle: Classroom vs Faculty */}
                <div className="inline-flex border border-border p-0.5 bg-surface-sunken">
                  <button
                    type="button"
                    onClick={() => setActiveTimetableMode('classroom')}
                    className={`px-3 py-1 text-xs font-bold transition-colors ${
                      activeTimetableMode === 'classroom'
                        ? 'bg-ink text-white shadow-sm'
                        : 'text-secondary hover:text-ink'
                    }`}
                  >
                    Classroom View
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTimetableMode('faculty')}
                    className={`px-3 py-1 text-xs font-bold transition-colors ${
                      activeTimetableMode === 'faculty'
                        ? 'bg-ink text-white shadow-sm'
                        : 'text-secondary hover:text-ink'
                    }`}
                  >
                    Faculty View
                  </button>
                </div>

                {/* Selector based on active mode */}
                {activeTimetableMode === 'classroom' ? (
                  <div className="flex items-center gap-2">
                    <label className="cp-label text-[10px] text-muted whitespace-nowrap" htmlFor="timetable-stream-select">
                      Classroom:
                    </label>
                    <select
                      id="timetable-stream-select"
                      value={selectedTimetableClass}
                      onChange={(e) => setSelectedTimetableClass(e.target.value)}
                      className="cp-select text-xs py-1 px-3 h-8 font-bold"
                    >
                      {classrooms.map((c) => (
                        <option key={c.id} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <label className="cp-label text-[10px] text-muted whitespace-nowrap" htmlFor="timetable-teacher-select">
                      Instructor:
                    </label>
                    <select
                      id="timetable-teacher-select"
                      value={selectedTeacher}
                      onChange={(e) => setSelectedTeacher(e.target.value)}
                      className="cp-select text-xs py-1 px-3 h-8 font-bold"
                    >
                      {teachers.map((t) => (
                        <option key={t.id} value={t.name}>
                          {t.name} ({t.department || 'Faculty'})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <button
                  onClick={() => {
                    setNewSlotForm({
                      time: '02:30 - 03:30 PM',
                      subject: courses[0]?.title || 'Mathematics XII',
                      teacher: activeTimetableMode === 'faculty' ? selectedTeacher : (teachers[0]?.name || 'Demo Teacher'),
                      className: activeTimetableMode === 'classroom' ? selectedTimetableClass : (classrooms[0]?.name || 'Class 12-A'),
                      day: selectedTimetableDay,
                      room: 'Science Lab 2'
                    });
                    setIsModalOpen(true);
                  }}
                  className="cp-btn cp-btn-primary min-h-0 h-8 px-3 text-xs shrink-0 flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{activeTimetableMode === 'faculty' ? 'Assign Teaching Slot' : 'Add Timetable Slot'}</span>
                </button>
              </div>
            </div>

            <div className="p-4 space-y-4">
              {/* Day Segment */}
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

              {/* Slots List */}
              <div className="space-y-2">
                {currentSlots.length === 0 ? (
                  <div className="p-8 text-center border border-dashed border-border bg-surface-sunken">
                    <p className="text-xs font-bold text-ink">
                      {activeTimetableMode === 'faculty'
                        ? `No teaching periods assigned to ${selectedTeacher} on ${selectedTimetableDay}.`
                        : `No timetable slots scheduled for ${selectedTimetableClass} on ${selectedTimetableDay}.`}
                    </p>
                    <p className="text-[11px] mt-1 text-secondary">
                      Click the button above to assign and update periods for this {activeTimetableMode === 'faculty' ? 'instructor' : 'cohort'}.
                    </p>
                  </div>
                ) : (
                  currentSlots.map((slot, idx) => (
                    <div
                      key={idx}
                      className="border border-border bg-surface p-3 flex flex-wrap items-center justify-between gap-3 hover:border-ink transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-7 h-7 bg-surface-sunken border border-border flex items-center justify-center font-mono font-bold text-xs shrink-0">
                          {idx + 1}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-bold text-xs text-ink">{slot.time}</span>
                            <span className="cp-badge bg-surface-sunken border border-border font-bold">
                              {slot.subject}
                            </span>
                            {activeTimetableMode === 'faculty' ? (
                              <span className="cp-badge bg-blue-50 text-blue-900 border border-blue-200 font-bold">
                                Cohort: {slot.className}
                              </span>
                            ) : (
                              <span className="cp-badge bg-amber-50 text-amber-900 border border-amber-200 font-bold">
                                Instructor: {slot.teacher}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-secondary mt-1">
                            {activeTimetableMode === 'faculty'
                              ? `Location: ${slot.room} • Section: ${slot.className}`
                              : `Instructor: ${slot.teacher} • Location: ${slot.room}`}
                          </p>
                        </div>
                      </div>

                      {/* Action buttons on slot */}
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(slot)}
                          className="cp-btn cp-btn-ghost h-7 px-2.5 text-xs flex items-center gap-1.5 border border-border hover:bg-surface-sunken"
                          title="Edit & update this timetable slot"
                        >
                          <Pencil className="w-3 h-3 text-secondary" />
                          <span>Edit Slot</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteSlot(slot)}
                          className="cp-btn cp-btn-ghost h-7 px-2 text-xs flex items-center gap-1 border border-red-200 text-red-700 hover:bg-red-50"
                          title="Remove this timetable slot"
                        >
                          <Trash2 className="w-3 h-3 text-red-600" />
                          <span>Delete</span>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ----------------- CREATION MODAL ----------------- */}
      {isModalOpen && (
        <div className="cp-overlay">
          <div className="cp-modal max-w-md">
            <div className="cp-modal-header flex items-center justify-between gap-4">
              <div>
                <span className="cp-eyebrow is-tight">Timetable Management</span>
                <h2 className="text-base font-bold text-ink">
                  {activeTimetableMode === 'faculty'
                    ? `Assign Teaching Slot to ${selectedTeacher}`
                    : `Add Slot to ${selectedTimetableClass}`}
                </h2>
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

            <form onSubmit={handleCreateSlot}>
              <div className="cp-modal-body space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="cp-field">
                    <label className="cp-label">Day of Week</label>
                    <select
                      value={selectedTimetableDay}
                      onChange={(e) => setSelectedTimetableDay(e.target.value)}
                      className="cp-select text-xs"
                    >
                      {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="cp-field">
                    <label className="cp-label">Target Cohort / Section</label>
                    <select
                      value={newSlotForm.className || selectedTimetableClass}
                      onChange={(e) => setNewSlotForm({ ...newSlotForm, className: e.target.value })}
                      className="cp-select text-xs"
                    >
                      {classrooms.map((c) => (
                        <option key={c.id} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="cp-field">
                  <label className="cp-label">Time Interval</label>
                  <input
                    type="text"
                    required
                    value={newSlotForm.time}
                    onChange={(e) => setNewSlotForm({ ...newSlotForm, time: e.target.value })}
                    className="cp-input text-xs"
                    placeholder="09:00 - 10:00 AM"
                  />
                </div>

                <div className="cp-field">
                  <label className="cp-label">Subject / Course</label>
                  <select
                    value={newSlotForm.subject}
                    onChange={(e) => setNewSlotForm({ ...newSlotForm, subject: e.target.value })}
                    className="cp-select text-xs"
                  >
                    {courses.map((c) => (
                      <option key={c.id} value={c.title}>
                        {c.title} ({c.code})
                      </option>
                    ))}
                    <option value="Physics Lab 1">Physics Lab</option>
                    <option value="Biology Lab">Biology Lab</option>
                    <option value="Computer Science Lab">Computer Science Lab</option>
                  </select>
                </div>

                <div className="cp-field">
                  <label className="cp-label">Assigned Faculty Instructor</label>
                  <select
                    value={newSlotForm.teacher}
                    onChange={(e) => setNewSlotForm({ ...newSlotForm, teacher: e.target.value })}
                    className="cp-select text-xs"
                  >
                    {teachers.map((t) => (
                      <option key={t.id} value={t.name}>
                        {t.name} ({t.department || 'Faculty'})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="cp-field">
                  <label className="cp-label">Room / Laboratory</label>
                  <input
                    type="text"
                    required
                    value={newSlotForm.room}
                    onChange={(e) => setNewSlotForm({ ...newSlotForm, room: e.target.value })}
                    className="cp-input text-xs"
                    placeholder="Science Lab 2"
                  />
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
                  Save Slot
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ----------------- EDIT / UPDATE MODAL ----------------- */}
      {isEditModalOpen && (
        <div className="cp-overlay">
          <div className="cp-modal max-w-md">
            <div className="cp-modal-header flex items-center justify-between gap-4">
              <div>
                <span className="cp-eyebrow is-tight">Timetable Management</span>
                <h2 className="text-base font-bold text-ink">Update Timetable Slot</h2>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="cp-icon-btn shrink-0"
                title="Close"
                aria-label="Close"
              >
                <span aria-hidden="true">×</span>
              </button>
            </div>

            <form onSubmit={handleSaveEdit}>
              <div className="cp-modal-body space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="cp-field">
                    <label className="cp-label">Day of Week</label>
                    <input
                      type="text"
                      disabled
                      value={selectedTimetableDay}
                      className="cp-input text-xs bg-surface-sunken"
                    />
                  </div>
                  <div className="cp-field">
                    <label className="cp-label">Assigned Cohort</label>
                    <select
                      value={editSlotForm.className}
                      onChange={(e) => setEditSlotForm({ ...editSlotForm, className: e.target.value })}
                      className="cp-select text-xs"
                    >
                      {classrooms.map((c) => (
                        <option key={c.id} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="cp-field">
                  <label className="cp-label">Time Interval</label>
                  <input
                    type="text"
                    required
                    value={editSlotForm.time}
                    onChange={(e) => setEditSlotForm({ ...editSlotForm, time: e.target.value })}
                    className="cp-input text-xs"
                    placeholder="09:00 - 10:00 AM"
                  />
                </div>

                <div className="cp-field">
                  <label className="cp-label">Subject / Course</label>
                  <select
                    value={editSlotForm.subject}
                    onChange={(e) => setEditSlotForm({ ...editSlotForm, subject: e.target.value })}
                    className="cp-select text-xs"
                  >
                    {courses.map((c) => (
                      <option key={c.id} value={c.title}>
                        {c.title} ({c.code})
                      </option>
                    ))}
                    <option value="Physics Lab 1">Physics Lab</option>
                    <option value="Biology Lab">Biology Lab</option>
                    <option value="Computer Science Lab">Computer Science Lab</option>
                  </select>
                </div>

                <div className="cp-field">
                  <label className="cp-label">Assigned Faculty Instructor</label>
                  <select
                    value={editSlotForm.teacher}
                    onChange={(e) => setEditSlotForm({ ...editSlotForm, teacher: e.target.value })}
                    className="cp-select text-xs"
                  >
                    {teachers.map((t) => (
                      <option key={t.id} value={t.name}>
                        {t.name} ({t.department || 'Faculty'})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="cp-field">
                  <label className="cp-label">Room / Laboratory</label>
                  <input
                    type="text"
                    required
                    value={editSlotForm.room}
                    onChange={(e) => setEditSlotForm({ ...editSlotForm, room: e.target.value })}
                    className="cp-input text-xs"
                    placeholder="Science Lab 2"
                  />
                </div>
              </div>

              <div className="cp-modal-footer">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="cp-btn cp-btn-ghost"
                >
                  Cancel
                </button>
                <button type="submit" className="cp-btn cp-btn-primary">
                  Update Slot
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
