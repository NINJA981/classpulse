'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import SourcePicker, { SelectedSourceData } from '../../../components/SourcePicker';
import { api } from '../../../lib/api';
import { Radio, UploadCloud, Play, Sparkles, KeyRound, Users, ShieldCheck } from 'lucide-react';

export default function NewLessonPage() {
  const router = useRouter();

  // Mode: 'live_session' | 'curriculum_quiz'
  const [setupMode, setSetupMode] = useState<'live_session' | 'curriculum_quiz'>('live_session');

  // Fields
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [className, setClassName] = useState('Grade 10 - Section B');

  // Live session options
  const [roomCode, setRoomCode] = useState('BIO-10B-' + Math.floor(1000 + Math.random() * 9000));
  const [enableLiveTranscription, setEnableLiveTranscription] = useState(true);
  const [enableLiveQA, setEnableLiveQA] = useState(true);
  const [enableAttendancePrompt, setEnableAttendancePrompt] = useState(true);

  // Curriculum source picker
  const [selectedSource, setSelectedSource] = useState<SelectedSourceData | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const classOptions = [
    'Grade 9 - Section A',
    'Grade 9 - Section B',
    'Grade 9 - Section C',
    'Grade 10 - Section A',
    'Grade 10 - Section B',
    'Grade 11 - Section A',
    'Grade 11 - Advanced Physics',
    'Grade 12 - Honors'
  ];

  const handleLaunchLiveSession = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!title.trim()) {
      setErrorMessage('Please enter a lesson topic or title.');
      return;
    }
    if (!subject.trim()) {
      setErrorMessage('Please enter a subject.');
      return;
    }

    try {
      setIsSubmitting(true);
      // Create draft lesson
      const newLesson = await api.createLesson({
        title: title.trim(),
        subject: subject.trim(),
        className
      });

      // Save live session config to localStorage for record-transcribe
      localStorage.setItem(
        'clasepulse_active_live_session',
        JSON.stringify({
          lessonId: newLesson._id,
          title: title.trim(),
          subject: subject.trim(),
          className,
          roomCode,
          enableLiveTranscription,
          enableLiveQA,
          enableAttendancePrompt,
          startedAt: new Date().toISOString()
        })
      );

      // Redirect directly to Record & Transcribe console
      router.push('/record-transcribe?session=active');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to initialize live classroom session.');
      setIsSubmitting(false);
    }
  };

  const handleCurriculumSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!title.trim()) {
      setErrorMessage('Please enter a lesson title.');
      return;
    }
    if (!subject.trim()) {
      setErrorMessage('Please enter a subject.');
      return;
    }
    if (!selectedSource || !selectedSource.file) {
      setErrorMessage('Please record audio or upload a source document before submitting.');
      return;
    }

    try {
      setIsSubmitting(true);

      // 1. Create the lesson (draft)
      const newLesson = await api.createLesson({
        title: title.trim(),
        subject: subject.trim(),
        className
      });

      // 2. Attach the source file
      await api.attachSource(
        newLesson._id,
        selectedSource.file,
        selectedSource.sourceType
      );

      // 3. Trigger generation job
      await api.generate(newLesson._id);

      // 4. Navigate to /lessons/:id
      router.push(`/lessons/${newLesson._id}`);
    } catch (err: any) {
      console.error('Failed to create lesson workflow:', err);
      setErrorMessage(err.message || 'An error occurred during submission. Please try again.');
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-header-info">
          <span className="eyebrow">ACTIVE CLASSROOM SETUP</span>
          <h1>New Lesson</h1>
          <p className="text-secondary" style={{ marginTop: '4px' }}>
            Configure and launch an active classroom lecture or generate ground-truth quizzes from study notes.
          </p>
        </div>

        <div className="page-header-actions">
          <Link href="/dashboard" className="btn btn-secondary">
            Cancel
          </Link>
        </div>
      </div>

      {/* Mode Selector Tabs */}
      <div className="tab-bar">
        <button
          type="button"
          className={`tab-btn ${setupMode === 'live_session' ? 'active' : ''}`}
          onClick={() => setSetupMode('live_session')}
        >
          <Radio size={14} style={{ display: 'inline', marginRight: '6px' }} />
          Option 1: Launch Active Live Class Session
        </button>
        <button
          type="button"
          className={`tab-btn ${setupMode === 'curriculum_quiz' ? 'active' : ''}`}
          onClick={() => setSetupMode('curriculum_quiz')}
        >
          <UploadCloud size={14} style={{ display: 'inline', marginRight: '6px' }} />
          Option 2: Generate Quiz From Document/Audio
        </button>
      </div>

      {errorMessage && (
        <div className="card mb-3" style={{ border: '2px solid #111', background: '#faf9f6' }}>
          <span className="eyebrow" style={{ color: '#111' }}>VALIDATION NOTICE</span>
          <p style={{ fontWeight: 600, fontSize: '13px' }}>{errorMessage}</p>
        </div>
      )}

      {setupMode === 'live_session' ? (
        /* MODE 1: LIVE CLASSROOM SESSION */
        <form onSubmit={handleLaunchLiveSession} style={{ maxWidth: '840px' }}>
          <div className="card card-solid mb-4">
            <span className="eyebrow">CLASSROOM IDENTIFIER & TOPIC</span>

            <div className="form-group">
              <label className="form-label" htmlFor="live-title">
                Lecture Topic / Chapter
              </label>
              <input
                id="live-title"
                type="text"
                placeholder="e.g. Krebs Cycle & ATP Synthase Kinetics"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={isSubmitting}
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" htmlFor="live-subject">
                  Subject
                </label>
                <input
                  id="live-subject"
                  type="text"
                  placeholder="e.g. Biology"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  disabled={isSubmitting}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" htmlFor="live-class">
                  Assigned Section / Class
                </label>
                <select
                  id="live-class"
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                  disabled={isSubmitting}
                >
                  {classOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Live Session Configuration */}
          <div className="card card-solid mb-4">
            <span className="eyebrow">LIVE INTERACTION CONTROLS</span>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem', marginBottom: '1.5rem' }}>
              <div style={{ border: '1px solid var(--hairline)', padding: '1rem', background: 'var(--surface)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <KeyRound size={16} />
                  <span style={{ fontWeight: 800, fontSize: '12px' }}>Student Room Access Code</span>
                </div>
                <div className="text-mono" style={{ fontSize: '1.25rem', fontWeight: 900, letterSpacing: '0.08em', padding: '6px 0' }}>
                  {roomCode}
                </div>
                <p className="text-secondary" style={{ fontSize: '11px' }}>
                  Share this code on classroom board for instant student joining.
                </p>
              </div>

              <div style={{ border: '1px solid var(--hairline)', padding: '1rem', background: 'var(--surface)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <Users size={16} />
                  <span style={{ fontWeight: 800, fontSize: '12px' }}>Student Cohort</span>
                </div>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, padding: '4px 0' }}>
                  {className}
                </div>
                <p className="text-secondary" style={{ fontSize: '11px' }}>
                  32 enrolled students will be alerted on their student portal.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={enableLiveTranscription}
                  onChange={(e) => setEnableLiveTranscription(e.target.checked)}
                />
                <span style={{ fontWeight: 600, fontSize: '13px' }}>
                  Enable Real-Time Lecture Audio/Video Recording & Live Speech-to-Text Transcription
                </span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={enableLiveQA}
                  onChange={(e) => setEnableLiveQA(e.target.checked)}
                />
                <span style={{ fontWeight: 600, fontSize: '13px' }}>
                  Enable In-Class Live Student Q&A Stream & Discussion Prompts
                </span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={enableAttendancePrompt}
                  onChange={(e) => setEnableAttendancePrompt(e.target.checked)}
                />
                <span style={{ fontWeight: 600, fontSize: '13px' }}>
                  Broadcast automated geolocation / room-code attendance check
                </span>
              </label>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid var(--hairline)', paddingTop: '1.5rem' }}>
            <Link href="/dashboard" className="btn btn-secondary">
              Discard
            </Link>
            <button
              type="submit"
              className="btn btn-primary btn-lg"
              disabled={isSubmitting}
            >
              <Play size={16} />
              {isSubmitting ? 'Starting Session…' : 'Start Live Classroom Session'}
            </button>
          </div>
        </form>
      ) : (
        /* MODE 2: CURRICULUM QUIZ GENERATOR (EXISTING) */
        <form onSubmit={handleCurriculumSubmit} style={{ maxWidth: '840px' }}>
          <div className="card card-solid mb-4">
            <span className="eyebrow">LESSON METADATA</span>

            <div className="form-group">
              <label className="form-label" htmlFor="curriculum-title">
                Lesson Title
              </label>
              <input
                id="curriculum-title"
                type="text"
                placeholder="e.g. Mendelian Genetics & Punnett Squares"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={isSubmitting}
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" htmlFor="curriculum-subject">
                  Subject
                </label>
                <input
                  id="curriculum-subject"
                  type="text"
                  placeholder="e.g. Biology"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  disabled={isSubmitting}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" htmlFor="curriculum-class">
                  Class
                </label>
                <select
                  id="curriculum-class"
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                  disabled={isSubmitting}
                >
                  {classOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Source Picker */}
          <div className="mb-4">
            <SourcePicker
              selectedSource={selectedSource}
              onSourceSelected={setSelectedSource}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '1rem', borderTop: '1px solid var(--hairline)', paddingTop: '1.5rem' }}>
            {selectedSource && (
              <span className="text-secondary text-mono" style={{ fontSize: '12px' }}>
                Source attached: {selectedSource.sourceType.toUpperCase()} ({selectedSource.name})
              </span>
            )}

            <button
              type="submit"
              className="btn btn-primary btn-lg"
              disabled={isSubmitting || !selectedSource}
            >
              <Sparkles size={16} />
              {isSubmitting ? 'Creating & Generating…' : 'Create & Generate Quiz'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
