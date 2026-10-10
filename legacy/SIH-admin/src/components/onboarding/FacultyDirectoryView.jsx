'use client';

import React, { useState, useEffect } from 'react';
import { Calendar } from 'lucide-react';
import { useClassPulse } from '../../context/ClassPulseContext';

export const FacultyDirectoryView = () => {
  const {
    teachers,
    addTeacher,
    deleteTeacher,
    setSelectedFacultyTimetable,
    setTimetableMode,
    setActiveTab,
    setAdminSubTab
  } = useClassPulse();

  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, id: null, name: '' });

  const [teacherForm, setTeacherForm] = useState({
    name: '',
    staffId: '',
    department: 'Computer Science',
    email: '',
    assignedClasses: 'Grade 10-A'
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
    deleteTeacher(deleteConfirm.id);
    setDeleteConfirm({ isOpen: false, id: null, name: '' });
  };

  return (
    <div className="space-y-4">
      {/* Faculty Directory heading + action bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <div>
          <span className="cp-eyebrow">Directory</span>
          <h2 className="cp-h2 mt-0.5">Faculty Directory</h2>
        </div>
        <div className="flex items-center gap-3">
          <div className="cp-caption">
            Total Faculty: <strong className="text-ink">{teachers.length}</strong>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="cp-btn cp-btn-primary min-h-0 h-8 px-3 text-xs shrink-0"
          >
            <span aria-hidden="true">＋</span>
            <span>Add Teacher</span>
          </button>
        </div>
      </div>

      <div className="max-w-md">
        <input
          type="text"
          aria-label="Search faculty members by name or department"
          placeholder="Search faculty members by name or department..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="cp-input"
        />
      </div>

      <div className="cp-grid-3">
        {teachers
          .filter(
            (t) =>
              t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
              t.department.toLowerCase().includes(searchTerm.toLowerCase())
          )
          .map((t) => (
            <div key={t.id} className="cp-card space-y-4">
              <div className="flex items-start justify-between gap-3 pb-4 border-b border-line-faint">
                <div className="flex items-center gap-3">
                  <div className="cp-row-icon font-black text-body">
                    {t.name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')}
                  </div>
                  <div>
                    <h3 className="cp-h4">{t.name}</h3>
                    <span className="cp-caption-2 tracking-label">{t.staffId}</span>
                  </div>
                </div>
                <button
                  onClick={() => requestDelete(t.id, t.name)}
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

              <div className="pt-2 border-t border-border-faint">
                <button
                  type="button"
                  onClick={() => {
                    if (setSelectedFacultyTimetable) setSelectedFacultyTimetable(t.name);
                    if (setTimetableMode) setTimetableMode('faculty');
                    if (setActiveTab) setActiveTab('management');
                    if (setAdminSubTab) setAdminSubTab('timetables');
                  }}
                  className="cp-btn cp-btn-ghost h-7 px-2.5 text-xs flex items-center gap-1.5 border border-border hover:bg-surface-sunken w-full justify-center"
                >
                  <Calendar className="w-3.5 h-3.5 text-secondary" />
                  <span>View & Update Timetable →</span>
                </button>
              </div>
            </div>
          ))}
      </div>

      {/* Modal: Add Teacher */}
      {isModalOpen && (
        <div className="cp-overlay">
          <div className="cp-modal">
            <div className="cp-modal-header flex items-center justify-between gap-4">
              <div>
                <span className="cp-eyebrow is-tight">Onboarding</span>
                <h2>Create New Teacher</h2>
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
                addTeacher(teacherForm);
                setIsModalOpen(false);
              }}
            >
              <div className="cp-modal-body space-y-4">
                <div className="cp-field">
                  <label className="cp-label">Teacher Full Name</label>
                  <input
                    type="text"
                    required
                    value={teacherForm.name}
                    onChange={(e) => setTeacherForm({ ...teacherForm, name: e.target.value })}
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
                    onChange={(e) => setTeacherForm({ ...teacherForm, staffId: e.target.value })}
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
                    onChange={(e) => setTeacherForm({ ...teacherForm, department: e.target.value })}
                    className="cp-input"
                    placeholder="Computer Science"
                  />
                </div>
                <div className="cp-field">
                  <label className="cp-label">Faculty Email Address</label>
                  <input
                    type="email"
                    value={teacherForm.email}
                    onChange={(e) => setTeacherForm({ ...teacherForm, email: e.target.value })}
                    className="cp-input"
                    placeholder="faculty@clasepulse.test"
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
                  Save Teacher
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
