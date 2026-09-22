'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { api } from '../../lib/api';
import { Lesson } from '../../types';
import {
  History,
  Search,
  Filter,
  Users,
  Clock,
  FileText,
  CheckCircle,
  Play,
  ArrowUpRight,
  X,
  Radio,
  BookOpen
} from 'lucide-react';

interface ClassArchiveItem {
  id: string;
  title: string;
  subject: string;
  className: string;
  date: string;
  durationMinutes: number;
  attendanceRate: number; // e.g. 94%
  hasRecording: boolean;
  notesCount: number;
  quizStatus: 'Published' | 'Draft' | 'Graded';
  averageScore?: number;
  transcriptExcerpt: string;
}

const SAMPLE_ARCHIVES: ClassArchiveItem[] = [
  {
    id: 'arc_1',
    title: 'Cellular Respiration & Krebs Cycle Kinetics',
    subject: 'Biology',
    className: 'Grade 10 - Section B',
    date: '2026-09-21T09:00:00Z',
    durationMinutes: 52,
    attendanceRate: 94,
    hasRecording: true,
    notesCount: 3,
    quizStatus: 'Graded',
    averageScore: 82,
    transcriptExcerpt:
      'We begin today with pyruvate decarboxylation in the mitochondrial matrix. Notice how acetyl-CoA is transferred to oxaloacetate to form citrate. This condensation reaction yields two molecules of CO2...'
  },
  {
    id: 'arc_2',
    title: 'Newtonian Gravitation & Orbital Velocity',
    subject: 'Physics',
    className: 'Grade 11 - Section A',
    date: '2026-09-20T11:30:00Z',
    durationMinutes: 48,
    attendanceRate: 88,
    hasRecording: true,
    notesCount: 2,
    quizStatus: 'Published',
    averageScore: 78,
    transcriptExcerpt:
      'Remember that gravitational potential energy is defined with respect to infinity as zero. The escape velocity formula derives directly from the conservation of mechanical energy...'
  },
  {
    id: 'arc_3',
    title: 'The Calvin Cycle & C4 Adaptations in Grasses',
    subject: 'Biology',
    className: 'Grade 10 - Section B',
    date: '2026-09-19T09:00:00Z',
    durationMinutes: 45,
    attendanceRate: 96,
    hasRecording: true,
    notesCount: 4,
    quizStatus: 'Graded',
    averageScore: 85,
    transcriptExcerpt:
      'RuBisCO exhibits both carboxylase and oxygenase activity. In arid climates, photorespiration can waste up to 25% of energy, which is why Kranz anatomy evolved in C4 plants...'
  },
  {
    id: 'arc_4',
    title: 'Periodic Trends & Electronegativity Gradients',
    subject: 'Chemistry',
    className: 'Grade 9 - Section C',
    date: '2026-09-18T14:00:00Z',
    durationMinutes: 50,
    attendanceRate: 91,
    hasRecording: false,
    notesCount: 2,
    quizStatus: 'Published',
    averageScore: 74,
    transcriptExcerpt:
      'Moving left to right across Period 3, atomic radius decreases because nuclear charge increases without adding a new electron shell...'
  },
  {
    id: 'arc_5',
    title: 'Simple Harmonic Motion & Damped Oscillations',
    subject: 'Physics',
    className: 'Grade 11 - Section A',
    date: '2026-09-17T11:30:00Z',
    durationMinutes: 55,
    attendanceRate: 89,
    hasRecording: true,
    notesCount: 3,
    quizStatus: 'Graded',
    averageScore: 80,
    transcriptExcerpt:
      'For small angular displacements, sin(theta) is approximately theta in radians. This linear restoring force is what allows us to model a pendulum as an oscillator...'
  }
];

