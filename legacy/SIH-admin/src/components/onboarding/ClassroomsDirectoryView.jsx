'use client';

import React, { useState, useEffect } from 'react';
import { useClassPulse } from '../../context/ClassPulseContext';
import { ClassroomCard } from '../ClassroomCard';

export const ClassroomsDirectoryView = () => {
  const {
    classrooms,
    addClassroom,
    deleteClassroom,
    students,
    teachers,
    courses = []
  } = useClassPulse();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClassroomId, setSelectedClassroomId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, id: null, name: '' });

  const [classroomForm, setClassroomForm] = useState({
    name: '',
    room: '',
    gradeLevel: 'Grade 12',
    courseId: '',
    leadTeacher: '',
    studentCount: 0,
    description: 'General Academic Stream'
  });

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (deleteConfirm.isOpen) setDeleteConfirm({ isOpen: false, id: null, name: '' });
        else if (isModalOpen) setIsModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen, deleteConfirm.isOpen]);

  const requestDelete = (id, name) => {
    setDeleteConfirm({ isOpen: true, id, name });
  };

  const executeDelete = () => {
    deleteClassroom(deleteConfirm.id);
    if (selectedClassroomId === deleteConfirm.id) {
      setSelectedClassroomId(null);
    }
    setDeleteConfirm({ isOpen: false, id: null, name: '' });
  };

  const selectedClassroomObj = classrooms.find((c) => c.id === selectedClassroomId);

  return (
    <div className="space-y-5">
      {!selectedClassroomId && (
        <div className="space-y-4">
          {/* Heading & Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
            <div>
              <span className="cp-eyebrow">Directory</span>
              <h2 className="cp-h2 mt-0.5">Classrooms Directory</h2>
            </div>
            <div className="flex items-center gap-3">
              <div className="cp-caption">
                Showing <strong className="text-ink">{classrooms.length}</strong> classrooms
              </div>
              <button
                onClick={() => setIsModalOpen(true)}
                className="cp-btn cp-btn-primary min-h-0 h-8 px-3 text-xs shrink-0"
              >
                <span aria-hidden="true">＋</span>
                <span>Add Classroom</span>
              </button>
            </div>
          </div>

          <div className="max-w-md">
            <input
              type="text"
              aria-label="Search classrooms by name or room number"
              placeholder="Search classrooms by name or room number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="cp-input"
            />
          </div>

          <div className="cp-grid-3">
            {classrooms
              .filter(
                (c) =>
                  c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  c.room.toLowerCase().includes(searchTerm.toLowerCase())
              )
              .map((cls) => (
                <ClassroomCard
                  key={cls.id}
                  classroom={cls}
                  enrolledCount={students.filter((s) => s.className === cls.name).length}
                  onOpen={() => setSelectedClassroomId(cls.id)}
                  onDelete={() => requestDelete(cls.id, cls.name)}
                  actionLabel="Inspect Roster & Lead Teacher"
                />
              ))}
          </div>
        </div>
      )}

      {/* Drill-down Inspection View */}
      {selectedClassroomId && selectedClassroomObj && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
            <button
              onClick={() => setSelectedClassroomId(null)}
              className="cp-btn cp-btn-ghost cp-btn-sm"
            >
              <span aria-hidden="true">←</span>
              <span>Back to Classrooms Grid</span>
            </button>

            <div className="cp-field flex-row items-center gap-3">
              <label className="cp-label mb-0 shrink-0" htmlFor="switch-stream-select">
                Switch Stream:
              </label>
              <select
                id="switch-stream-select"
                value={selectedClassroomId}
                onChange={(e) => setSelectedClassroomId(e.target.value)}
                className="cp-select is-sm"
              >
                {classrooms.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.room})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="border border-border bg-surface shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4 p-4 border-b border-border bg-surface">
              <div>
                <span className="cp-eyebrow">Classroom Inspection</span>
                <h3 className="cp-h3 mt-0.5">
                  Enrolled Roster: {selectedClassroomObj.name}{' '}
                  <span className="font-normal text-muted">({selectedClassroomObj.room})</span>
                </h3>
                <p className="cp-lead text-secondary text-xs mt-0.5">
                  {selectedClassroomObj.gradeLevel} · {selectedClassroomObj.description || 'Academic Stream'} ·{' '}
                  {students.filter((s) => s.className === selectedClassroomObj.name).length} Enrolled Students
                </p>
              </div>

              {/* Lead Instructor Details */}
              {(() => {
                const leadTeacherObj = teachers.find(
                  (t) => t.name === selectedClassroomObj.leadTeacher
                ) || {
                  name: selectedClassroomObj.leadTeacher || 'Unassigned',
                  department: 'Academic Faculty',
                  staffId: 'FAC-101',
                  email: `${(selectedClassroomObj.leadTeacher || 'faculty').toLowerCase().replace(/[^a-z]/g, '')}@classpulse.edu`
                };

                return (
                  <div className="border border-border bg-surface-sunken p-3 flex items-center gap-3">
                    <div className="cp-avatar w-9 h-9 text-xs font-black shrink-0" aria-hidden="true">
                      {leadTeacherObj.name
                        ? leadTeacherObj.name.replace(/^(Dr\.|Prof\.|Mr\.|Ms\.)\s*/, '')[0] || 'T'
                        : 'T'}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="cp-eyebrow text-muted text-[8px]">Lead Instructor</span>
                        <span className="cp-badge is-ink text-[7px] py-0 px-1.5">FACULTY</span>
                      </div>
                      <div className="text-xs font-black text-primary tracking-tight">
                        {leadTeacherObj.name}
                      </div>
                      <div className="text-[10px] text-secondary font-mono mt-0.5 flex flex-wrap items-center gap-1.5">
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

            <div className="overflow-x-auto">
              <table className="cp-table w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border bg-surface-sunken text-[10px] uppercase font-black tracking-wider text-muted">
                    <th className="py-2.5 px-4">Roll No</th>
                    <th className="py-2.5 px-4">Student Name</th>
                    <th className="py-2.5 px-4">Email</th>
                  </tr>
                </thead>
                <tbody>
                  {students
                    .filter((s) => s.className === selectedClassroomObj.name)
                    .map((s) => (
                      <tr key={s.id} className="border-b border-border-faint last:border-b-0 hover:bg-surface-hover">
                        <td className="py-2.5 px-4 font-mono font-bold text-xs text-primary">{s.rollNo}</td>
                        <td className="py-2.5 px-4 text-xs font-bold text-primary">{s.name}</td>
                        <td className="py-2.5 px-4 text-xs text-muted font-mono">{s.email}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Add Classroom */}
      {isModalOpen && (
        <div className="cp-overlay">
          <div className="cp-modal">
            <div className="cp-modal-header flex items-center justify-between gap-4">
              <div>
                <span className="cp-eyebrow is-tight">Onboarding</span>
                <h2>Create New Classroom</h2>
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
                addClassroom(classroomForm);
                setIsModalOpen(false);
              }}
            >
              <div className="cp-modal-body space-y-4">
                <div className="cp-field">
                  <label className="cp-label">Classroom Stream Name</label>
                  <input
                    type="text"
                    required
                    value={classroomForm.name}
                    onChange={(e) => setClassroomForm({ ...classroomForm, name: e.target.value })}
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
                    onChange={(e) => setClassroomForm({ ...classroomForm, room: e.target.value })}
                    className="cp-input"
                    placeholder="Room 402"
                  />
                </div>
                <div className="cp-field">
                  <label className="cp-label">Associated Course / Curriculum</label>
                  <select
                    value={classroomForm.courseId || courses[0]?.id || ''}
                    onChange={(e) => setClassroomForm({ ...classroomForm, courseId: e.target.value })}
                    className="cp-select"
                  >
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title} ({c.code})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="cp-field">
                  <label className="cp-label">Lead Teacher</label>
                  <select
                    value={classroomForm.leadTeacher || teachers[0]?.name || ''}
                    onChange={(e) => setClassroomForm({ ...classroomForm, leadTeacher: e.target.value })}
                    className="cp-select"
                  >
                    {teachers.map((t) => (
                      <option key={t.id} value={t.name}>
                        {t.name} ({t.department})
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
                  Save Classroom
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Deletion Confirmation Modal */}
      {deleteConfirm.isOpen && (
        <div className="cp-overlay">
          <div className="cp-modal">
            <div className="cp-modal-header">
              <div>
                <span className="cp-eyebrow is-tight">Destructive action</span>
                <h2>Confirm Deletion</h2>
              </div>
            </div>
            <div className="cp-modal-body">
              <p className="cp-lead text-ink">
                Are you sure you want to delete <strong className="font-black">{deleteConfirm.name}</strong>?
              </p>
            </div>
            <div className="cp-modal-footer">
              <button
                onClick={() => setDeleteConfirm({ isOpen: false, id: null, name: '' })}
                className="cp-btn cp-btn-ghost"
              >
                Cancel
              </button>
              <button onClick={executeDelete} className="cp-btn cp-btn-danger">
                Delete Resource
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
