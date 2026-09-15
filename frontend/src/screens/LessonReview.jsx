import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout.jsx';
import { api } from '../lib/api.js';

export default function LessonReview() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [lesson, setLesson] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [assignment, setAssignment] = useState(null);
  const [loading, setLoading] = useState(true);

  // Card-level inline edit state
  const [editingQuestionId, setEditingQuestionId] = useState(null);
  const [editForm, setEditForm] = useState({});

  // Assignment inline edit state
  const [editingAssignment, setEditingAssignment] = useState(false);
  const [assignmentEditForm, setAssignmentEditForm] = useState({});

  // Publish / feedback state
  const [isPublishing, setIsPublishing] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [actionNotice, setActionNotice] = useState(null);
  const [conflictError, setConflictError] = useState(null);

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [lessonRes, questionsRes] = await Promise.all([
        api.getLesson(id),
        api.getLessonQuestions(id)
      ]);

      setLesson(lessonRes);
      setQuestions(questionsRes.questions || []);
      setAssignment(questionsRes.assignment || null);
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
  const handleApprove = async (questionId) => {
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
  const handleReject = async (questionId) => {
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
  const startEditQuestion = (q) => {
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

  const saveEditQuestion = async (questionId) => {
    try {
      const updated = await api.updateQuestion(questionId, {
        stem: editForm.stem,
        options: editForm.options,
        correctIndex: editForm.correctIndex,
        correctText: editForm.options[editForm.correctIndex] || editForm.correctText,
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
      setAssignment((prev) => ({ ...prev, status: 'approved' }));
      showNotice('Assignment & rubric approved.');
    } catch (err) {
      console.error('Approve assignment failed:', err);
    }
  };

  const handleRejectAssignment = async () => {
    try {
      await api.updateAssignment(id, { status: 'rejected' });
      setAssignment((prev) => ({ ...prev, status: 'rejected' }));
      showNotice('Assignment rejected.');
    } catch (err) {
      console.error('Reject assignment failed:', err);
    }
  };

  const startEditAssignment = () => {
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
      // Navigate to processing screen to watch new questions validate
      navigate(`/lessons/${id}`);
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
      // Update local lesson status
      setLesson((prev) => ({ ...prev, status: 'published' }));
    } catch (err) {
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

  const showNotice = (msg) => {
    setActionNotice(msg);
    setTimeout(() => {
      setActionNotice(null);
    }, 4000);
  };

  if (loading) {
    return (
      <Layout>
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <span className="eyebrow">RETRIEVING CURRICULUM</span>
          <p style={{ fontWeight: 600 }}>Loading review deck…</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
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
                        value={editForm.stem}
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
                                const newOpts = [...editForm.options];
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
                          value={editForm.correctText}
                          onChange={(e) =>
                            setEditForm({ ...editForm, correctText: e.target.value })
                          }
                        />
                      </div>
                    )}

                    <div className="form-group">
                      <label className="form-label">Explanation</label>
                      <textarea
                        value={editForm.explanation}
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
                          value={editForm.topicTag}
                          onChange={(e) =>
                            setEditForm({ ...editForm, topicTag: e.target.value })
                          }
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">Difficulty</label>
                        <select
                          value={editForm.difficulty}
                          onChange={(e) =>
                            setEditForm({ ...editForm, difficulty: e.target.value })
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
                  value={assignmentEditForm.prompt}
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
                  value={assignmentEditForm.estimatedMinutes}
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
                          const updated = [...assignmentEditForm.rubric];
                          updated[idx].criterion = e.target.value;
                          setAssignmentEditForm({ ...assignmentEditForm, rubric: updated });
                        }}
                      />
                      <input
                        type="number"
                        placeholder="Marks"
                        value={item.marks}
                        onChange={(e) => {
                          const updated = [...assignmentEditForm.rubric];
                          updated[idx].marks = Number(e.target.value);
                          setAssignmentEditForm({ ...assignmentEditForm, rubric: updated });
                        }}
                      />
                    </div>
                    <textarea
                      placeholder="Descriptor"
                      value={item.descriptor}
                      onChange={(e) => {
                        const updated = [...assignmentEditForm.rubric];
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
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate('/lessons')}
          >
            Back to Lessons
          </button>
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
    </Layout>
  );
}
