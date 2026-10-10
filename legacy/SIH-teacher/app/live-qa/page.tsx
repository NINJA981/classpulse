'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  MessageSquare,
  ThumbsUp,
  Pin,
  CheckCircle,
  Send,
  Radio,
  Users,
  Sparkles,
  Search,
  Megaphone,
  Filter
} from 'lucide-react';

interface StudentQuestion {
  id: string;
  studentName: string;
  className: string;
  timestamp: string;
  question: string;
  upvotes: number;
  isPinned: boolean;
  status: 'unanswered' | 'answered';
  teacherReply?: string;
  topicTag: string;
}

export default function LiveQAPage() {
  const [questions, setQuestions] = useState<StudentQuestion[]>([]);
  const [filterMode, setFilterMode] = useState<'all' | 'unanswered' | 'pinned'>('all');
  const [activeReplyId, setActiveReplyId] = useState<string | null>(null);
  const [replyInput, setReplyInput] = useState('');
  const [selectedClass, setSelectedClass] = useState('Grade 10 - Section B');
  const [searchFilter, setSearchFilter] = useState('');

  // Discussion prompt broadcast state
  const [discussionPrompt, setDiscussionPrompt] = useState(
    'Think-Pair-Share: Why does cyanide halt all ATP production even if glucose and oxygen are abundant?'
  );
  const [promptBroadcasted, setPromptBroadcasted] = useState(true);
  const [newPromptText, setNewPromptText] = useState('');
  const [showPromptComposer, setShowPromptComposer] = useState(false);

  const handleUpvote = (id: string) => {
    setQuestions((prev) =>
      prev.map((q) => (q.id === id ? { ...q, upvotes: q.upvotes + 1 } : q))
    );
  };

  const handleTogglePin = (id: string) => {
    setQuestions((prev) =>
      prev.map((q) => (q.id === id ? { ...q, isPinned: !q.isPinned } : q))
    );
  };

  const handleSubmitReply = (id: string) => {
    if (!replyInput.trim()) return;
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === id
          ? {
              ...q,
              status: 'answered',
              teacherReply: replyInput.trim()
            }
          : q
      )
    );
    setReplyInput('');
    setActiveReplyId(null);
  };

  const handleBroadcastPrompt = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPromptText.trim()) return;
    setDiscussionPrompt(newPromptText.trim());
    setPromptBroadcasted(true);
    setNewPromptText('');
    setShowPromptComposer(false);
  };

  const filteredQuestions = questions.filter((q) => {
    const matchesSearch =
      q.question.toLowerCase().includes(searchFilter.toLowerCase()) ||
      q.studentName.toLowerCase().includes(searchFilter.toLowerCase()) ||
      q.topicTag.toLowerCase().includes(searchFilter.toLowerCase());

    if (!matchesSearch) return false;
    if (filterMode === 'unanswered') return q.status === 'unanswered';
    if (filterMode === 'pinned') return q.isPinned;
    return true;
  });

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div className="page-header-info">
          <span className="eyebrow">IN-CLASS INTERACTION & REAL-TIME INQUIRY</span>
          <h1>Q&A / Live Interaction</h1>
          <p className="text-secondary" style={{ marginTop: '4px' }}>
            Real-time student query queue, upvoted concept checks, instructor feedback, and broadcast discussion prompts.
          </p>
        </div>

        <div className="page-header-actions" style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setShowPromptComposer(!showPromptComposer)}
          >
            <Megaphone size={14} />
            Broadcast Discussion Prompt
          </button>
        </div>
      </div>

      {/* Classroom Status Bar */}
      <div
        className="card card-solid mb-4"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          padding: '1rem 1.5rem'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div>
            <span className="eyebrow" style={{ margin: 0 }}>ACTIVE AUDIENCE</span>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              style={{ fontWeight: 800, fontSize: '14px', marginTop: '4px' }}
            >
              <option value="Grade 10 - Section B">Grade 10 - Section B (Life Sciences)</option>
              <option value="Grade 11 - Section A">Grade 11 - Section A (Physics)</option>
              <option value="Grade 9 - Section C">Grade 9 - Section C (Chemistry)</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', borderLeft: '1px solid var(--hairline)', paddingLeft: '16px' }}>
            <span className="timetable-tag live-badge">● LIVE SESSION</span>
            <span className="text-secondary text-mono" style={{ fontSize: '11px' }}>
              34 Students Connected
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <span className="timetable-tag">
            {questions.filter((q) => q.status === 'unanswered').length} Unanswered
          </span>
          <span className="timetable-tag">
            {questions.filter((q) => q.isPinned).length} Pinned to Projector
          </span>
        </div>
      </div>

      {/* Active Broadcast Prompt Banner */}
      {promptBroadcasted && (
        <div
          className="card card-solid mb-4"
          style={{
            border: '2px solid var(--ink)',
            background: '#fffdf5',
            padding: '1.25rem 1.5rem'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
            <span className="eyebrow" style={{ color: 'var(--ink)' }}>
              📢 BROADCAST DISCUSSION PROMPT ACTIVE ON STUDENT SCREENS
            </span>
            <button
              type="button"
              className="text-mono"
              onClick={() => setPromptBroadcasted(false)}
              style={{
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                fontSize: '11px',
                fontWeight: 700,
                textDecoration: 'underline'
              }}
            >
              Dismiss from screens
            </button>
          </div>
          <p style={{ fontSize: '15px', fontWeight: 800, color: '#111' }}>
            "{discussionPrompt}"
          </p>
          <div className="text-secondary text-mono" style={{ fontSize: '11px', marginTop: '8px' }}>
            Students are responding in peer groups. 22 responses registered.
          </div>
        </div>
      )}

      {/* Broadcast Prompt Composer Modal / Drawer */}
      {showPromptComposer && (
        <div className="card card-solid mb-4" style={{ border: '2px solid var(--ink)', padding: '1.5rem' }}>
          <span className="eyebrow">BROADCAST NEW IN-CLASS DISCUSSION</span>
          <h2 style={{ fontSize: '1.2rem', marginBottom: '8px' }}>Push Question to Student Terminals</h2>
          <form onSubmit={handleBroadcastPrompt}>
            <textarea
              rows={3}
              placeholder="e.g. In 2 sentences, explain how the proton gradient powers ATP Synthase..."
              value={newPromptText}
              onChange={(e) => setNewPromptText(e.target.value)}
              style={{ width: '100%', marginBottom: '10px' }}
              required
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setShowPromptComposer(false)}
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-primary btn-sm">
                <Send size={12} /> Broadcast Now
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div
        className="card card-solid mb-4"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '10px',
          padding: '10px 14px'
        }}
      >
        <div style={{ display: 'flex', gap: '4px' }}>
          {[
            { key: 'all', label: `All Queries (${questions.length})` },
            {
              key: 'unanswered',
              label: `Unanswered (${questions.filter((q) => q.status === 'unanswered').length})`
            },
            {
              key: 'pinned',
              label: `Pinned (${questions.filter((q) => q.isPinned).length})`
            }
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`btn btn-sm ${filterMode === tab.key ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFilterMode(tab.key as any)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '220px' }}>
          <Search size={14} className="text-secondary" />
          <input
            type="text"
            placeholder="Search questions or topics..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            style={{ border: 'none', background: 'transparent', padding: '4px 0', fontSize: '12px', width: '100%' }}
          />
        </div>
      </div>

      {/* Questions Feed */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {filteredQuestions.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
            <span className="eyebrow">NO INQUIRIES</span>
            <p style={{ fontWeight: 600 }}>No student questions in this view.</p>
          </div>
        ) : (
          filteredQuestions.map((q) => (
            <div
              key={q.id}
              className={`qa-card card-solid ${q.isPinned ? 'pinned' : ''}`}
            >
              <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                {/* Upvote Pill */}
                <button
                  type="button"
                  className="qa-upvote-btn"
                  onClick={() => handleUpvote(q.id)}
                  title="Upvote this student question"
                >
                  <ThumbsUp size={14} />
                  <span style={{ marginTop: '4px' }}>{q.upvotes}</span>
                </button>

                {/* Content */}
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: 800, fontSize: '13px' }}>{q.studentName}</span>
                      <span className="timetable-tag">{q.topicTag}</span>
                      {q.isPinned && (
                        <span className="timetable-tag live-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                          <Pin size={10} /> PINNED
                        </span>
                      )}
                    </div>
                    <span className="text-secondary text-mono" style={{ fontSize: '11px' }}>
                      {q.timestamp}
                    </span>
                  </div>

                  <p style={{ fontSize: '14px', lineHeight: 1.5, color: 'var(--ink)' }}>
                    {q.question}
                  </p>

                  {/* Teacher Answer if present */}
                  {q.teacherReply && (
                    <div
                      style={{
                        marginTop: '10px',
                        padding: '10px 12px',
                        background: 'var(--surface-alt)',
                        borderLeft: '3px solid var(--ink)',
                        fontSize: '13px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                        <span style={{ fontWeight: 800, fontSize: '11px' }}>Prof. Priya Sharma (Instructor)</span>
                        <CheckCircle size={12} color="#111" />
                      </div>
                      <p style={{ color: '#222' }}>{q.teacherReply}</p>
                    </div>
                  )}

                  {/* Actions row */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px', borderTop: '1px solid var(--hairline)', paddingTop: '8px' }}>
                    <button
                      type="button"
                      className="btn btn-sm btn-secondary"
                      onClick={() => handleTogglePin(q.id)}
                      style={{ padding: '4px 8px' }}
                    >
                      <Pin size={12} /> {q.isPinned ? 'Unpin' : 'Pin to Board'}
                    </button>

                    <button
                      type="button"
                      className="btn btn-sm btn-primary"
                      onClick={() => setActiveReplyId(activeReplyId === q.id ? null : q.id)}
                      style={{ padding: '4px 10px' }}
                    >
                      <MessageSquare size={12} />
                      {q.teacherReply ? 'Edit Answer' : 'Answer Question'}
                    </button>
                  </div>

                  {/* Reply Composer Drawer */}
                  {activeReplyId === q.id && (
                    <div style={{ marginTop: '12px', borderTop: '1px solid var(--hairline)', paddingTop: '10px' }}>
                      <textarea
                        rows={2}
                        placeholder="Type instructor explanation or answer..."
                        value={replyInput}
                        onChange={(e) => setReplyInput(e.target.value)}
                        style={{ width: '100%', marginBottom: '8px' }}
                      />
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                        <button
                          type="button"
                          className="btn btn-sm btn-secondary"
                          onClick={() => setActiveReplyId(null)}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-primary"
                          onClick={() => handleSubmitReply(q.id)}
                        >
                          Publish Answer
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
