'use client';

import React, { useState, useEffect } from 'react';
import { useClassPulse } from '../../context/ClassPulseContext';

export const StudentRosterView = () => {
  const {
    students,
    addStudent,
    deleteStudent,
    classrooms
  } = useClassPulse();

  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, id: null, name: '' });

  const [studentForm, setStudentForm] = useState({
    name: '',
    rollNo: '',
    className: classrooms[0]?.name || 'Grade 10-A',
    email: '',
    nickname: ''
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
    deleteStudent(deleteConfirm.id);
    setDeleteConfirm({ isOpen: false, id: null, name: '' });
  };

  const filteredStudents = students.filter(
    (s) =>
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.rollNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.className.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="border border-border bg-surface shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-border bg-surface">
          <div>
            <span className="cp-eyebrow">Roster</span>
            <h3 className="cp-h3 mt-0.5">Student Roster Registry ({students.length} Accounts)</h3>
            <p className="cp-lead text-secondary text-xs mt-0.5">Active student profile listings across all classroom streams.</p>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="cp-btn cp-btn-primary min-h-0 h-8 px-3 text-xs shrink-0"
          >
            <span aria-hidden="true">＋</span>
            <span>Add Student</span>
          </button>
        </div>

        <div className="p-3 px-4 border-b border-border bg-surface-sunken">
          <input
            type="text"
            aria-label="Search students by name, roll no or class"
            placeholder="Search students by name, roll no, or stream..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="cp-input max-w-md h-8 text-xs"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="cp-table w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-surface-sunken text-[10px] uppercase font-black tracking-wider text-muted">
                <th className="py-2.5 px-4">Roll No</th>
                <th className="py-2.5 px-4">Student Name</th>
                <th className="py-2.5 px-4">Assigned Stream</th>
                <th className="py-2.5 px-4">Email Address</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map((s) => (
                <tr key={s.id} className="border-b border-border-faint last:border-b-0 hover:bg-surface-hover">
                  <td className="py-2.5 px-4 font-mono font-bold text-xs text-primary">{s.rollNo}</td>
                  <td className="py-2.5 px-4 text-xs font-bold text-primary">{s.name}</td>
                  <td className="py-2.5 px-4 text-xs">
                    <span className="cp-badge">{s.className}</span>
                  </td>
                  <td className="py-2.5 px-4 text-xs text-muted font-mono">{s.email}</td>
                  <td className="py-2.5 px-4 text-right">
                    <button
                      onClick={() => requestDelete(s.id, s.name)}
                      className="cp-btn cp-btn-ghost text-xs min-h-0 h-7 w-7 p-0 inline-flex items-center justify-center font-bold hover:text-ink"
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

      {/* Modal: Add Student */}
      {isModalOpen && (
        <div className="cp-overlay">
          <div className="cp-modal">
            <div className="cp-modal-header flex items-center justify-between gap-4">
              <div>
                <span className="cp-eyebrow is-tight">Onboarding</span>
                <h2>Create New Student</h2>
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
                addStudent({
                  ...studentForm,
                  email: studentForm.email || `${studentForm.name.toLowerCase().replace(/\s+/g, '.')}@apex.edu`
                });
                setIsModalOpen(false);
              }}
            >
              <div className="cp-modal-body space-y-4">
                <div className="cp-field">
                  <label className="cp-label">Student Full Name</label>
                  <input
                    type="text"
                    required
                    value={studentForm.name}
                    onChange={(e) => setStudentForm({ ...studentForm, name: e.target.value })}
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
                    onChange={(e) => setStudentForm({ ...studentForm, rollNo: e.target.value })}
                    className="cp-input"
                    placeholder="STU-1005"
                  />
                </div>
                <div className="cp-field">
                  <label className="cp-label">Assigned Stream</label>
                  <select
                    value={studentForm.className}
                    onChange={(e) => setStudentForm({ ...studentForm, className: e.target.value })}
                    className="cp-select"
                  >
                    {classrooms.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
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
                  Save Student
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