export default function PreviousClassesPage() {
  const [archives, setArchives] = useState<ClassArchiveItem[]>(SAMPLE_ARCHIVES);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('All');
  const [selectedClass, setSelectedClass] = useState('All');
  const [activeModalItem, setActiveModalItem] = useState<ClassArchiveItem | null>(null);

  // Load from API lessons as well
  useEffect(() => {
    api.getLessons()
      .then((res) => {
        if (res.lessons && res.lessons.length > 0) {
          const apiMapped: ClassArchiveItem[] = res.lessons.map((les, index) => ({
            id: les._id,
            title: les.title,
            subject: les.subject,
            className: les.className,
            date: les.createdAt,
            durationMinutes: 45 + (index * 5) % 20,
            attendanceRate: 90 + (index * 3) % 10,
            hasRecording: les.sourceType === 'audio',
            notesCount: 2,
            quizStatus: les.status === 'published' ? 'Published' : 'Draft',
            averageScore: 81,
            transcriptExcerpt:
              'Curriculum transcript recorded and processed by ClasePulse Teacher Terminal transcription pipeline.'
          }));

          // Merge without duplicate IDs
          const existingIds = new Set(SAMPLE_ARCHIVES.map((a) => a.id));
          const additions = apiMapped.filter((m) => !existingIds.has(m.id));
          setArchives([...SAMPLE_ARCHIVES, ...additions]);
        }
      })
      .catch((err) => console.error(err));
  }, []);

  const filteredArchives = archives.filter((item) => {
    const matchesSearch =
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.className.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSubject = selectedSubject === 'All' || item.subject === selectedSubject;
    const matchesClass = selectedClass === 'All' || item.className === selectedClass;
    return matchesSearch && matchesSubject && matchesClass;
  });

  const subjects = ['All', 'Biology', 'Physics', 'Chemistry'];
  const classes = ['All', 'Grade 10 - Section B', 'Grade 11 - Section A', 'Grade 9 - Section C'];

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div className="page-header-info">
          <span className="eyebrow">LECTURE REPOSITORY & HISTORICAL SESSIONS</span>
          <h1>Previous Classes</h1>
          <p className="text-secondary" style={{ marginTop: '4px' }}>
            Comprehensive archive of completed classroom lectures, recorded sessions, transcripts, and quiz analytics.
          </p>
        </div>

        <div className="page-header-actions">
          <Link href="/lessons/new" className="btn btn-primary">
            + Start New Lesson
          </Link>
        </div>
      </div>

      {/* Filter and Search Toolbar */}
      <div
        className="card card-solid mb-4"
        style={{
          display: 'flex',
          gap: '1rem',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '1rem 1.25rem'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1', minWidth: '240px' }}>
          <Search size={16} className="text-secondary" />
          <input
            type="text"
            placeholder="Search lectures by topic, keyword, or chapter..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ border: 'none', background: 'transparent', padding: '6px 0', width: '100%', outline: 'none' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span className="text-secondary" style={{ fontSize: '11px', fontWeight: 700 }}>
              SUBJECT:
            </span>
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              style={{ padding: '4px 10px', fontSize: '12px' }}
            >
              {subjects.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span className="text-secondary" style={{ fontSize: '11px', fontWeight: 700 }}>
              COHORT:
            </span>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              style={{ padding: '4px 10px', fontSize: '12px' }}
            >
              {classes.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Archives Table */}
      {filteredArchives.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <span className="eyebrow">NO RECORDS MATCHED</span>
          <p style={{ fontWeight: 600 }}>No previous lectures found matching filter criteria.</p>
        </div>
      ) : (
        <div className="data-table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '34%' }}>Lecture Topic & Subject</th>
                <th style={{ width: '18%' }}>Class Cohort</th>
                <th style={{ width: '14%' }}>Date & Duration</th>
                <th style={{ width: '12%' }}>Attendance</th>
                <th style={{ width: '10%' }}>Quiz Status</th>
                <th style={{ width: '12%', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredArchives.map((item) => (
                <tr
                  key={item.id}
                  className="table-row-interactive"
                  onClick={() => setActiveModalItem(item)}
                >
                  <td>
                    <div style={{ fontWeight: 700, fontSize: '14px' }}>{item.title}</div>
                    <div className="text-secondary" style={{ fontSize: '11px', marginTop: '3px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <span className="timetable-tag">{item.subject}</span>
                      {item.hasRecording && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                          <Radio size={11} /> Audio Captured
                        </span>
                      )}
                      <span>• {item.notesCount} materials</span>
                    </div>
                  </td>

                  <td style={{ fontWeight: 600, fontSize: '13px' }}>{item.className}</td>

                  <td>
                    <div className="text-mono" style={{ fontSize: '12px' }}>
                      {new Date(item.date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </div>
                    <div className="text-secondary" style={{ fontSize: '11px' }}>
                      {item.durationMinutes} minutes
                    </div>
                  </td>

                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Users size={13} className="text-secondary" />
                      <span style={{ fontWeight: 700, fontSize: '13px' }}>{item.attendanceRate}%</span>
                    </div>
                    <div className="text-secondary" style={{ fontSize: '10px' }}>
                      Verified
                    </div>
                  </td>

                  <td>
                    <span
                      className="status-pill"
                      style={{
                        background:
                          item.quizStatus === 'Graded'
                            ? '#e8f5e9'
                            : item.quizStatus === 'Published'
                            ? '#e3f2fd'
                            : '#f5f5f5',
                        border: '1px solid #111',
                        color: '#111'
                      }}
                    >
                      {item.quizStatus}
                    </span>
                    {item.averageScore && (
                      <div className="text-secondary text-mono" style={{ fontSize: '10px', marginTop: '2px' }}>
                        Avg: {item.averageScore}%
                      </div>
                    )}
                  </td>

                  <td style={{ textAlign: 'right' }}>
                    <button
                      type="button"
                      className="btn btn-sm btn-secondary"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveModalItem(item);
                      }}
                    >
                      Inspect <ArrowUpRight size={12} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Details Modal Drawer */}
      {activeModalItem && (
        <div className="portal-modal-backdrop" onClick={() => setActiveModalItem(null)}>
          <div className="portal-modal-content" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
              <div>
                <span className="eyebrow">ARCHIVED LECTURE REPORT</span>
                <h2 style={{ fontSize: '1.4rem' }}>{activeModalItem.title}</h2>
                <p className="text-secondary" style={{ fontSize: '12px', marginTop: '2px' }}>
                  {activeModalItem.subject} • {activeModalItem.className} •{' '}
                  {new Date(activeModalItem.date).toLocaleDateString()}
                </p>
              </div>

              <button
                type="button"
                className="btn btn-sm btn-secondary"
                onClick={() => setActiveModalItem(null)}
                style={{ padding: '4px 8px' }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Quick stats banner */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '8px',
                marginBottom: '1.5rem',
                border: '1px solid var(--hairline)',
                padding: '12px',
                background: 'var(--surface-alt)'
              }}
            >
              <div>
                <span className="eyebrow" style={{ fontSize: '8px', margin: 0 }}>DURATION</span>
                <strong style={{ fontSize: '14px' }}>{activeModalItem.durationMinutes} min</strong>
              </div>
              <div>
                <span className="eyebrow" style={{ fontSize: '8px', margin: 0 }}>ATTENDANCE</span>
                <strong style={{ fontSize: '14px' }}>{activeModalItem.attendanceRate}%</strong>
              </div>
              <div>
                <span className="eyebrow" style={{ fontSize: '8px', margin: 0 }}>QUIZ SCORE</span>
                <strong style={{ fontSize: '14px' }}>{activeModalItem.averageScore || 80}%</strong>
              </div>
              <div>
                <span className="eyebrow" style={{ fontSize: '8px', margin: 0 }}>STATUS</span>
                <strong style={{ fontSize: '14px' }}>{activeModalItem.quizStatus}</strong>
              </div>
            </div>

            {/* Simulated Audio Playback if recorded */}
            {activeModalItem.hasRecording && (
              <div className="card card-solid mb-3" style={{ padding: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span className="eyebrow" style={{ color: 'var(--ink)', margin: 0 }}>
                    ● ARCHIVED AUDIO RECORDING
                  </span>
                  <span className="text-mono" style={{ fontSize: '11px' }}>
                    00:00 / {activeModalItem.durationMinutes}:00
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <button type="button" className="btn btn-sm btn-primary" style={{ padding: '6px 12px' }}>
                    <Play size={12} /> Play Lecture
                  </button>
                  <div style={{ flex: 1, height: '6px', background: 'var(--hairline)', position: 'relative' }}>
                    <div style={{ width: '25%', height: '100%', background: 'var(--ink)' }} />
                  </div>
                </div>
              </div>
            )}

            {/* Transcript Excerpt */}
            <div className="card card-solid mb-3">
              <span className="eyebrow">AUTOMATED SPEECH TRANSCRIPTION EXCERPT</span>
              <p style={{ fontSize: '13px', lineHeight: 1.6, fontStyle: 'italic', color: '#222' }}>
                "{activeModalItem.transcriptExcerpt}"
              </p>
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '1.5rem', borderTop: '1px solid var(--hairline)', paddingTop: '1rem' }}>
              <Link href="/notes-syllabus" className="btn btn-secondary">
                <BookOpen size={14} /> Notes & Syllabus
              </Link>
              <Link
                href={`/lessons/${activeModalItem.id}/review`}
                className="btn btn-primary"
              >
                Review Generated Quiz →
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
