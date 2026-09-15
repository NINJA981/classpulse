'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '../../lib/api';
import { Lesson, LessonStatus } from '../../types';

export default function LessonsPage() {
  const router = useRouter();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  useEffect(() => {
    loadLessons();
  }, [filterStatus]);

  const loadLessons = async () => {
    try {
      setLoading(true);
      const res = await api.getLessons({
        status: filterStatus === 'all' ? undefined : filterStatus
      });
      setLessons(res.lessons || []);
    } catch (err) {
      console.error('Failed to load lessons:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusPill = (status: LessonStatus) => {
    switch (status) {
      case 'draft':
        return <span className="status-pill status-pill-draft">Draft</span>;
      case 'queued':
      case 'transcribing':
      case 'generating':
      case 'validating':
        return <span className="status-pill status-pill-processing">Processing</span>;
      case 'ready_for_review':
        return <span className="status-pill status-pill-ready">Ready for review</span>;
      case 'published':
        return <span className="status-pill status-pill-published">Published</span>;
      case 'failed':
        return <span className="status-pill status-pill-failed">Failed</span>;
      default:
        return <span className="status-pill status-pill-draft">{status}</span>;
    }
  };

  const handleRowClick = (lesson: Lesson) => {
    if (lesson.status === 'ready_for_review' || lesson.status === 'published') {
      router.push(`/lessons/${lesson._id}/review`);
    } else {
      router.push(`/lessons/${lesson._id}`);
    }
  };

  const formatDate = (isoString: string): string => {
    if (!isoString) return '—';
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString;
    return date.toLocaleDateString('en-US', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-header-info">
          <span className="eyebrow">CLASEPULSE / TEACHER CURRICULUM</span>
          <h1>Lessons</h1>
          <p className="text-secondary" style={{ marginTop: '4px' }}>
            Audited recordings, generated quizzes, and approved classroom assignments.
          </p>
        </div>

        <div className="page-header-actions">
          <Link href="/lessons/new" className="btn btn-primary">
            + New lesson
          </Link>
        </div>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '1.25rem', overflowX: 'auto' }}>
        {[
          { key: 'all', label: 'All Lessons' },
          { key: 'ready_for_review', label: 'Ready for Review' },
          { key: 'published', label: 'Published' },
          { key: 'draft', label: 'Drafts' }
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`btn btn-sm ${filterStatus === tab.key ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilterStatus(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <span className="eyebrow">FETCHING CURRICULUM</span>
          <p style={{ fontWeight: 600 }}>Loading lessons…</p>
        </div>
      ) : lessons.length === 0 ? (
        <div className="card card-solid" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
          <span className="eyebrow">EMPTY REPOSITORY</span>
          <h2 style={{ marginBottom: '0.5rem' }}>No lessons found</h2>
          <p className="text-secondary mb-3" style={{ maxWidth: '400px', margin: '0 auto 1.5rem' }}>
            Record an in-browser lecture or upload curriculum materials to begin generating teacher-grounded quizzes.
          </p>
          <Link href="/lessons/new" className="btn btn-primary">
            Create your first lesson
          </Link>
        </div>
      ) : (
        <div className="data-table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '38%' }}>Title</th>
                <th style={{ width: '18%' }}>Subject</th>
                <th style={{ width: '18%' }}>Class</th>
                <th style={{ width: '14%' }}>Date</th>
                <th style={{ width: '12%', textAlign: 'right' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {lessons.map((lesson) => (
                <tr
                  key={lesson._id}
                  className="table-row-interactive"
                  onClick={() => handleRowClick(lesson)}
                >
                  <td>
                    <div style={{ fontWeight: 700, fontSize: '14px' }}>{lesson.title}</div>
                    <div className="text-secondary" style={{ fontSize: '11px', marginTop: '2px' }}>
                      {lesson.sourceType === 'audio' ? 'Audio Source' : 'Document Source'}
                    </div>
                  </td>
                  <td style={{ fontWeight: 500 }}>{lesson.subject}</td>
                  <td style={{ fontWeight: 500 }}>{lesson.className}</td>
                  <td className="text-secondary text-mono">{formatDate(lesson.createdAt)}</td>
                  <td style={{ textAlign: 'right' }}>{getStatusPill(lesson.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
