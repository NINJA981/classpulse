'use client';

import React, { useState, useEffect } from 'react';
import { useClassPulse } from '../context/ClassPulseContext';
import { ClassroomCard } from './ClassroomCard';

export const ManagementView = () => {
  const {
    classrooms,
    addClassroom,
    deleteClassroom,
    students,
    addStudent,
    deleteStudent,
    teachers,
    addTeacher,
    deleteTeacher,
    timetables,
    addTimetableSlot,
    assignTeacherToClassroom,
    assignStudentToClassroom,
    accessControls,
    toggleUserPermission,
    toggleUserStatus
  } = useClassPulse();

  // Active Tab: 'access' | 'classrooms' | 'teachers' | 'students' | 'timetables'
  const [activeSubTab, setActiveSubTab] = useState('access');
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Selected Classroom ID for Drill-Down Inspection View
  const [selectedClassroomId, setSelectedClassroomId] = useState(null);
  const [selectedTeacherForInline, setSelectedTeacherForInline] = useState(teachers[0]?.id || '');
  const [selectedStudentForInline, setSelectedStudentForInline] = useState(students[0]?.id || '');

  // Deletion Confirmation Modal State
  const [deleteConfirm, setDeleteConfirm] = useState({
    isOpen: false,
    type: null,
    id: null,
    name: ''
  });

  // Enterprise Tab Configuration
  const tabsList = [
    { id: 'access', label: 'Access Control (RBAC)', badge: 'Security' },
    { id: 'classrooms', label: 'Classrooms Directory', count: classrooms.length },
    { id: 'teachers', label: 'Faculty Directory', count: teachers.length },
    { id: 'students', label: 'Student Roster', count: students.length },
    { id: 'timetables', label: 'Schedules & Timetables' }
  ];

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (deleteConfirm.isOpen) {
          setDeleteConfirm({ isOpen: false, type: null, id: null, name: '' });
        } else if (isModalOpen) {
          setIsModalOpen(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen, deleteConfirm.isOpen]);

  // Timetable State
  const [selectedTimetableClass, setSelectedTimetableClass] = useState(classrooms[0]?.name || 'Grade 10-A');
  const [selectedTimetableDay, setSelectedTimetableDay] = useState('Monday');

  // Timetable Slot Form
  const [newSlotForm, setNewSlotForm] = useState({
    time: '02:30 - 03:30 PM',
    subject: 'Biology Lab',
    teacher: teachers[0]?.name || 'Dr. Anitha',
    room: 'Science Lab 2'
  });

  // Form States
  const [classroomForm, setClassroomForm] = useState({
    name: '',
    room: '',
    gradeLevel: 'Grade 10',
    leadTeacher: teachers[0]?.name || 'Dr. Anitha',
    studentCount: 35,
    description: 'General Academic Stream'
  });

  const [studentForm, setStudentForm] = useState({
    name: '',
    rollNo: '',
    className: classrooms[0]?.name || 'Grade 10-A',
    email: '',
    nickname: ''
  });

  const [teacherForm, setTeacherForm] = useState({
    name: '',
    staffId: '',
    department: 'Computer Science',
    email: '',
    assignedClasses: classrooms[0]?.name || 'Grade 10-A'
  });

  const requestDelete = (type, id, name) => {
    setDeleteConfirm({ isOpen: true, type, id, name });
  };

  const executeDelete = () => {
    if (deleteConfirm.type === 'classroom') {
      deleteClassroom(deleteConfirm.id);
      if (selectedClassroomId === deleteConfirm.id) {
        setSelectedClassroomId(null);
      }
    } else if (deleteConfirm.type === 'teacher') {
      deleteTeacher(deleteConfirm.id);
    } else if (deleteConfirm.type === 'student') {
      deleteStudent(deleteConfirm.id);
    }
    setDeleteConfirm({ isOpen: false, type: null, id: null, name: '' });
  };

  const handleInlineTeacherAssign = (e, classroomId) => {
    e.preventDefault();
    if (!selectedTeacherForInline) return;
    assignTeacherToClassroom(classroomId, selectedTeacherForInline);
  };

  const handleInlineStudentAssign = (e, className) => {
    e.preventDefault();
    if (!selectedStudentForInline) return;
    assignStudentToClassroom(selectedStudentForInline, className);
  };

  const handleAddTimetableSlot = (e) => {
    e.preventDefault();
    addTimetableSlot(selectedTimetableClass, selectedTimetableDay, newSlotForm);
    setNewSlotForm({ time: '02:30 - 03:30 PM', subject: '', teacher: teachers[0]?.name || 'Dr. Anitha', room: 'Science Lab 2' });
  };

  const selectedClassroomObj = classrooms.find(c => c.id === selectedClassroomId);

  const activeTabObj = tabsList.find(t => t.id === activeSubTab);

  const handleTabChange = (value) => {
    setActiveSubTab(value);
    if (value !== 'classrooms') setSelectedClassroomId(null);
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

  const modalTitle =
    activeSubTab === 'classrooms' ? 'Classroom' : activeSubTab === 'students' ? 'Student' : activeSubTab === 'teachers' ? 'Teacher' : 'Timetable Slot';

  return (
    <>
      {/* Executive Header */}
      <section className="cp-page-header">
          <div>
            <span className="cp-eyebrow">
              Executive Administration <span className="text-muted-2">• Live Service</span>
            </span>
            <h1 className="cp-display">System Operations & Control</h1>
            <p className="cp-lead">
              Central executive control for user privileges, classroom streams, faculty assignments, student rosters, and timetables.
            </p>
          </div>
          <div className="cp-page-actions">
            <span className="cp-badge is-ink">
              Active Section: {activeTabObj?.label}
            </span>
          </div>
      </section>

      {/* System Overview Metrics Row */}
      <section className="cp-grid-3">
          <div className="cp-stat">
            <div className="cp-stat-top">
              <span className="cp-icon-box" aria-hidden="true">▣</span>
              <span className="cp-badge">Active</span>
            </div>
            <span className="cp-stat-label">Classrooms Managed</span>
            <span className="cp-stat-value">{classrooms.length}</span>
          </div>
          <div className="cp-stat">
            <div className="cp-stat-top">
              <span className="cp-icon-box" aria-hidden="true">□</span>
              <span className="cp-badge">Verified</span>
            </div>
            <span className="cp-stat-label">Faculty Members</span>
            <span className="cp-stat-value">{teachers.length}</span>
          </div>
          <div className="cp-stat">
            <div className="cp-stat-top">
              <span className="cp-icon-box" aria-hidden="true">□</span>
              <span className="cp-badge">Roster</span>
            </div>
            <span className="cp-stat-label">Enrolled Students</span>
            <span className="cp-stat-value">{students.length}</span>
          </div>
      </section>

      {/* Section Controller: index tabs + select, followed by the active section */}
      <section className="cp-stack">
          <div className="cp-tabs hidden md:flex">
            {tabsList.map((tab) => {
              return (
                <button
                  key={tab.id}
                  type="button"
                  aria-current={activeSubTab === tab.id ? 'page' : undefined}
                  onClick={() => handleTabChange(tab.id)}
                  className={`cp-tab ${activeSubTab === tab.id ? 'is-active' : ''}`}
                >
                  <span>{tab.label}</span>
                  {tab.count !== undefined && <span className="cp-badge">{tab.count}</span>}
                  {tab.badge && <span className="cp-badge is-ink">{tab.badge}</span>}
                </button>
              );
            })}
          </div>

          <div className="cp-field max-w-md md:hidden">
            <label className="cp-label" htmlFor="admin-view-select">
              Select Admin View:
            </label>
            <select
              id="admin-view-select"
              value={activeSubTab}
              onChange={(e) => handleTabChange(e.target.value)}
              className="cp-select is-sm"
            >
              {tabsList.map((tab) => (
                <option key={tab.id} value={tab.id}>
                  {tab.label} {tab.count !== undefined ? `(${tab.count})` : ''}
                </option>
              ))}
            </select>
          </div>

      {/* ----------------- SECTION 1: ACCESS CONTROL (RBAC MATRIX) ----------------- */}
      {activeSubTab === 'access' && (
        <div className="cp-panel">
          <div className="cp-panel-header">
            <div>
              <span className="cp-eyebrow is-tight">Security</span>
              <h3>
                Role-Based Access Control (RBAC) Matrix
              </h3>
              <p className="cp-caption mt-1">
                Configure feature privileges across Admin, Teacher, and Student user roles.
              </p>
            </div>
            <span className="cp-badge is-ink">Security Enforced</span>
          </div>

          <div className="cp-table-wrap">
            <table className="cp-table">
              <thead>
                <tr>
                  <th>Permission Capability</th>
                  <th className="text-center">🔐 Admin</th>
                  <th className="text-center">👨‍🏫 Teacher</th>
                  <th className="text-center">🎓 Student</th>
                </tr>
              </thead>
              <tbody>
                {permissionRows.map((perm) => (
                  <tr key={perm.key}>
                    <td className="font-bold text-ink">{perm.label}</td>
                    {['Admin', 'Teacher', 'Student'].map((role) => {
                      const isGranted = accessControls.roles[role]?.permissions[perm.key];
                      return (
                        <td key={role} className="text-center">
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

      {/* ----------------- SECTION 2: CLASSROOMS DIRECTORY ----------------- */}
      {activeSubTab === 'classrooms' && (
        <div className="cp-stack">
          {!selectedClassroomId && (
            <div className="cp-stack">
              {/* Classroom Directory heading + action bar */}
              <div className="cp-section-heading flex-wrap gap-4">
                <div>
                  <span className="cp-eyebrow">Directory</span>
                  <h2>Classrooms Directory</h2>
                </div>
                <div className="flex items-center gap-4">
                  <div className="cp-caption">
                    Showing <strong className="text-ink">{classrooms.length}</strong> classrooms
                  </div>
                  <button
                    onClick={() => setIsModalOpen(true)}
                    className="cp-btn cp-btn-primary shrink-0"
                  >
                    <span aria-hidden="true">＋</span>
                    <span>Add Classroom</span>
                  </button>
                </div>
              </div>

              <div className="cp-card">
                <div className="cp-field max-w-md">
                  <input
                    type="text"
                    aria-label="Search classrooms by name or room number"
                    placeholder="Search classrooms by name or room number..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="cp-input"
                  />
                </div>
              </div>

              <div className="cp-grid-3">
                {classrooms
                  .filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()) || c.room.toLowerCase().includes(searchTerm.toLowerCase()))
                  .map((cls) => (
                    <ClassroomCard
                      key={cls.id}
                      classroom={cls}
                      enrolledCount={students.filter(s => s.className === cls.name).length}
                      onOpen={() => setSelectedClassroomId(cls.id)}
                      onDelete={() => requestDelete('classroom', cls.id, cls.name)}
                      actionLabel="Inspect Roster & Lead Teacher"
                    />
                  ))}
              </div>
            </div>
          )}

          {/* Drill-down View */}
          {selectedClassroomId && selectedClassroomObj && (
            <div className="cp-stack">
              <div className="cp-section-heading flex-wrap gap-4">
                <button
                  onClick={() => setSelectedClassroomId(null)}
                  className="cp-btn cp-btn-ghost cp-btn-sm"
                >
                  <span aria-hidden="true">←</span>
                  <span>Back to Classrooms Grid</span>
                </button>

                <div className="cp-field flex-row items-center gap-3">
                  <label className="cp-label mb-0 shrink-0" htmlFor="switch-stream-select">Switch Stream:</label>
                  <select
                    id="switch-stream-select"
                    value={selectedClassroomId}
                    onChange={(e) => setSelectedClassroomId(e.target.value)}
                    className="cp-select is-sm"
                  >
                    {classrooms.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.room})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="cp-panel">
                <div className="cp-panel-header flex-wrap items-start justify-between gap-4">
                  <div>
                    <span className="cp-eyebrow is-tight">Classroom Inspection</span>
                    <h3 className="text-xl font-black text-ink tracking-tight">
                      🎓 Enrolled Roster for {selectedClassroomObj.name} <span className="font-normal text-muted">({selectedClassroomObj.room})</span>
                    </h3>
                    <p className="cp-caption text-secondary mt-1">
                      {selectedClassroomObj.gradeLevel} · {selectedClassroomObj.description || 'Academic Stream'} · {students.filter(s => s.className === selectedClassroomObj.name).length} Enrolled Students
                    </p>
                  </div>

                  {/* Lead Instructor Details */}
                  {(() => {
                    const leadTeacherObj = teachers.find(t => t.name === selectedClassroomObj.leadTeacher) || {
                      name: selectedClassroomObj.leadTeacher || 'Unassigned',
                      department: 'Academic Faculty',
                      staffId: 'FAC-101',
                      email: `${(selectedClassroomObj.leadTeacher || 'faculty').toLowerCase().replace(/[^a-z]/g, '')}@classpulse.edu`
                    };

                    return (
                      <div className="border border-border-strong bg-surface-sunken p-3.5 flex items-center gap-3.5 shadow-hard-sm">
                        <div className="cp-avatar w-10 h-10 text-sm font-black shrink-0" aria-hidden="true">
                          {leadTeacherObj.name ? leadTeacherObj.name.replace(/^(Dr\.|Prof\.|Mr\.|Ms\.)\s*/, '')[0] || 'T' : 'T'}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="cp-eyebrow text-muted text-[8px]">Lead Instructor</span>
                            <span className="cp-badge is-ink text-[7px] py-0 px-1.5">FACULTY IN-CHARGE</span>
                          </div>
                          <div className="text-sm font-black text-primary tracking-tight">
                            {leadTeacherObj.name}
                          </div>
                          <div className="text-[10px] text-secondary font-mono mt-0.5 flex flex-wrap items-center gap-2">
                            <span>ID: {leadTeacherObj.staffId}</span>
                            <span>•</span>
                            <span>{leadTeacherObj.department}</span>
                            <span>•</span>
                            <span className="text-muted">{leadTeacherObj.email}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
                <div className="cp-table-wrap">
                  <table className="cp-table">
                    <thead>
                      <tr>
                        <th>Roll No</th>
                        <th>Student Name</th>
                        <th>Email</th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.filter(s => s.className === selectedClassroomObj.name).map((s) => (
                        <tr key={s.id}>
                          <td className="font-bold text-ink tracking-label">{s.rollNo}</td>
                          <td className="font-bold text-ink">{s.name}</td>
                          <td className="text-muted">{s.email}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ----------------- SECTION 3: FACULTY DIRECTORY ----------------- */}
      {activeSubTab === 'teachers' && (
        <div className="cp-stack">
          {/* Faculty Directory heading + action bar */}
          <div className="cp-section-heading flex-wrap gap-4">
            <div>
              <span className="cp-eyebrow">Directory</span>
              <h2>Faculty Directory</h2>
            </div>
            <div className="flex items-center gap-4">
              <div className="cp-caption">
                Total Faculty: <strong className="text-ink">{teachers.length}</strong>
              </div>
              <button
                onClick={() => setIsModalOpen(true)}
                className="cp-btn cp-btn-primary shrink-0"
              >
                <span aria-hidden="true">＋</span>
                <span>Add Teacher</span>
              </button>
            </div>
          </div>

          <div className="cp-card">
            <div className="cp-field max-w-md">
              <input
                type="text"
                aria-label="Search faculty members by name or department"
                placeholder="Search faculty members by name or department..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="cp-input"
              />
            </div>
          </div>

          <div className="cp-grid-3">
            {teachers
              .filter(t => t.name.toLowerCase().includes(searchTerm.toLowerCase()) || t.department.toLowerCase().includes(searchTerm.toLowerCase()))
              .map((t) => (
                <div key={t.id} className="cp-card space-y-4">
                  <div className="flex items-start justify-between gap-3 pb-4 border-b border-line-faint">
                    <div className="flex items-center gap-3">
                      <div className="cp-row-icon font-black text-body">
                        {t.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div>
                        <h3 className="cp-h4">{t.name}</h3>
                        <span className="cp-caption-2 tracking-label">{t.staffId}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => requestDelete('teacher', t.id, t.name)}
                      className="cp-icon-btn shrink-0"
                      title="Delete Teacher"
                      aria-label="Delete Teacher"
                    >
                      <span aria-hidden="true">×</span>
                    </button>
                  </div>

                  <div>
                    <div className="cp-kv">
                      <span>Department:</span>
                      <strong className="cp-badge">{t.department}</strong>
                    </div>
                    <div className="cp-kv">
                      <span>Email:</span>
                      <strong className="text-ink">{t.email}</strong>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* ----------------- SECTION 4: STUDENT ROSTER DIRECTORY ----------------- */}
      {activeSubTab === 'students' && (
        <div className="cp-panel">
          <div className="cp-panel-header flex-wrap">
            <div>
              <span className="cp-eyebrow is-tight">Roster</span>
              <h3>
                Student Roster Registry ({students.length} Accounts)
              </h3>
              <p className="cp-caption mt-1">Active student profile listings across all classroom streams.</p>
            </div>
            <button
              onClick={() => setIsModalOpen(true)}
              className="cp-btn cp-btn-primary shrink-0"
            >
              <span aria-hidden="true">＋</span>
              <span>Add Student</span>
            </button>
          </div>

          <div className="cp-table-wrap">
            <table className="cp-table">
              <thead>
                <tr>
                  <th>Roll No</th>
                  <th>Student Name</th>
                  <th>Assigned Stream</th>
                  <th>Email Address</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s) => (
                  <tr key={s.id}>
                    <td className="font-bold text-ink tracking-label">{s.rollNo}</td>
                    <td className="font-bold text-ink">{s.name}</td>
                    <td>
                      <span className="cp-badge">{s.className}</span>
                    </td>
                    <td className="text-muted">{s.email}</td>
                    <td className="text-right">
                      <button
                        onClick={() => requestDelete('student', s.id, s.name)}
                        className="cp-btn cp-btn-ghost cp-btn-sm"
                        title="Delete Student"
                        aria-label="Delete Student"
                      >
                        <span aria-hidden="true">×</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ----------------- SECTION 5: TIMETABLE & SCHEDULES ----------------- */}
      {activeSubTab === 'timetables' && (
        <div className="cp-panel">
          {/* Top Timetable Header with Stream Selector & Add Slot Button */}
          <div className="cp-panel-header flex-wrap">
            <div>
              <span className="cp-eyebrow is-tight">Schedules</span>
              <h3>
                Schedule Management: {selectedTimetableClass}
              </h3>
            </div>

            <div className="flex items-end gap-4 flex-wrap">
              <div className="cp-field">
                <label className="cp-label" htmlFor="timetable-stream-select">Select Stream:</label>
                <select
                  id="timetable-stream-select"
                  value={selectedTimetableClass}
                  onChange={(e) => setSelectedTimetableClass(e.target.value)}
                  className="cp-select is-sm"
                >
                  {classrooms.map(c => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>

              <button
                onClick={() => setIsModalOpen(true)}
                className="cp-btn cp-btn-primary shrink-0"
              >
                <span aria-hidden="true">＋</span>
                <span>Add Timetable Slot</span>
              </button>
            </div>
          </div>

          <div className="cp-stack">
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
                  <span className="cp-row-icon" aria-hidden="true">□</span>
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
                <h2>Create New {modalTitle}</h2>
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

            {activeSubTab === 'classrooms' && (
              <form onSubmit={(e) => {
                e.preventDefault();
                addClassroom(classroomForm);
                setIsModalOpen(false);
              }}>
                <div className="cp-modal-body space-y-4">
                  <div className="cp-field">
                    <label className="cp-label">Classroom Stream Name</label>
                    <input
                      type="text"
                      required
                      value={classroomForm.name}
                      onChange={(e) => setClassroomForm({...classroomForm, name: e.target.value})}
                      className="cp-input"
                      placeholder="Grade 10-C"
                    />
                  </div>
                  <div className="cp-field">
                    <label className="cp-label">Room / Location</label>
                    <input
                      type="text"
                      required
                      value={classroomForm.room}
                      onChange={(e) => setClassroomForm({...classroomForm, room: e.target.value})}
                      className="cp-input"
                      placeholder="Room 402"
                    />
                  </div>
                  <div className="cp-field">
                    <label className="cp-label">Lead Teacher</label>
                    <select
                      value={classroomForm.leadTeacher}
                      onChange={(e) => setClassroomForm({...classroomForm, leadTeacher: e.target.value})}
                      className="cp-select"
                    >
                      {teachers.map(t => (
                        <option key={t.id} value={t.name}>{t.name} ({t.department})</option>
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
                  <button
                    type="submit"
                    className="cp-btn cp-btn-primary"
                  >
                    Save Classroom
                  </button>
                </div>
              </form>
            )}

            {activeSubTab === 'students' && (
              <form onSubmit={(e) => {
                e.preventDefault();
                addStudent(studentForm);
                setIsModalOpen(false);
              }}>
                <div className="cp-modal-body space-y-4">
                  <div className="cp-field">
                    <label className="cp-label">Student Full Name</label>
                    <input
                      type="text"
                      required
                      value={studentForm.name}
                      onChange={(e) => setStudentForm({...studentForm, name: e.target.value})}
                      className="cp-input"
                      placeholder="Rohan Sharma"
                    />
                  </div>
                  <div className="cp-field">
                    <label className="cp-label">Roll No</label>
                    <input
                      type="text"
                      required
                      value={studentForm.rollNo}
                      onChange={(e) => setStudentForm({...studentForm, rollNo: e.target.value})}
                      className="cp-input"
                      placeholder="STU-1005"
                    />
                  </div>
                  <div className="cp-field">
                    <label className="cp-label">Assigned Stream</label>
                    <select
                      value={studentForm.className}
                      onChange={(e) => setStudentForm({...studentForm, className: e.target.value})}
                      className="cp-select"
                    >
                      {classrooms.map(c => (
                        <option key={c.id} value={c.name}>{c.name}</option>
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
                  <button
                    type="submit"
                    className="cp-btn cp-btn-primary"
                  >
                    Save Student
                  </button>
                </div>
              </form>
            )}

            {activeSubTab === 'teachers' && (
              <form onSubmit={(e) => {
                e.preventDefault();
                addTeacher(teacherForm);
                setIsModalOpen(false);
              }}>
                <div className="cp-modal-body space-y-4">
                  <div className="cp-field">
                    <label className="cp-label">Teacher Full Name</label>
                    <input
                      type="text"
                      required
                      value={teacherForm.name}
                      onChange={(e) => setTeacherForm({...teacherForm, name: e.target.value})}
                      className="cp-input"
                      placeholder="Dr. Anitha"
                    />
                  </div>
                  <div className="cp-field">
                    <label className="cp-label">Staff ID</label>
                    <input
                      type="text"
                      required
                      value={teacherForm.staffId}
                      onChange={(e) => setTeacherForm({...teacherForm, staffId: e.target.value})}
                      className="cp-input"
                      placeholder="TCH-505"
                    />
                  </div>
                  <div className="cp-field">
                    <label className="cp-label">Department</label>
                    <input
                      type="text"
                      required
                      value={teacherForm.department}
                      onChange={(e) => setTeacherForm({...teacherForm, department: e.target.value})}
                      className="cp-input"
                      placeholder="Computer Science"
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
                  <button
                    type="submit"
                    className="cp-btn cp-btn-primary"
                  >
                    Save Teacher
                  </button>
                </div>
              </form>
            )}

            {activeSubTab === 'timetables' && (
              <form onSubmit={(e) => {
                e.preventDefault();
                addTimetableSlot(selectedTimetableClass, selectedTimetableDay, newSlotForm);
                setIsModalOpen(false);
              }}>
                <div className="cp-modal-body space-y-4">
                  <div className="cp-field">
                    <label className="cp-label">Time Interval</label>
                    <input
                      type="text"
                      required
                      value={newSlotForm.time}
                      onChange={(e) => setNewSlotForm({...newSlotForm, time: e.target.value})}
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
                      onChange={(e) => setNewSlotForm({...newSlotForm, subject: e.target.value})}
                      className="cp-input"
                      placeholder="Biology Lab"
                    />
                  </div>
                  <div className="cp-field">
                    <label className="cp-label">Assigned Teacher</label>
                    <select
                      value={newSlotForm.teacher}
                      onChange={(e) => setNewSlotForm({...newSlotForm, teacher: e.target.value})}
                      className="cp-select"
                    >
                      {teachers.map(t => (
                        <option key={t.id} value={t.name}>{t.name}</option>
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
                  <button
                    type="submit"
                    className="cp-btn cp-btn-primary"
                  >
                    Add Slot
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ----------------- DELETION CONFIRMATION MODAL ----------------- */}
      {deleteConfirm.isOpen && (
        <div className="cp-overlay">
          <div className="cp-modal">
            <div className="cp-modal-header">
              <div>
                <span className="cp-eyebrow is-tight">Destructive action</span>
                <h2>
                  Confirm Deletion
                </h2>
              </div>
            </div>
            <div className="cp-modal-body">
              <p className="cp-lead text-ink">
                Are you sure you want to delete <strong className="font-black">{deleteConfirm.name}</strong>?
              </p>
            </div>
            <div className="cp-modal-footer">
              <button
                onClick={() => setDeleteConfirm({ isOpen: false, type: null, id: null, name: '' })}
                className="cp-btn cp-btn-ghost"
              >
                Cancel
              </button>
              <button
                onClick={executeDelete}
                className="cp-btn cp-btn-danger"
              >
                Delete Resource
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
