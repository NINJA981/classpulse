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

/**
 * Only what a lesson actually carries. Attendance, materials counts and average scores
 * have no source in the backend yet, so they are not shown rather than invented.
 */
interface ClassArchiveItem {
  id: string;
  title: string;
  subject: string;
  className: string;
  date: string;
  durationMinutes?: number;
  hasRecording: boolean;
  quizStatus: 'Published' | 'Draft' | 'Graded';
}


export default function PreviousClassesPage() {
  const [archives, setArchives] = useState<ClassArchiveItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('All');
  const [selectedClass, setSelectedClass] = useState('All');
  const [activeModalItem, setActiveModalItem] = useState<ClassArchiveItem | null>(null);

  useEffect(() => {
    api.getLessons()
      .then((res) => {
        setArchives(
          (res.lessons || []).map((les) => ({
            id: les._id,
            title: les.title,
            subject: les.subject,
            className: les.className,
            date: les.createdAt,
            durationMinutes: les.sourceFile?.durationSec
              ? Math.round(les.sourceFile.durationSec / 60)
              : undefined,
            hasRecording: les.sourceType === 'audio',
            quizStatus: les.status === 'published' ? 'Published' : 'Draft'
          }))
        );
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  // The excerpt is the real transcript, fetched when a row is opened rather than stored
  // on the archive row — most rows are never opened.
  const [transcriptExcerpt, setTranscriptExcerpt] = useState<string | null>(null);

  useEffect(() => {
    if (!activeModalItem) return;
    setTranscriptExcerpt(null);

    let cancelled = false;
    api.getTranscript(activeModalItem.id)
      .then((res) => {
        if (cancelled) return;
        const chosen =
          res.transcripts.find((t) => t.source === res.selected) ?? res.transcripts[0];
        setTranscriptExcerpt(chosen ? chosen.text.slice(0, 400) : '');
      })
      .catch(() => {
        if (!cancelled) setTranscriptExcerpt('');
      });

    return () => {
      cancelled = true;
    };
  }, [activeModalItem]);

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
                      {item.durationMinutes ? `${item.durationMinutes} minutes` : '—'}
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
                <strong style={{ fontSize: '14px' }}>
                  {activeModalItem.durationMinutes ? `${activeModalItem.durationMinutes} min` : '—'}
                </strong>
              </div>
              <div>
                <span className="eyebrow" style={{ fontSize: '8px', margin: 0 }}>RECORDING</span>
                <strong style={{ fontSize: '14px' }}>
                  {activeModalItem.hasRecording ? 'Audio' : 'Document'}
                </strong>
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
                {transcriptExcerpt === null
                  ? 'Loading transcript…'
                  : transcriptExcerpt === ''
                  ? 'No transcript yet — this lesson has not been transcribed.'
                  : `"${transcriptExcerpt}"`}
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
