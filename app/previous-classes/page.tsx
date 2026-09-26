'use client';

import React, { useState, useEffect, useRef } from 'react';
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
  Pause,
  Headphones,
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
  const [activeAudioItem, setActiveAudioItem] = useState<ClassArchiveItem | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handleToggleAudio = (item: ClassArchiveItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (activeAudioItem?.id === item.id) {
      if (isPlaying) {
        audioRef.current?.pause();
        setIsPlaying(false);
      } else {
        audioRef.current?.play();
        setIsPlaying(true);
      }
    } else {
      setActiveAudioItem(item);
      setIsPlaying(true);
    }
  };

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
                <th style={{ width: '28%' }}>Lecture Topic & Subject</th>
                <th style={{ width: '18%' }}>Class Cohort</th>
                <th style={{ width: '14%' }}>Date & Duration</th>
                <th style={{ width: '10%' }}>Attendance</th>
                <th style={{ width: '10%' }}>Quiz Status</th>
                <th style={{ width: '20%', textAlign: 'right' }}>Actions</th>
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
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', color: '#00875a', fontWeight: 700 }}>
                          <Radio size={11} /> Audio Captured (MinIO S3)
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
                    <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center', justifyContent: 'flex-end' }}>
                      {item.hasRecording && (
                        <button
                          type="button"
                          className={`btn btn-sm ${activeAudioItem?.id === item.id && isPlaying ? 'btn-primary' : 'btn-secondary'}`}
                          onClick={(e) => handleToggleAudio(item, e)}
                          title="Listen to class recording from MinIO S3"
                          style={{
                            padding: '4px 10px',
                            fontSize: '12px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            border: activeAudioItem?.id === item.id && isPlaying ? '2px solid #111' : undefined
                          }}
                        >
                          {activeAudioItem?.id === item.id && isPlaying ? (
                            <>
                              <Pause size={12} /> Pause
                            </>
                          ) : (
                            <>
                              <Headphones size={12} /> Listen Audio
                            </>
                          )}
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn btn-sm btn-secondary"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveModalItem(item);
                        }}
                        style={{ padding: '4px 10px', fontSize: '12px' }}
                      >
                        Inspect <ArrowUpRight size={12} />
                      </button>
                    </div>
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

            {/* Real Audio Playback from MinIO S3 */}
            {activeModalItem.hasRecording && (
              <div className="card card-solid mb-3" style={{ padding: '1.25rem', border: '2px solid #111', background: '#faf9f6' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Headphones size={15} />
                    <span className="eyebrow" style={{ color: 'var(--ink)', margin: 0 }}>
                      ● ARCHIVED AUDIO RECORDING (MINIO S3 STORAGE)
                    </span>
                  </div>
                  <span className="status-pill status-pill-ready">
                    MinIO S3
                  </span>
                </div>
                <p className="text-secondary" style={{ fontSize: '12px', marginBottom: '10px' }}>
                  Stream captured lecture audio on demand from MinIO S3 object storage.
                </p>
                <audio
                  controls
                  src={api.getLessonAudioUrl(activeModalItem.id)}
                  style={{ width: '100%', outline: 'none' }}
                />
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

      {/* Floating Bottom Audio Player Dock when listening from table */}
      {activeAudioItem && (
        <div
          style={{
            position: 'fixed',
            bottom: '1.5rem',
            right: '1.5rem',
            left: 'max(1.5rem, calc(260px + 1.5rem))',
            zIndex: 999,
            background: '#ffffff',
            border: '2px solid #111111',
            boxShadow: '4px 4px 0px #111111',
            padding: '1rem 1.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '1.25rem',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ minWidth: '180px', flex: '1 1 200px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className="recording-dot" style={{ background: '#00875a' }} />
              <span className="eyebrow" style={{ margin: 0, color: '#00875a', fontSize: '9px' }}>
                STREAMING AUDIO • MINIO S3 OBJECT STORAGE
              </span>
            </div>
            <div style={{ fontWeight: 800, fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {activeAudioItem.title}
            </div>
            <div className="text-secondary" style={{ fontSize: '11px' }}>
              {activeAudioItem.subject} • {activeAudioItem.className}
            </div>
          </div>

          <div style={{ flex: '2 1 300px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <audio
              ref={audioRef}
              controls
              autoPlay
              src={api.getLessonAudioUrl(activeAudioItem.id)}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onEnded={() => setIsPlaying(false)}
              style={{ width: '100%', height: '36px' }}
            />
          </div>

          <button
            type="button"
            className="btn btn-sm btn-secondary"
            onClick={() => {
              if (audioRef.current) {
                audioRef.current.pause();
              }
              setActiveAudioItem(null);
              setIsPlaying(false);
            }}
            title="Close audio player"
            style={{ padding: '6px' }}
          >
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
