'use client';

import React, { useState, useEffect } from 'react';
import TranscriptPanel from '../../../../components/TranscriptPanel';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { api } from '../../../../lib/api';
import { Lesson, Question, Assignment, QuestionDifficulty } from '../../../../types';

export default function LessonReviewPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === 'string' ? params.id : Array.isArray(params.id) ? params.id[0] : '';

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Card-level inline edit state
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    stem?: string;
    options?: string[];
    correctIndex?: number;
    correctText?: string;
    explanation?: string;
    topicTag?: string;
    difficulty?: QuestionDifficulty;
  }>({});

  // Assignment inline edit state
  const [editingAssignment, setEditingAssignment] = useState<boolean>(false);
  const [assignmentEditForm, setAssignmentEditForm] = useState<{
    prompt?: string;
    estimatedMinutes?: number | string;
    rubric?: Array<{ criterion: string; marks: number; descriptor: string }>;
  }>({});

  // Publish / feedback state
  const [isPublishing, setIsPublishing] = useState<boolean>(false);
  const [isRegenerating, setIsRegenerating] = useState<boolean>(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [conflictError, setConflictError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      loadData();
    }
  }, [id]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [lessonRes, questionsRes, subRes, analyticsRes] = await Promise.all([
        api.getLesson(id),
        api.getLessonQuestions(id),
        api.getLessonSubmissions(id).catch(() => ({ submissions: [] })),
        api.getLessonAnalytics(id).catch(() => null)
      ]);

      setLesson(lessonRes);
      setQuestions(questionsRes.questions || []);
      setAssignment(questionsRes.assignment || null);
      setSubmissions(subRes?.submissions || []);
      setAnalytics(analyticsRes);
    } catch (err) {
      console.error('Failed to load review data:', err);
    } finally {
      setLoading(false);
    }
  };

  const approvedQuestions = questions.filter((q) => q.status === 'approved');
  const draftQuestions = questions.filter((q) => q.status === 'draft');
  const rejectedQuestions = questions.filter((q) => q.status === 'rejected');
  const canPublish = approvedQuestions.length > 0;

  // Single Question Approve
  const handleApprove = async (questionId: string) => {
    try {
      setConflictError(null);
      await api.approveQuestion(questionId);
      setQuestions((prev) =>
        prev.map((q) => (q._id === questionId ? { ...q, status: 'approved' } : q))
      );
      showNotice('Question approved.');
    } catch (err) {
      console.error('Approve failed:', err);
    }
  };

  // Single Question Reject
  const handleReject = async (questionId: string) => {
    try {
      setConflictError(null);
      await api.rejectQuestion(questionId);
      setQuestions((prev) =>
        prev.map((q) => (q._id === questionId ? { ...q, status: 'rejected' } : q))
      );
      showNotice('Question rejected.');
    } catch (err) {
      console.error('Reject failed:', err);
    }
  };

  // Bulk Approve All
  const handleApproveAll = async () => {
    const unapprovedIds = questions
      .filter((q) => q.status !== 'approved')
      .map((q) => q._id);

    if (unapprovedIds.length === 0) return;

    try {
      setConflictError(null);
      await api.approveQuestion(unapprovedIds);
      setQuestions((prev) =>
        prev.map((q) => ({ ...q, status: 'approved' }))
      );
      showNotice(`All ${unapprovedIds.length} questions approved.`);
    } catch (err) {
      console.error('Bulk approve failed:', err);
    }
  };

  // Inline Edit Question
  const startEditQuestion = (q: Question) => {
    setEditingQuestionId(q._id);
    setEditForm({
      stem: q.stem,
      options: q.options ? [...q.options] : [],
      correctIndex: q.correctIndex ?? 0,
      correctText: q.correctText || '',
      explanation: q.explanation || '',
      topicTag: q.topicTag || '',
      difficulty: q.difficulty || 'medium'
    });
  };

  const cancelEditQuestion = () => {
    setEditingQuestionId(null);
    setEditForm({});
  };

  const saveEditQuestion = async (questionId: string) => {
    try {
      const updated = await api.updateQuestion(questionId, {
        stem: editForm.stem,
        options: editForm.options,
        correctIndex: editForm.correctIndex,
        correctText: (editForm.options && editForm.correctIndex !== undefined ? editForm.options[editForm.correctIndex] : editForm.correctText) || '',
        explanation: editForm.explanation,
        topicTag: editForm.topicTag,
        difficulty: editForm.difficulty
      });

      setQuestions((prev) =>
        prev.map((q) => (q._id === questionId ? updated : q))
      );
      setEditingQuestionId(null);
      showNotice('Question updated and marked as teacher-edited.');
    } catch (err) {
      console.error('Save question edit failed:', err);
    }
  };

  // Assignment Actions
  const handleApproveAssignment = async () => {
    try {
      await api.updateAssignment(id, { status: 'approved' });
      setAssignment((prev) => (prev ? { ...prev, status: 'approved' } : null));
      showNotice('Assignment & rubric approved.');
    } catch (err) {
      console.error('Approve assignment failed:', err);
    }
  };

  const handleRejectAssignment = async () => {
    try {
      await api.updateAssignment(id, { status: 'rejected' });
      setAssignment((prev) => (prev ? { ...prev, status: 'rejected' } : null));
      showNotice('Assignment rejected.');
    } catch (err) {
      console.error('Reject assignment failed:', err);
    }
  };

  const startEditAssignment = () => {
    if (!assignment) return;
    setEditingAssignment(true);
    setAssignmentEditForm({
      prompt: assignment.prompt,
      estimatedMinutes: assignment.estimatedMinutes,
      rubric: assignment.rubric ? JSON.parse(JSON.stringify(assignment.rubric)) : []
    });
  };

  const saveEditAssignment = async () => {
    try {
      const updated = await api.updateAssignment(id, {
        prompt: assignmentEditForm.prompt,
        estimatedMinutes: Number(assignmentEditForm.estimatedMinutes),
        rubric: assignmentEditForm.rubric
      });
      setAssignment(updated);
      setEditingAssignment(false);
      showNotice('Assignment updated.');
    } catch (err) {
      console.error('Save assignment edit failed:', err);
    }
  };

  // Regenerate Entire Set (Keeps approved, replaces drafts)
  const handleRegenerate = async () => {
    const confirmRegen = window.confirm(
      'Regenerate questions? Approved questions will be preserved, and unapproved drafts will be replaced with new generations.'
    );
    if (!confirmRegen) return;

    try {
      setIsRegenerating(true);
      await api.regenerate(id);
      router.push(`/lessons/${id}`);
    } catch (err) {
      console.error('Regeneration failed:', err);
      setIsRegenerating(false);
    }
  };

  // Publish Lesson
  const handlePublish = async () => {
    setConflictError(null);

    // Hard UI Gate as required
    if (!canPublish) {
      setConflictError(
        'Cannot publish lesson: At least one question must be approved by the teacher before publishing to students.'
      );
      return;
    }

    try {
      setIsPublishing(true);
      const res = await api.publishLesson(id);
      showNotice(`Lesson published successfully! (${res.approvedQuestionsCount} questions available to students).`);
      setLesson((prev) => (prev ? { ...prev, status: 'published' } : null));
    } catch (err: any) {
      console.error('Publish failed:', err);
      if (err.status === 409 || err.data?.statusCode === 409) {
        setConflictError(
          err.message ||
            'Cannot publish lesson: At least one question must be approved by the teacher before publishing to students.'
        );
      } else {
        setConflictError(err.message || 'Publish failed. Please try again.');
      }
    } finally {
      setIsPublishing(false);
    }
  };

  const showNotice = (msg: string) => {
    setActionNotice(msg);
    setTimeout(() => {
      setActionNotice(null);
    }, 4000);
  };

  if (loading) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
        <span className="eyebrow">RETRIEVING CURRICULUM</span>
        <p style={{ fontWeight: 600 }}>Loading review deck…</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div className="page-header-info">
          <span className="eyebrow">CURRICULUM REVIEW & APPROVAL</span>
          <h1>{lesson ? lesson.title : 'Review Lesson'}</h1>
          <p className="text-secondary" style={{ marginTop: '4px' }}>
            {lesson?.subject} • {lesson?.className} • Grounded in {lesson?.sourceType === 'audio' ? 'Audio Recording' : 'Curriculum Document'}
          </p>
        </div>

        <div className="page-header-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleRegenerate}
            disabled={isRegenerating}
            title="Keeps approved questions, replaces drafts"
          >
            {isRegenerating ? 'Queuing…' : '↻ Regenerate Set'}
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleApproveAll}
            disabled={draftQuestions.length === 0}
          >
            ✓ Approve all ({draftQuestions.length} remaining)
          </button>

          <button
            type="button"
            className="btn btn-primary"
            onClick={handlePublish}
            disabled={isPublishing || !canPublish || lesson?.status === 'published'}
          >
            {lesson?.status === 'published'
              ? '✓ Published'
              : isPublishing
              ? 'Publishing…'
              : 'Publish to Students'}
          </button>

          {lesson?.status === 'published' && (
            <Link
              href={`/lessons/${id}/live-host`}
              className="btn btn-primary"
              style={{ background: '#10b981', borderColor: '#059669', color: '#fff', fontWeight: 800 }}
            >
              ⚡ Launch Live Quiz
            </Link>
          )}
        </div>
      </div>

      {/* Action Toast / Notice */}
      {actionNotice && (
        <div
          className="card mb-3"
          style={{ border: '1px solid var(--ink)', background: 'var(--surface-alt)', padding: '10px 16px' }}
        >
          <div className="flex-between">
            <span style={{ fontSize: '13px', fontWeight: 700 }}>{actionNotice}</span>
            <span className="eyebrow" style={{ margin: 0 }}>SYSTEM LOGGED</span>
          </div>
        </div>
      )}

      {/* 409 Conflict Banner / Non-negotiable Rule Notification */}
      {conflictError && (
        <div className="publish-gate-notice mb-3" style={{ border: '2px solid var(--ink)' }}>
          <div>
            <span className="notice-badge">409 GATE ENFORCEMENT</span>
            <p style={{ fontWeight: 700, fontSize: '13px', marginTop: '6px' }}>
              {conflictError}
            </p>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setConflictError(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Hard Gate Notice if 0 questions are approved */}
      {!canPublish && lesson?.status !== 'published' && !conflictError && (
        <div className="publish-gate-notice mb-3">
          <div>
            <span className="notice-badge">NON-NEGOTIABLE SAFETY GATE</span>
            <p style={{ fontWeight: 700, fontSize: '13px', marginTop: '6px' }}>
              Publishing is disabled: At least one question must be approved before publishing to students.
            </p>
            <p className="text-secondary" style={{ fontSize: '11px', marginTop: '2px' }}>
              Tap "Approve" on any question card or click "Approve all" to unlock publishing.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleApproveAll}
          >
            Quick Approve All
          </button>
        </div>
      )}

      {/* Status Bar */}
      <div className="review-stats-bar">
        <div className="review-stat-counter">
          <span className="eyebrow" style={{ margin: 0 }}>AUDIT PROGRESS:</span>
          <span style={{ fontWeight: 900, fontSize: '1.25rem' }}>
            {approvedQuestions.length} / {questions.length}
          </span>
          <span className="text-secondary" style={{ fontSize: '12px' }}>
            Questions Approved ({rejectedQuestions.length} Rejected)
          </span>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <span className="status-pill status-pill-ready">
            {approvedQuestions.length} Approved
          </span>
          <span className="status-pill status-pill-draft">
            {draftQuestions.length} Pending
          </span>
          {rejectedQuestions.length > 0 && (
            <span className="status-pill status-pill-failed">
              {rejectedQuestions.length} Rejected
            </span>
          )}
        </div>
      </div>

      {/* What the class actually said — the questions were written from this. */}
      {id && <TranscriptPanel lessonId={id} />}

      {/* Live Student Quiz Submissions & Diagnostic Concept Heatmap (When published) */}
      {lesson?.status === 'published' && (
        <div
          className="card mb-4"
          style={{
            border: '2px solid var(--ink)',
            background: '#faf9f6',
            padding: '1.5rem'
          }}
        >
          {/* Header */}
          <div className="flex-between mb-3">
            <div>
              <span className="eyebrow" style={{ color: 'var(--ink)' }}>
                DIAGNOSTIC ANALYTICS & CONCEPT MASTERY
              </span>
              <h3 style={{ fontSize: '1.3rem', fontWeight: 900, marginTop: '2px' }}>
                Class Mastery Heatmap & AI Remedial Notes
              </h3>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Link
                href={`/lessons/${id}/live-host`}
                className="btn btn-sm btn-primary"
                style={{ background: '#10b981', borderColor: '#059669', color: '#fff', fontWeight: 800 }}
              >
                ⚡ Launch Live In-Class Quiz
              </Link>
            </div>
          </div>

          {/* Aggregate Metrics Bar */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: '12px',
              marginBottom: '1.5rem'
            }}
          >
            <div style={{ padding: '12px 14px', background: '#fff', border: '1px solid var(--hairline)', borderRadius: '6px' }}>
              <span className="eyebrow" style={{ fontSize: '10px' }}>CLASS MASTERY</span>
              <p style={{ fontSize: '1.6rem', fontWeight: 900, margin: '2px 0 0 0' }}>
                {analytics?.classAveragePct ?? (submissions.length > 0 ? Math.round(submissions.reduce((a, b) => a + b.scorePct, 0) / submissions.length) : 0)}%
              </p>
              <span className="text-secondary" style={{ fontSize: '11px' }}>
                {submissions.length} total attempt{submissions.length === 1 ? '' : 's'}
              </span>
            </div>

            <div style={{ padding: '12px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px' }}>
              <span className="eyebrow" style={{ fontSize: '10px', color: '#dc2626' }}>CRITICAL GAPS (&lt;50%)</span>
              <p style={{ fontSize: '1.6rem', fontWeight: 900, color: '#dc2626', margin: '2px 0 0 0' }}>
                {analytics?.criticalGapsCount ?? 0}
              </p>
              <span className="text-secondary" style={{ fontSize: '11px' }}>Requires immediate review</span>
            </div>

            <div style={{ padding: '12px 14px', background: '#fefce8', border: '1px solid #fef08a', borderRadius: '6px' }}>
              <span className="eyebrow" style={{ fontSize: '10px', color: '#ca8a04' }}>MODERATE GAPS (50-75%)</span>
              <p style={{ fontSize: '1.6rem', fontWeight: 900, color: '#ca8a04', margin: '2px 0 0 0' }}>
                {analytics?.moderateGapsCount ?? 0}
              </p>
              <span className="text-secondary" style={{ fontSize: '11px' }}>Concept refresher helpful</span>
            </div>

            <div style={{ padding: '12px 14px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px' }}>
              <span className="eyebrow" style={{ fontSize: '10px', color: '#16a34a' }}>MASTERED (&gt;75%)</span>
              <p style={{ fontSize: '1.6rem', fontWeight: 900, color: '#16a34a', margin: '2px 0 0 0' }}>
                {analytics?.masteredCount ?? questions.length}
              </p>
              <span className="text-secondary" style={{ fontSize: '11px' }}>Solid understanding</span>
            </div>
          </div>

          {/* Question Heatmap Cards */}
          <div className="mb-4">
            <span className="eyebrow" style={{ marginBottom: '8px', display: 'block' }}>
              CONCEPT ACCURACY HEATMAP (BY QUESTION)
            </span>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '10px' }}>
              {(analytics?.questions || questions).map((q: any, qIdx: number) => {
                const acc = q.accuracyPct ?? 100;
                const statusColor = acc < 50 ? '#ef4444' : acc < 75 ? '#f59e0b' : '#10b981';
                const statusBg = acc < 50 ? '#fef2f2' : acc < 75 ? '#fffbeb' : '#f0fdf4';

                return (
                  <div
                    key={q.questionId || q._id || qIdx}
                    style={{
                      border: `2px solid ${statusColor}`,
                      background: statusBg,
                      borderRadius: '6px',
                      padding: '12px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <span style={{ fontWeight: 800, fontSize: '12px' }}>Q{qIdx + 1}: {q.topicTag || 'Concept'}</span>
                      <span
                        style={{
                          fontWeight: 900,
                          fontSize: '11px',
                          color: statusColor,
                          background: '#fff',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          border: `1px solid ${statusColor}`
                        }}
                      >
                        {q.totalAttempts > 0 ? `${acc}% accuracy` : 'Pending attempts'}
                      </span>
                    </div>

                    <p style={{ fontSize: '12px', fontWeight: 600, margin: '4px 0', lineHeight: 1.4 }} className="line-clamp-2">
                      {q.stem}
                    </p>

                    <div style={{ width: '100%', height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden', margin: '8px 0 4px 0' }}>
                      <div
                        style={{
                          width: `${q.totalAttempts > 0 ? acc : 100}%`,
                          height: '100%',
                          background: statusColor
                        }}
                      />
                    </div>

                    {q.sourceCitation && (
                      <span className="text-secondary" style={{ fontSize: '10px' }}>
                        📍 {q.sourceCitation}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* AI Remedial Refresher Notes */}
          {analytics?.remedialNotes && analytics.remedialNotes.length > 0 && (
            <div style={{ borderTop: '1px solid var(--hairline)', paddingTop: '1.25rem', marginBottom: '1.5rem' }}>
              <span className="eyebrow" style={{ color: '#0284c7', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                ✨ TARGETED AI REMEDIAL REFRESHERS (BASED ON LECTURE TRANSCRIPT)
              </span>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {analytics.remedialNotes.map((rem: any, rIdx: number) => (
                  <div
                    key={rem.questionId || rIdx}
                    style={{
                      background: '#fff',
                      border: '1px solid #cbd5e1',
                      borderLeft: '4px solid #0284c7',
                      borderRadius: '6px',
                      padding: '12px 16px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <span style={{ fontWeight: 800, fontSize: '13px', color: '#0f172a' }}>
                        Concept: {rem.topic}
                      </span>
                      {rem.sourceTimestamp && (
                        <span className="badge badge-ink" style={{ fontSize: '10px' }}>
                          Timestamp: {rem.sourceTimestamp}
                        </span>
                      )}
                    </div>

                    <div style={{ marginBottom: '6px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 800, color: '#dc2626' }}>ROOT MISCONCEPTION: </span>
                      <span style={{ fontSize: '12px', color: '#334155' }}>{rem.misconception}</span>
                    </div>

                    <div style={{ marginBottom: '6px', background: '#f8fafc', padding: '8px 12px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                      <span style={{ fontSize: '11px', fontWeight: 800, color: '#0284c7' }}>~60s REFRESHER EXPLANATION: </span>
                      <p style={{ fontSize: '12px', color: '#1e293b', margin: '2px 0 0 0', lineHeight: 1.4 }}>
                        {rem.remedialNote}
                      </p>
                    </div>

                    <div style={{ fontSize: '11px', color: '#059669', fontWeight: 700 }}>
                      💡 Recommended Action: {rem.suggestedAction}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Student Submissions List */}
          <div style={{ borderTop: '1px solid var(--hairline)', paddingTop: '1.25rem' }}>
            <span className="eyebrow" style={{ marginBottom: '8px', display: 'block' }}>
              INDIVIDUAL STUDENT SUBMISSIONS ({submissions.length})
            </span>

            {submissions.length === 0 ? (
              <p className="text-secondary" style={{ fontSize: '13px' }}>
                No student submissions yet. Students can access this quiz in their student portal or via Live In-Class Quiz.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {submissions.map((sub, sIdx) => (
                  <div
                    key={sub.id || sIdx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      background: '#fff',
                      border: '1px solid var(--hairline)',
                      borderRadius: '4px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontWeight: 800, fontSize: '13px' }}>{sub.studentName}</span>
                      <span className="text-secondary" style={{ fontSize: '11px' }}>
                        {new Date(sub.submittedAt).toLocaleTimeString()} • {sub.correct}/{sub.total} correct
                      </span>
                    </div>
                    <span
                      className={`status-pill ${
                        sub.scorePct >= 70 ? 'status-pill-ready' : sub.scorePct >= 40 ? 'status-pill-draft' : 'status-pill-failed'
                      }`}
                      style={{ fontWeight: 800 }}
                    >
                      {sub.scorePct}%
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Question Cards Stack */}
      <div>
        <div className="flex-between mb-2">
          <span className="eyebrow">QUESTION CARDS (EVALUATE & AUDIT)</span>
          <span className="text-secondary" style={{ fontSize: '11px' }}>
            Average evaluation time: ~8 seconds
          </span>
        </div>

        {questions.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
            <span className="eyebrow">NO QUESTIONS</span>
            <p>No questions generated yet. Click "Regenerate Set" to write questions from your lesson.</p>
          </div>
        ) : (
          questions.map((q, index) => {
            const isEditing = editingQuestionId === q._id;
            let cardStatusClass = '';
            if (q.status === 'approved') cardStatusClass = 'status-card-approved';
            if (q.status === 'rejected') cardStatusClass = 'status-card-rejected';

            return (
              <div key={q._id} className={`question-card ${cardStatusClass}`}>
                {/* Header */}
                <div className="question-card-header">
                  <div className="question-meta-group">
                    <span style={{ fontWeight: 900, fontSize: '14px' }}>Q{index + 1}</span>
                    <span className="badge badge-ink">{q.type.toUpperCase()}</span>
                    <span className="badge">{q.topicTag}</span>
                    <span className="badge badge-outline">{q.difficulty.toUpperCase()}</span>
                    {q.editedByTeacher && (
                      <span className="badge" style={{ borderStyle: 'solid', borderColor: '#111' }}>
                        TEACHER EDITED
                      </span>
                    )}
                  </div>

                  <div>
                    {q.status === 'approved' && (
                      <span className="status-pill status-pill-ready">APPROVED</span>
                    )}
                    {q.status === 'draft' && (
                      <span className="status-pill status-pill-draft">DRAFT</span>
                    )}
                    {q.status === 'rejected' && (
                      <span className="status-pill status-pill-failed">REJECTED</span>
                    )}
                  </div>
                </div>

                {!isEditing ? (
                  <div>
                    {/* Stem */}
                    <div className="question-stem">{q.stem}</div>

                    {/* Options (for MCQ and True/False) */}
                    {q.options && q.options.length > 0 && (
                      <div className="options-list">
                        {q.options.map((opt, optIdx) => {
                          const isCorrect =
                            optIdx === q.correctIndex || opt === q.correctText;
                          return (
                            <div
                              key={optIdx}
                              className={`option-item ${isCorrect ? 'correct-answer' : ''}`}
                            >
                              <span style={{ fontWeight: 700, width: '22px' }}>
                                {String.fromCharCode(65 + optIdx)}.
                              </span>
                              <span style={{ flex: 1 }}>{opt}</span>
                              {isCorrect && (
                                <span className="correct-indicator">CORRECT ANSWER</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Short answer expected answer */}
                    {q.type === 'short' && (
                      <div className="option-item correct-answer mb-3">
                        <span style={{ fontWeight: 700, width: '130px' }}>KEY CONCEPT:</span>
                        <span style={{ flex: 1 }}>{q.correctText}</span>
                        <span className="correct-indicator">MODEL ANSWER</span>
                      </div>
                    )}

                    {/* Explanation */}
                    {q.explanation && (
                      <p className="text-secondary" style={{ fontSize: '13px', marginBottom: '1rem' }}>
                        <strong>Rationale:</strong> {q.explanation}
                      </p>
                    )}

                    {/* GROUNDED TRANSCRIPT EXCERPT */}
                    {q.sourceCitation && (
                      <div className="transcript-citation-box">
                        <span className="citation-label">GROUNDED TRANSCRIPT EXCERPT</span>
                        "{q.sourceCitation}"
                      </div>
                    )}

                    {/* Per-card actions */}
                    <div className="card-action-bar">
                      <div className="text-secondary" style={{ fontSize: '11px' }}>
                        {q.status === 'approved' ? '✓ Ready for students' : 'Requires teacher approval'}
                      </div>

                      <div className="card-action-buttons">
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => startEditQuestion(q)}
                        >
                          Edit Inline
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleReject(q._id)}
                          disabled={q.status === 'rejected'}
                        >
                          Reject
                        </button>
                        <button
                          type="button"
                          className={`btn btn-sm ${q.status === 'approved' ? 'btn-secondary' : 'btn-primary'}`}
                          onClick={() => handleApprove(q._id)}
                        >
                          {q.status === 'approved' ? '✓ Approved' : 'Approve'}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Inline Edit Form */
                  <div className="inline-edit-form">
                    <span className="eyebrow">INLINE QUESTION EDITOR</span>

                    <div className="form-group">
                      <label className="form-label">Question Stem</label>
                      <textarea
                        value={editForm.stem || ''}
                        onChange={(e) =>
                          setEditForm({ ...editForm, stem: e.target.value })
                        }
                        rows={3}
                      />
                    </div>

                    {editForm.options && editForm.options.length > 0 && (
                      <div className="form-group">
                        <label className="form-label">Options & Correct Answer</label>
                        {editForm.options.map((opt, oIdx) => (
                          <div
                            key={oIdx}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              marginBottom: '8px'
                            }}
                          >
                            <input
                              type="radio"
                              name={`correct_${q._id}`}
                              checked={editForm.correctIndex === oIdx}
                              onChange={() =>
                                setEditForm({ ...editForm, correctIndex: oIdx })
                              }
                              title="Mark as correct answer"
                            />
                            <span style={{ fontWeight: 700, width: '20px' }}>
                              {String.fromCharCode(65 + oIdx)}.
                            </span>
                            <input
                              type="text"
                              value={opt}
                              onChange={(e) => {
                                const newOpts = [...(editForm.options || [])];
                                newOpts[oIdx] = e.target.value;
                                setEditForm({ ...editForm, options: newOpts });
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    )}

                    {q.type === 'short' && (
                      <div className="form-group">
                        <label className="form-label">Correct Model Answer</label>
                        <input
                          type="text"
                          value={editForm.correctText || ''}
                          onChange={(e) =>
                            setEditForm({ ...editForm, correctText: e.target.value })
                          }
                        />
                      </div>
                    )}

                    <div className="form-group">
                      <label className="form-label">Explanation</label>
                      <textarea
                        value={editForm.explanation || ''}
                        onChange={(e) =>
                          setEditForm({ ...editForm, explanation: e.target.value })
                        }
                        rows={2}
                      />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <div className="form-group">
                        <label className="form-label">Topic Tag</label>
                        <input
                          type="text"
                          value={editForm.topicTag || ''}
                          onChange={(e) =>
                            setEditForm({ ...editForm, topicTag: e.target.value })
                          }
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">Difficulty</label>
                        <select
                          value={editForm.difficulty || 'medium'}
                          onChange={(e) =>
                            setEditForm({ ...editForm, difficulty: e.target.value as QuestionDifficulty })
                          }
                        >
                          <option value="easy">Easy</option>
                          <option value="medium">Medium</option>
                          <option value="hard">Hard</option>
                        </select>
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={cancelEditQuestion}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => saveEditQuestion(q._id)}
                      >
                        Save & Mark Edited
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Assignment & Rubric Block */}
      {assignment && (
        <div className="assignment-block">
          <div className="flex-between mb-2">
            <div>
              <span className="eyebrow">HOMEWORK & SYNTHESIS TASK</span>
              <h2 style={{ fontSize: '1.35rem' }}>Assignment & Grading Rubric</h2>
            </div>
            <div>
              {assignment.status === 'approved' && (
                <span className="status-pill status-pill-ready">APPROVED</span>
              )}
              {assignment.status === 'draft' && (
                <span className="status-pill status-pill-draft">DRAFT</span>
              )}
              {assignment.status === 'rejected' && (
                <span className="status-pill status-pill-failed">REJECTED</span>
              )}
            </div>
          </div>

          {!editingAssignment ? (
            <div>
              <div style={{ marginBottom: '1.25rem' }}>
                <span className="eyebrow">STUDENT PROMPT</span>
                <p style={{ fontSize: '14px', lineHeight: 1.6, fontWeight: 500 }}>
                  {assignment.prompt}
                </p>
                <p className="text-secondary mt-1" style={{ fontSize: '12px' }}>
                  <strong>Estimated completion:</strong> {assignment.estimatedMinutes} minutes
                </p>
              </div>

              <div>
                <span className="eyebrow">GRADING RUBRIC</span>
                <table className="rubric-table">
                  <thead>
                    <tr>
                      <th style={{ width: '28%' }}>Criterion</th>
                      <th style={{ width: '12%' }}>Marks</th>
                      <th style={{ width: '60%' }}>Descriptor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assignment.rubric?.map((row, rIdx) => (
                      <tr key={rIdx}>
                        <td style={{ fontWeight: 700 }}>{row.criterion}</td>
                        <td className="text-mono">{row.marks} pts</td>
                        <td className="text-secondary">{row.descriptor}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Assignment action bar */}
              <div className="card-action-bar mt-3">
                <span className="text-secondary" style={{ fontSize: '11px' }}>
                  Assignment requires teacher review before distribution.
                </span>

                <div className="card-action-buttons">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={startEditAssignment}
                  >
                    Edit Rubric
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={handleRejectAssignment}
                    disabled={assignment.status === 'rejected'}
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    className={`btn btn-sm ${assignment.status === 'approved' ? 'btn-secondary' : 'btn-primary'}`}
                    onClick={handleApproveAssignment}
                  >
                    {assignment.status === 'approved' ? '✓ Approved' : 'Approve Assignment'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Assignment Edit Form */
            <div className="inline-edit-form">
              <span className="eyebrow">EDIT ASSIGNMENT & RUBRIC</span>

              <div className="form-group">
                <label className="form-label">Assignment Prompt</label>
                <textarea
                  value={assignmentEditForm.prompt || ''}
                  onChange={(e) =>
                    setAssignmentEditForm({
                      ...assignmentEditForm,
                      prompt: e.target.value
                    })
                  }
                  rows={3}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Estimated Minutes</label>
                <input
                  type="number"
                  value={assignmentEditForm.estimatedMinutes || ''}
                  onChange={(e) =>
                    setAssignmentEditForm({
                      ...assignmentEditForm,
                      estimatedMinutes: e.target.value
                    })
                  }
                />
              </div>

              <div className="form-group">
                <label className="form-label">Rubric Criteria</label>
                {assignmentEditForm.rubric?.map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      border: '1px solid var(--hairline)',
                      padding: '10px',
                      marginBottom: '10px',
                      background: '#fff'
                    }}
                  >
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '8px', marginBottom: '6px' }}>
                      <input
                        type="text"
                        placeholder="Criterion"
                        value={item.criterion}
                        onChange={(e) => {
                          const updated = [...(assignmentEditForm.rubric || [])];
                          updated[idx].criterion = e.target.value;
                          setAssignmentEditForm({ ...assignmentEditForm, rubric: updated });
                        }}
                      />
                      <input
                        type="number"
                        placeholder="Marks"
                        value={item.marks}
                        onChange={(e) => {
                          const updated = [...(assignmentEditForm.rubric || [])];
                          updated[idx].marks = Number(e.target.value);
                          setAssignmentEditForm({ ...assignmentEditForm, rubric: updated });
                        }}
                      />
                    </div>
                    <textarea
                      placeholder="Descriptor"
                      value={item.descriptor}
                      onChange={(e) => {
                        const updated = [...(assignmentEditForm.rubric || [])];
                        updated[idx].descriptor = e.target.value;
                        setAssignmentEditForm({ ...assignmentEditForm, rubric: updated });
                      }}
                      rows={2}
                    />
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setEditingAssignment(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={saveEditAssignment}
                >
                  Save Rubric
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Bottom Publish Bar */}
      <div
        style={{
          marginTop: '3rem',
          paddingTop: '2rem',
          borderTop: '2px solid var(--ink)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem'
        }}
      >
        <div>
          <span className="eyebrow">FINAL STEP</span>
          <p style={{ fontWeight: 700 }}>
            {lesson?.status === 'published'
              ? 'This lesson is currently published and live for students.'
              : canPublish
              ? `Ready to publish with ${approvedQuestions.length} approved questions.`
              : 'At least 1 approved question is required to publish.'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <Link href="/lessons" className="btn btn-secondary">
            Back to Lessons
          </Link>
          <button
            type="button"
            className="btn btn-primary btn-lg"
            onClick={handlePublish}
            disabled={isPublishing || !canPublish || lesson?.status === 'published'}
          >
            {lesson?.status === 'published'
              ? '✓ Published'
              : isPublishing
              ? 'Publishing…'
              : 'Publish to Students'}
          </button>
        </div>
      </div>
    </div>
  );
}
