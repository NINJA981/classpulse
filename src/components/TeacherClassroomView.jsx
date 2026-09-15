'use client';

import React, { useState } from 'react';
import { useClassPulse } from '../context/ClassPulseContext';
import { ClassroomCard } from './ClassroomCard';

export const TeacherClassroomView = () => {
  const {
    classrooms,
    students,
    timetables,
    currentUser
  } = useClassPulse();

  // Find instructor's primary assigned class
  const myClassroom = classrooms.find(c => c.leadTeacher === currentUser?.name) || classrooms[0];

  const [activeSection, setActiveSection] = useState('timetables'); // 'timetables' | 'classrooms'
  const [selectedStream, setSelectedStream] = useState(myClassroom?.name || classrooms[0]?.name);
  const [selectedDay, setSelectedDay] = useState('Monday');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClassroomId, setSelectedClassroomId] = useState(null);

  const selectedClassroomObj = classrooms.find(c => c.id === selectedClassroomId);

  return (
    <>
      {/* Page header */}
      <section className="cp-page-header select-none">
        <div>
          <span className="cp-eyebrow">TEACHER WORKBENCH • CLASSROOMS & TIMETABLES</span>
          <h1 className="cp-display">
            Class Streams & Weekly Timetables
          </h1>
          <p className="cp-lead">
            Read-only live schedule database synchronized with Admin Control.
          </p>
        </div>

        <div className="cp-page-actions">
          <span className="cp-badge is-ink">
            <span>INSTRUCTOR ACCESS MODE</span>
          </span>
        </div>
      </section>

      <section className="cp-stack">
        {/* Section Navigation Controller */}
        <div className="cp-card flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="cp-field flex-1 max-w-md">
            <label className="cp-label">
              <span>Select View:</span>
            </label>
            <select
              value={activeSection}
              onChange={(e) => setActiveSection(e.target.value)}
              className="cp-select"
            >
              <option value="timetables">📅 Schedules & Timetables</option>
              <option value="classrooms">🏫 Classroom Streams Directory ({classrooms.length})</option>
            </select>
          </div>

          <span className="cp-status">
            <span className="cp-dot" />
            <span>Assigned Stream: {myClassroom?.name || 'Grade 10-A'}</span>
          </span>
        </div>

        {/* ----------------- SECTION 1: SCHEDULES & TIMETABLES (READ-ONLY) ----------------- */}
        {activeSection === 'timetables' && (
          <div className="cp-panel cp-stack">
            <div className="cp-panel-header md:items-center">
              <div>
                <span className="cp-eyebrow is-tight">Schedules</span>
                <h3>
                  <span>Schedule View: {selectedStream}</span>
                </h3>
                <p className="cp-caption mt-1">
                  Weekly master timetable schedule configured by System Administration.
                </p>
              </div>

              <div className="cp-field">
                <label className="cp-label">Select Stream:</label>
                <select
                  value={selectedStream}
                  onChange={(e) => setSelectedStream(e.target.value)}
                  className="cp-select is-sm"
                >
                  {classrooms.map(c => (
                    <option key={c.id} value={c.name}>{c.name} ({c.room})</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Day Buttons */}
            <div className="cp-segment flex-wrap">
              {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map((day) => (
                <button
                  key={day}
                  onClick={() => setSelectedDay(day)}
                  className={`cp-segment-item ${selectedDay === day ? 'is-active' : ''}`}
                >
                  {day}
                </button>
              ))}
            </div>

            {/* Timetable Slot List */}
            {(timetables[selectedStream]?.[selectedDay] || []).length === 0 ? (
              <div className="cp-empty is-sm">
                <div className="cp-empty-icon" aria-hidden="true">▤</div>
                <p>No sessions scheduled for {selectedStream} on {selectedDay}.</p>
              </div>
            ) : (
              <div className="cp-list-bordered">
                {(timetables[selectedStream]?.[selectedDay] || []).map((slot, idx) => (
                  <div key={idx} className="cp-row is-interactive flex-col sm:flex-row items-start sm:items-center">
                    <div className="cp-row-icon" aria-hidden="true">□</div>
                    <div className="cp-row-content">
                      <h3 className="flex flex-wrap items-center gap-2">
                        <span>{slot.time}</span>
                        <span className="cp-badge is-ink">
                          {slot.subject}
                        </span>
                      </h3>
                      <p>
                        Instructor: {slot.teacher} • Location: {slot.room}
                      </p>
                    </div>

                    <div className="cp-row-actions">
                      <span className="cp-badge">
                        Verified Slot
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ----------------- SECTION 2: CLASSROOM STREAMS DIRECTORY ----------------- */}
        {activeSection === 'classrooms' && (
          <div className="cp-stack">
            {!selectedClassroomId && (
              <div className="cp-stack">
                <div className="cp-section-heading flex-wrap gap-4">
                  <div>
                    <span className="cp-eyebrow">Directory</span>
                    <h2>Classroom Streams</h2>
                  </div>
                  <div className="cp-caption uppercase tracking-label font-bold">
                    Total Active Streams: <strong className="text-ink">{classrooms.length}</strong>
                  </div>
                </div>

                <div className="cp-card">
                  <div className="cp-field max-w-md">
                    <input
                      type="text"
                      aria-label="Search streams by name or room"
                      placeholder="Search streams by name or room..."
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
                        actionLabel="Inspect Class Roster"
                        showGrade
                      />
                    ))}
                </div>
              </div>
            )}

            {/* Drill-down View */}
            {selectedClassroomId && selectedClassroomObj && (
              <div className="cp-stack">
                <div className="cp-card flex flex-wrap items-center justify-between gap-4">
                  <button
                    onClick={() => setSelectedClassroomId(null)}
                    className="cp-btn-secondary cp-btn-sm"
                  >
                    <span aria-hidden="true">←</span>
                    <span>Back to All Streams</span>
                  </button>
                  <div className="cp-caption uppercase tracking-label font-bold">
                    Stream: <strong className="text-ink">{selectedClassroomObj.name} ({selectedClassroomObj.room})</strong>
                  </div>
                </div>

                <div className="cp-panel">
                  <div className="cp-panel-header flex-wrap items-start justify-between gap-4">
                    <div>
                      <span className="cp-eyebrow is-tight">Roster Inspection</span>
                      <h3>🎓 Enrolled Roster for {selectedClassroomObj.name}</h3>
                      <p className="cp-caption text-secondary mt-1">
                        Room: <strong className="text-ink">{selectedClassroomObj.room}</strong> · {selectedClassroomObj.gradeLevel} · {students.filter(s => s.className === selectedClassroomObj.name).length} Students
                      </p>
                    </div>

                    {/* Lead Instructor Details */}
                    <div className="border border-border-strong bg-surface-sunken p-3 flex items-center gap-3 shadow-hard-sm">
                      <div className="cp-avatar w-9 h-9 text-xs font-black shrink-0" aria-hidden="true">
                        {selectedClassroomObj.leadTeacher ? selectedClassroomObj.leadTeacher.replace(/^(Dr\.|Prof\.|Mr\.|Ms\.)\s*/, '')[0] || 'T' : 'T'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="cp-eyebrow text-muted text-[8px]">Lead Instructor</span>
                          <span className="cp-badge is-ink text-[7px] py-0 px-1.5">FACULTY IN-CHARGE</span>
                        </div>
                        <div className="text-xs font-black text-primary tracking-tight">
                          {selectedClassroomObj.leadTeacher || 'Assigned Faculty'}
                        </div>
                      </div>
                    </div>
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
                            <td className="font-bold">{s.rollNo}</td>
                            <td className="font-bold text-ink">{s.name}</td>
                            <td className="text-muted-4">{s.email}</td>
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
      </section>
    </>
  );
};
