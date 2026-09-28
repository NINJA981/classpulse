'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Calendar, Clock, MapPin, Users, Play, Plus, BookOpen } from 'lucide-react';

interface TimetableSlot {
  id: string;
  day: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday';
  time: string;
  timeSlotIndex: number; // 0 to 4
  subject: string;
  className: string;
  room: string;
  topicPlanned: string;
  isLiveNow?: boolean;
}

const TIME_SLOTS = [
  { index: 0, label: '09:00 - 10:15' },
  { index: 1, label: '10:30 - 11:45' },
  { index: 2, label: '11:45 - 13:00' },
  { index: 3, label: '13:30 - 14:45' },
  { index: 4, label: '15:00 - 16:15' }
];

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] as const;

export default function TimetablePage() {
  const [selectedDay, setSelectedDay] = useState<string>('All');
  // No timetable endpoint exists yet, so there is nothing to load. See the note on the page.
  const WEEKLY_SCHEDULE: TimetableSlot[] = [];
  const [selectedSlot, setSelectedSlot] = useState<TimetableSlot | null>(null);

  const filteredSlots =
    selectedDay === 'All'
      ? WEEKLY_SCHEDULE
      : WEEKLY_SCHEDULE.filter((s) => s.day === selectedDay);

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <div className="page-header-info">
          <span className="eyebrow">ACADEMIC SCHEDULE & ROOM ALLOCATIONS</span>
          <h1>Faculty Timetable</h1>
          <p className="text-secondary" style={{ marginTop: '4px' }}>
            Weekly teaching roster, lecture timing blocks, laboratory assignments, and scheduled office hours.
          </p>
        </div>

        <div className="page-header-actions">
          <Link href="/lessons/new" className="btn btn-primary">
            + Start Lesson Session
          </Link>
        </div>
      </div>

      {/* Summary KPI Bar */}
      <div className="metrics-grid" style={{ marginBottom: '1.5rem' }}>
        <div className="metric-card">
          <span className="eyebrow">WEEKLY WORKLOAD</span>
          <div className="metric-number">14 Hours</div>
          <div className="metric-sub">11 Lecture periods + 3 Labs</div>
        </div>
        <div className="metric-card">
          <span className="eyebrow">SECTIONS ASSIGNED</span>
          <div className="metric-number">3 Cohorts</div>
          <div className="metric-sub">Grades 9-C, 10-B, 11-A</div>
        </div>
        <div className="metric-card">
          <span className="eyebrow">CURRENT STATUS</span>
          <div className="metric-number" style={{ fontSize: '1.5rem' }}>
            <span className="timetable-tag live-badge">Bio (Gr 10-B)</span>
          </div>
          <div className="metric-sub">09:00 - 10:15 AM • Room 304</div>
        </div>
      </div>

      {/* Day Selector Tabs */}
      <div className="tab-bar">
        {['All', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map((day) => (
          <button
            key={day}
            type="button"
            className={`tab-btn ${selectedDay === day ? 'active' : ''}`}
            onClick={() => setSelectedDay(day)}
          >
            {day === 'All' ? 'Full Week Grid' : day}
          </button>
        ))}
      </div>

      {/* Timetable View */}
      {selectedDay === 'All' ? (
        /* Full Grid Mode */
        <div style={{ overflowX: 'auto', marginBottom: '2rem' }}>
          <div className="timetable-grid" style={{ minWidth: '820px' }}>
            {/* Corner header */}
            <div className="timetable-header-cell">TIME</div>
            {DAYS.map((day) => (
              <div key={day} className="timetable-header-cell">
                {day}
              </div>
            ))}

            {/* Time Slot Rows */}
            {TIME_SLOTS.map((slot) => (
              <React.Fragment key={slot.index}>
                <div className="timetable-time-cell">{slot.label}</div>
                {DAYS.map((day) => {
                  const match = WEEKLY_SCHEDULE.find(
                    (s) => s.day === day && s.timeSlotIndex === slot.index
                  );

                  return (
                    <div
                      key={day + slot.index}
                      className={`timetable-cell ${match?.isLiveNow ? 'live-slot' : ''}`}
                      onClick={() => match && setSelectedSlot(match)}
                      style={{ cursor: match ? 'pointer' : 'default' }}
                    >
                      {match ? (
                        <>
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                              <span className="timetable-tag">{match.subject}</span>
                              {match.isLiveNow && (
                                <span className="timetable-tag live-badge">LIVE</span>
                              )}
                            </div>
                            <div style={{ fontWeight: 800, fontSize: '12px', marginTop: '2px' }}>
                              {match.className}
                            </div>
                            <div className="text-secondary" style={{ fontSize: '11px', marginTop: '2px' }}>
                              {match.room}
                            </div>
                          </div>
                          <div
                            className="text-secondary"
                            style={{
                              fontSize: '10px',
                              fontStyle: 'italic',
                              marginTop: '6px',
                              borderTop: '1px solid var(--hairline)',
                              paddingTop: '4px'
                            }}
                          >
                            {match.topicPlanned}
                          </div>
                        </>
                      ) : (
                        <div
                          style={{
                            height: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#ccc',
                            fontSize: '11px'
                          }}
                        >
                          —
                        </div>
                      )}
                    </div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </div>
      ) : (
        /* Day List View */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '2rem' }}>
          {filteredSlots.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
              <span className="eyebrow">NO CLASSES SCHEDULED</span>
              <p>No teaching periods assigned for {selectedDay}.</p>
            </div>
          ) : (
            filteredSlots.map((slot) => (
              <div
                key={slot.id}
                className={`card card-solid ${slot.isLiveNow ? 'live-slot' : ''}`}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '1.25rem'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span className="text-mono" style={{ fontWeight: 800 }}>
                      {slot.time}
                    </span>
                    <span className="timetable-tag">{slot.subject}</span>
                    {slot.isLiveNow && <span className="timetable-tag live-badge">● LIVE NOW</span>}
                  </div>
                  <h3 style={{ fontSize: '1.1rem', margin: '4px 0' }}>{slot.topicPlanned}</h3>
                  <div className="text-secondary" style={{ fontSize: '12px', display: 'flex', gap: '16px' }}>
                    <span>{slot.className}</span>
                    <span>•</span>
                    <span>{slot.room}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <Link href="/lessons/new" className="btn btn-sm btn-primary">
                    <Play size={12} /> Start Session
                  </Link>
                  <Link href="/notes-syllabus" className="btn btn-sm btn-secondary">
                    <BookOpen size={12} /> Materials
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Selected Slot Drawer / Details Callout */}
      {selectedSlot && (
        <div className="card card-solid" style={{ border: '2px solid var(--ink)', padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <div>
              <span className="eyebrow">SELECTED TIMETABLE PERIOD DETAILS</span>
              <h2 style={{ fontSize: '1.3rem' }}>
                {selectedSlot.day} • {selectedSlot.time}
              </h2>
            </div>
            {selectedSlot.isLiveNow && (
              <span className="timetable-tag live-badge" style={{ fontSize: '11px', padding: '4px 8px' }}>
                ACTIVE IN-PROGRESS SLOT
              </span>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '1rem' }}>
            <div>
              <span className="text-secondary" style={{ fontSize: '11px' }}>Subject:</span>
              <div style={{ fontWeight: 800 }}>{selectedSlot.subject}</div>
            </div>
            <div>
              <span className="text-secondary" style={{ fontSize: '11px' }}>Class / Section:</span>
              <div style={{ fontWeight: 800 }}>{selectedSlot.className}</div>
            </div>
            <div>
              <span className="text-secondary" style={{ fontSize: '11px' }}>Location:</span>
              <div style={{ fontWeight: 800 }}>{selectedSlot.room}</div>
            </div>
            <div>
              <span className="text-secondary" style={{ fontSize: '11px' }}>Planned Curriculum:</span>
              <div style={{ fontWeight: 800 }}>{selectedSlot.topicPlanned}</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '1rem', borderTop: '1px solid var(--hairline)', paddingTop: '12px' }}>
            <Link href="/record-transcribe" className="btn btn-primary">
              <Play size={14} /> Launch Live Recording For This Slot
            </Link>
            <Link href="/lessons/new" className="btn btn-secondary">
              Prepare Lesson Notes & Quiz
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
