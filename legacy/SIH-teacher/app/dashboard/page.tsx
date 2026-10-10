'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getAuthTeacher, TeacherProfile } from '../../lib/auth';
import { api } from '../../lib/api';
import { Lesson } from '../../types';
import {
  Calendar,
  PlusCircle,
  Radio,
  Zap,
  BookOpen,
  ArrowRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  Users,
  Video
} from 'lucide-react';

export default function DashboardPage() {
  const router = useRouter();
  const [teacher, setTeacher] = useState<TeacherProfile | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const auth = getAuthTeacher();
    if (!auth) {
      router.push('/login');
      return;
    }
    setTeacher(auth);

    const fetchLessons = async () => {
      try {
        const res = await api.getLessons();
        setLessons(res.lessons || []);
      } catch (err) {
        console.error('Failed to load lessons for dashboard:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchLessons();
  }, [router]);

  const todaySchedule = [
    {
      id: 'sch_1',
      time: '09:00 - 10:15 AM',
      subject: 'Biology',
      topic: 'Cellular Respiration & Krebs Cycle',
      className: 'Grade 10 - Section B',
      room: 'Room 304 (Life Sci Lab)',
      status: 'live',
      studentsCount: 34
    },
    {
      id: 'sch_2',
      time: '11:30 - 12:45 PM',
      subject: 'Physics',
      topic: 'Newtonian Dynamics & Circular Motion',
      className: 'Grade 11 - Section A',
      room: 'Lecture Hall B',
      status: 'upcoming',
      studentsCount: 28
    },
    {
      id: 'sch_3',
      time: '02:00 - 03:15 PM',
      subject: 'General Science',
      topic: 'Atomic Structure & Periodic Trends',
      className: 'Grade 9 - Section C',
      room: 'Room 202',
      status: 'upcoming',
      studentsCount: 32
    }
  ];

  return (
    <div>
      {/* Top Banner / Welcome */}
      <div className="page-header" style={{ alignItems: 'flex-start' }}>
        <div className="page-header-info">
          <span className="eyebrow">FACULTY COMMAND CENTER • {teacher?.department || 'ACADEMICS'}</span>
          <h1>Welcome, {teacher?.name || 'Professor'}</h1>
          <p className="text-secondary" style={{ marginTop: '4px' }}>
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
              year: 'numeric'
            })}{' '}
            • Active Term 2026
          </p>
        </div>

        <div className="page-header-actions" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <Link href="/lessons/new" className="btn btn-primary">
            <PlusCircle size={15} />
            + New Lesson
          </Link>
          <Link href="/record-transcribe" className="btn btn-secondary">
            <Radio size={15} />
            Record Live
          </Link>
        </div>
      </div>

      {/* KPI Metrics */}
      <div className="metrics-grid">
        <div className="metric-card">
          <span className="eyebrow">TODAY’S SCHEDULE</span>
          <div className="metric-number">3 Classes</div>
          <div className="metric-sub" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span className="timetable-tag live-badge">1 Live Now</span>
            <span>2 upcoming slots</span>
          </div>
        </div>

        <div className="metric-card">
          <span className="eyebrow">LECTURE ARCHIVE</span>
          <div className="metric-number">{lessons.length || 18}</div>
          <div className="metric-sub">Recorded & documented lectures</div>
        </div>

        <div className="metric-card">
          <span className="eyebrow">PENDING REVIEW</span>
          <div className="metric-number">
            {lessons.filter((l) => l.status === 'ready_for_review').length || 2}
          </div>
          <div className="metric-sub">AI quizzes awaiting faculty sign-off</div>
        </div>

        <div className="metric-card">
          <span className="eyebrow">STUDENT Q&A</span>
          <div className="metric-number">4 Open</div>
          <div className="metric-sub">Queries needing instructor response</div>
        </div>
      </div>

      {/* Direct Quick Actions Console */}
      <div style={{ marginBottom: '2.5rem' }}>
        <span className="eyebrow">QUICK ACTION CONSOLE</span>
        <div className="action-cards-grid">
          <Link href="/lessons/new" className="action-card">
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span className="eyebrow" style={{ color: 'var(--ink)' }}>SESSION SETUP</span>
                <PlusCircle size={20} />
              </div>
              <h3 style={{ marginBottom: '6px' }}>Start New Lesson</h3>
              <p className="text-secondary" style={{ fontSize: '13px' }}>
                Initiate an active classroom lecture, generate quiz questions, or upload curriculum notes.
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '16px', fontWeight: 700, fontSize: '12px' }}>
              Launch Setup <ArrowRight size={14} />
            </div>
          </Link>

          <Link href="/record-transcribe" className="action-card">
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span className="eyebrow" style={{ color: 'var(--ink)' }}>SPEECH & MEDIA</span>
                <Radio size={20} />
              </div>
              <h3 style={{ marginBottom: '6px' }}>Record & Transcribe</h3>
              <p className="text-secondary" style={{ fontSize: '13px' }}>
                Capture live camera or microphone audio with real-time AI speech-to-text transcription.
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '16px', fontWeight: 700, fontSize: '12px' }}>
              Open Recorder <ArrowRight size={14} />
            </div>
          </Link>

          <Link href="/classes-circle" className="action-card">
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span className="eyebrow" style={{ color: 'var(--ink)' }}>TEST TECH</span>
                <Zap size={20} />
              </div>
              <h3 style={{ marginBottom: '6px' }}>Fast Test / Exit Ticket</h3>
              <p className="text-secondary" style={{ fontSize: '13px' }}>
                Fire rapid 60-second diagnostic quizzes or exit tickets to measure live student comprehension.
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '16px', fontWeight: 700, fontSize: '12px' }}>
              Launch Fast Test <ArrowRight size={14} />
            </div>
          </Link>

          <Link href="/timetable" className="action-card">
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span className="eyebrow" style={{ color: 'var(--ink)' }}>SCHEDULE</span>
                <Calendar size={20} />
              </div>
              <h3 style={{ marginBottom: '6px' }}>Weekly Timetable</h3>
              <p className="text-secondary" style={{ fontSize: '13px' }}>
                Inspect your classroom allocations, timings, lab periods, and scheduled office hours.
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '16px', fontWeight: 700, fontSize: '12px' }}>
              View Schedule <ArrowRight size={14} />
            </div>
          </Link>
        </div>
      </div>

      {/* Two Column Section: Today's Schedule & Live Q&A / Action Items */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
        {/* Today's Schedule Box */}
        <div className="card card-solid">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div>
              <span className="eyebrow">TODAY’S LECTURES</span>
              <h2 style={{ fontSize: '1.2rem' }}>Teaching Agenda</h2>
            </div>
            <Link href="/timetable" className="btn btn-sm btn-secondary">
              Full Schedule →
            </Link>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {todaySchedule.map((slot) => (
              <div
                key={slot.id}
                style={{
                  padding: '12px 14px',
                  border: slot.status === 'live' ? '2px solid var(--ink)' : '1px solid var(--hairline)',
                  background: slot.status === 'live' ? '#fffdf7' : 'var(--surface)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '12px'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span className="text-mono" style={{ fontSize: '11px', fontWeight: 700 }}>
                      {slot.time}
                    </span>
                    {slot.status === 'live' ? (
                      <span className="timetable-tag live-badge">● LIVE NOW</span>
                    ) : (
                      <span className="timetable-tag">UPCOMING</span>
                    )}
                  </div>
                  <div style={{ fontWeight: 800, fontSize: '14px' }}>{slot.topic}</div>
                  <div className="text-secondary" style={{ fontSize: '12px', marginTop: '2px' }}>
                    {slot.className} • {slot.room}
                  </div>
                </div>

                <div>
                  {slot.status === 'live' ? (
                    <Link href="/record-transcribe" className="btn btn-sm btn-primary">
                      <Radio size={12} />
                      Join Session
                    </Link>
                  ) : (
                    <Link href="/lessons/new" className="btn btn-sm btn-secondary">
                      Prepare
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Live Interaction & Action Items */}
        <div className="card card-solid">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div>
              <span className="eyebrow">STUDENT INTERACTIONS</span>
              <h2 style={{ fontSize: '1.2rem' }}>Recent Student Queries</h2>
            </div>
            <Link href="/live-qa" className="btn btn-sm btn-secondary">
              Open Q&A Board →
            </Link>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[
              {
                student: 'Ananya H. (Grade 10-B)',
                question: 'Can you re-explain the difference between Cyclic and Non-cyclic photophosphorylation?',
                time: '12m ago',
                upvotes: 6
              },
              {
                student: 'Vikram S. (Grade 11-A)',
                question: 'In the friction problem on inclined planes, why do we resolve gravity into sin and cos?',
                time: '34m ago',
                upvotes: 4
              },
              {
                student: 'Deepak M. (Grade 10-B)',
                question: 'Will today’s exit ticket questions be included in the midterm exam?',
                time: '1h ago',
                upvotes: 2
              }
            ].map((q, idx) => (
              <div
                key={idx}
                style={{
                  padding: '10px 12px',
                  border: '1px solid var(--hairline)',
                  background: 'var(--surface)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ fontWeight: 700, fontSize: '12px' }}>{q.student}</span>
                  <span className="text-secondary text-mono" style={{ fontSize: '10px' }}>
                    {q.time} • ▲ {q.upvotes}
                  </span>
                </div>
                <p style={{ fontSize: '13px', color: 'var(--ink)' }}>{q.question}</p>
                <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'flex-end' }}>
                  <Link
                    href="/live-qa"
                    className="text-mono"
                    style={{ fontSize: '11px', fontWeight: 700, textDecoration: 'underline', color: 'var(--ink)' }}
                  >
                    Reply in Q&A Hub →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Lessons Repository */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div>
            <span className="eyebrow">CURRICULUM ARCHIVE</span>
            <h2 style={{ fontSize: '1.2rem' }}>Recent Lessons & Generated Quizzes</h2>
          </div>
          <Link href="/previous-classes" className="btn btn-secondary btn-sm">
            View All Previous Classes →
          </Link>
        </div>

        {loading ? (
          <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
            <span className="eyebrow">CONNECTING</span>
            <p>Loading recent curriculum...</p>
          </div>
        ) : (
          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '35%' }}>Lesson Title</th>
                  <th style={{ width: '18%' }}>Subject</th>
                  <th style={{ width: '18%' }}>Class Cohort</th>
                  <th style={{ width: '15%' }}>Source</th>
                  <th style={{ width: '14%', textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {lessons.slice(0, 4).map((lesson) => (
                  <tr key={lesson._id} className="table-row-interactive">
                    <td>
                      <div style={{ fontWeight: 700, fontSize: '13px' }}>{lesson.title}</div>
                      <div className="text-secondary text-mono" style={{ fontSize: '10px', marginTop: '2px' }}>
                        Created: {new Date(lesson.createdAt).toLocaleDateString()}
                      </div>
                    </td>
                    <td style={{ fontWeight: 500 }}>{lesson.subject}</td>
                    <td style={{ fontWeight: 500 }}>{lesson.className}</td>
                    <td>
                      <span className="timetable-tag" style={{ textTransform: 'uppercase' }}>
                        {lesson.sourceType || 'document'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <Link
                        href={`/lessons/${lesson._id}/review`}
                        className="btn btn-sm btn-secondary"
                        style={{ padding: '4px 10px' }}
                      >
                        Review Quiz
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
