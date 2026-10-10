'use client';

import React from 'react';
import { useClassPulse } from '../context/ClassPulseContext';

export const StudentDashboard = () => {
  const { currentUser, timetables, setActiveTab, classrooms } = useClassPulse();

  const studentClass = currentUser.className || 'Grade 10-A';
  const myTimetable = timetables[studentClass] || {};
  const classroomInfo = classrooms.find(c => c.name === studentClass) || classrooms[0];

  return (
    <>
      {/* Student Welcome Hero */}
      <section className="cp-hero">
        <div className="max-w-3xl">
          <span className="cp-eyebrow">STUDENT LEARNING PORTAL</span>
          <h1 className="cp-hero-title">
            Hello, {currentUser.name}!
          </h1>
          <p className="cp-hero-text">
            Roll No: {currentUser.rollNo || 'STU-1001'} • Enrolled in {studentClass} ({classroomInfo?.room})
          </p>
        </div>

        <div className="cp-hero-aside">
          <button
            onClick={() => setActiveTab('projector')}
            className="cp-btn-primary"
          >
            <span>Join Live Classroom Quiz</span>
            <span aria-hidden="true">→</span>
          </button>
        </div>
      </section>

      {/* Student Profile & Schedule Cards */}
      <section>
        <div className="cp-grid-3">
          {/* Card 1: Student ID Card */}
          <div className="cp-stat cp-card-ink gap-5">
            <span className="cp-eyebrow is-tight">STUDENT IDENTITY CARD</span>
            <div className="flex items-center gap-4">
              <div className="cp-avatar is-lg border-white" aria-hidden="true">
                {(currentUser.name || 'S').charAt(0)}
              </div>
              <div>
                <h3 className="cp-h3">{currentUser.name}</h3>
                <span className="cp-badge is-outline">
                  {currentUser.rollNo || 'STU-1001'}
                </span>
              </div>
            </div>
            <div className="cp-metric-grid">
              <div><span>Section</span><strong>{studentClass}</strong></div>
              <div><span>Lead Teacher</span><strong>{classroomInfo?.leadTeacher || 'Dr. Anitha'}</strong></div>
              <div><span>Class Location</span><strong>{classroomInfo?.room || 'Science Lab 2'}</strong></div>
            </div>
          </div>

          {/* Card 2: Today's Subject Schedule */}
          <div className="cp-stat">
            <div className="cp-stat-top">
              <div className="cp-icon-box" aria-hidden="true">▤</div>
            </div>
            <span className="cp-stat-label">TODAY'S SCHEDULE</span>
            <h3 className="cp-h3">Biology & Chemistry</h3>
            <div className="cp-list mt-3">
              <div className="cp-row">
                <div className="cp-row-icon" aria-hidden="true">□</div>
                <div className="cp-row-content"><p className="cp-row-title">⏰ 09:00 AM - Biology (Dr. Anitha)</p></div>
              </div>
              <div className="cp-row">
                <div className="cp-row-icon" aria-hidden="true">□</div>
                <div className="cp-row-content"><p className="cp-row-title">⏰ 11:15 AM - Chemistry (Dr. Meena)</p></div>
              </div>
            </div>
          </div>

          {/* Card 3: Live Quiz Status */}
          <div className="cp-stat">
            <div className="cp-stat-top">
              <div className="cp-icon-box" aria-hidden="true">✓</div>
              <span className="cp-live"><span className="cp-dot is-live" /> LIVE</span>
            </div>
            <span className="cp-stat-label">ACTIVE QUIZ ROOM</span>
            <strong className="cp-stat-value is-text">Photosynthesis Check</strong>
            <span className="cp-stat-detail">4 Multiple Choice Questions Ready</span>
            <button
              onClick={() => setActiveTab('projector')}
              className="cp-link inline-flex items-center gap-1.5 mt-3 self-start"
            >
              <span>Enter Quiz Kiosk</span>
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </div>
      </section>

      {/* Class Timetable for Student */}
      <section>
        <div className="cp-section-heading">
          <div>
            <span className="cp-eyebrow">Weekly schedule</span>
            <h2>My Class Timetable ({studentClass})</h2>
          </div>
          <span className="cp-badge">
            WEEKLY SCHEDULE
          </span>
        </div>

        <div className="cp-grid-3">
          {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map((day) => {
            const slots = myTimetable[day] || [];
            return (
              <div key={day} className="cp-panel">
                <div className="cp-panel-header items-center">
                  <div>
                    <span className="cp-eyebrow is-tight">Timetable</span>
                    <h3>{day}</h3>
                  </div>
                  <span className="cp-badge is-muted">{slots.length} Classes</span>
                </div>
                {slots.length === 0 ? (
                  <div className="cp-empty is-sm">
                    <p>No scheduled classes for {day}.</p>
                  </div>
                ) : (
                  <div className="cp-list">
                    {slots.map((s, i) => (
                      <div key={i} className="cp-row is-interactive">
                        <div className="cp-row-icon" aria-hidden="true">□</div>
                        <div className="cp-row-content">
                          <h3>{s.subject}</h3>
                          <p>⏰ {s.time} • {s.teacher}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
};
