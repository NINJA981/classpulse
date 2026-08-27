'use client';

import React from 'react';
import { useClassPulse } from '../context/ClassPulseContext';

export const TeacherDashboard = () => {
  const { currentUser, classrooms, timetables, setActiveTab, launchQuiz } = useClassPulse();

  const myClassroom = classrooms.find(c => c.leadTeacher === currentUser.name) || classrooms[0];
  const myTimetable = timetables[myClassroom.name] || {};

  return (
    <>
      {/* Teacher Welcome Hero */}
      <section className="cp-hero">
        <div className="max-w-3xl">
          <span className="cp-eyebrow">TEACHER WORKBENCH</span>
          <h1 className="cp-hero-title">
            Welcome back, {currentUser.name}!
          </h1>
          <p className="cp-hero-text">
            {currentUser.department || 'Science & Biology'} • Lead Instructor: {myClassroom.name} ({myClassroom.room})
          </p>
        </div>

        <div className="cp-hero-aside">
          <button
            onClick={launchQuiz}
            className="cp-btn-primary"
          >
            <span>Broadcast Live Quiz</span>
            <span aria-hidden="true">→</span>
          </button>
        </div>
      </section>

      {/* Quick Overview Cards */}
      <section>
        <div className="cp-grid-3">
          {/* Card 1: Assigned Classroom */}
          <div className="cp-stat">
            <div className="cp-stat-top">
              <div className="cp-icon-box" aria-hidden="true">▣</div>
              <span className="cp-badge is-ink">CLASSROOM ACTIVE</span>
            </div>
            <span className="cp-stat-label">PRIMARY CLASSROOM</span>
            <strong className="cp-stat-value is-sm">{myClassroom.name}</strong>
            <span className="cp-stat-detail">{myClassroom.room} • {myClassroom.studentCount} Enrolled Students</span>
          </div>

          {/* Card 2: Today's Subject */}
          <div className="cp-stat">
            <div className="cp-stat-top">
              <div className="cp-icon-box" aria-hidden="true">✓</div>
            </div>
            <span className="cp-stat-label">CURRENT SUBJECT</span>
            <strong className="cp-stat-value is-text">Biology & Photosynthesis</strong>
            <span className="cp-stat-detail">Light reactions & ATP synthesis overview</span>
            <button
              onClick={() => setActiveTab('quiz')}
              className="cp-link inline-flex items-center gap-1.5 mt-3 self-start"
            >
              <span>Prepare Quiz Questions</span>
              <span aria-hidden="true">→</span>
            </button>
          </div>

          {/* Card 3: Timetable Quick Check */}
          <div className="cp-stat">
            <div className="cp-stat-top">
              <div className="cp-icon-box" aria-hidden="true">▤</div>
            </div>
            <span className="cp-stat-label">TODAY'S SCHEDULE</span>
            <strong className="cp-stat-value is-text">3 Sessions Scheduled</strong>
            <span className="cp-stat-detail">Next session: 11:15 AM (Science Lab 2)</span>
            <button
              onClick={() => setActiveTab('management')}
              className="cp-link inline-flex items-center gap-1.5 mt-3 self-start"
            >
              <span>View Full Weekly Timetable</span>
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </div>
      </section>

      {/* Weekly Timetable Preview */}
      <section>
        <div className="cp-section-heading">
          <div>
            <span className="cp-eyebrow">Weekly schedule</span>
            <h2>Weekly Timetable for {myClassroom.name}</h2>
          </div>
          <span className="cp-badge">
            INSTRUCTOR: {currentUser.name.toUpperCase()}
          </span>
        </div>

        <div className="cp-grid-3">
          {['Monday', 'Tuesday', 'Wednesday'].map((day) => {
            const slots = myTimetable[day] || [];
            return (
              <div key={day} className="cp-panel">
                <div className="cp-panel-header items-center">
                  <div>
                    <span className="cp-eyebrow is-tight">Timetable</span>
                    <h3>{day}</h3>
                  </div>
                  <span className="cp-badge is-muted">{slots.length} Sessions</span>
                </div>
                {slots.length === 0 ? (
                  <div className="cp-empty is-sm">
                    <p>No sessions scheduled for {day}.</p>
                  </div>
                ) : (
                  <div className="cp-list">
                    {slots.map((s, i) => (
                      <div key={i} className="cp-row is-interactive">
                        <div className="cp-row-icon" aria-hidden="true">□</div>
                        <div className="cp-row-content">
                          <h3>{s.subject}</h3>
                          <p>⏰ {s.time} • {s.room}</p>
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
