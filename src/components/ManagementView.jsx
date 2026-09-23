'use client';

import React, { useState, useEffect } from 'react';
import { useClassPulse } from '../context/ClassPulseContext';

export const ManagementView = () => {
  const {
    classrooms,
    teachers,
    timetables,
    addTimetableSlot,
    adminSubTab = 'access',
    accessControls,
    toggleUserPermission
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
  const [selectedTimetableClass, setSelectedTimetableClass] = useState(classrooms[0]?.name || 'Grade 10-A');
  const [selectedTimetableDay, setSelectedTimetableDay] = useState('Monday');

  // Timetable Slot Form
  const [newSlotForm, setNewSlotForm] = useState({
    time: '02:30 - 03:30 PM',
    subject: 'Biology Lab',
    teacher: teachers[0]?.name || 'Dr. Anitha',
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

  return (
    <>
      <section className="space-y-4">
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
