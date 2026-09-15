'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { api } from '../../../lib/api';
import { Lesson, LessonStatus } from '../../../types';

export default function LessonProcessingPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === 'string' ? params.id : Array.isArray(params.id) ? params.id[0] : '';

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [stage, setStage] = useState<LessonStatus>('queued');
  const [failureReason, setFailureReason] = useState<string | null>(null);
  const [elapsedSec, setElapsedSec] = useState<number>(0);
  const [isRetrying, setIsRetrying] = useState<boolean>(false);

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(Date.now());

  // Plain-sentence stage mapping as strictly required
  const getStageSentence = (currentStage: LessonStatus): string => {
    switch (currentStage) {
      case 'queued':
        return 'Queued…';
      case 'transcribing':
        return 'Transcribing your recording…';
      case 'generating':
        return 'Writing questions from your lesson…';
      case 'validating':
        return 'Double-checking the output…';
      case 'failed':
        return 'Processing could not be completed';
      case 'ready_for_review':
        return 'Lesson ready. Transferring to review…';
      default:
        return 'Processing your lesson…';
    }
  };

  const STAGES_ORDER: { key: LessonStatus; label: string }[] = [
    { key: 'queued', label: 'Queued…' },
    { key: 'transcribing', label: 'Transcribing your recording…' },
    { key: 'generating', label: 'Writing questions from your lesson…' },
    { key: 'validating', label: 'Double-checking the output…' }
  ];

  const getStageIndex = (s: LessonStatus): number => {
    const idx = STAGES_ORDER.findIndex((item) => item.key === s);
    return idx === -1 ? 0 : idx;
  };

  const checkStatus = async () => {
    if (!id) return;
    try {
      const data = await api.getLesson(id);
      setLesson(data);
      setStage(data.status);

      if (data.status === 'ready_for_review') {
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        router.push(`/lessons/${id}/review`);
      } else if (data.status === 'failed') {
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        setFailureReason(
          data.failureReason ||
            'The audio quality or document contents were unreadable. Please check your source file and try again.'
        );
      }
    } catch (err) {
      console.error('Error polling lesson status:', err);
    }
  };

  useEffect(() => {
    if (!id) return;
    startTimeRef.current = Date.now();

    checkStatus();

    // Poll lesson status every 2 seconds
    pollIntervalRef.current = setInterval(checkStatus, 2000);

    timerIntervalRef.current = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [id]);

  const formatTimer = (totalSeconds: number): string => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const handleRetry = async () => {
    if (!id) return;
    try {
      setIsRetrying(true);
      setFailureReason(null);
      setStage('queued');
      startTimeRef.current = Date.now();
      setElapsedSec(0);
      await api.generate(id);

      pollIntervalRef.current = setInterval(checkStatus, 2000);
      timerIntervalRef.current = setInterval(() => {
        setElapsedSec(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 1000);
    } catch (err) {
      console.error('Retry failed:', err);
      setFailureReason('Unable to restart generation pipeline. Please try again.');
    } finally {
      setIsRetrying(false);
    }
  };

  const currentIdx = getStageIndex(stage);

  return (
    <div>
      <div className="processing-container">
        <span className="eyebrow">AUTOMATED CURRICULUM PIPELINE</span>

        <h1 style={{ fontSize: '1.65rem', marginTop: '4px', marginBottom: '4px' }}>
          {lesson ? lesson.title : 'Processing Lesson…'}
        </h1>
        <p className="text-secondary" style={{ fontSize: '13px' }}>
          {lesson ? `${lesson.subject} • ${lesson.className}` : 'Retrieving metadata…'}
        </p>

        {stage === 'failed' ? (
          <div className="mt-4">
            <div className="card" style={{ border: '2px solid #111', background: '#faf9f6' }}>
              <span className="eyebrow" style={{ color: '#111' }}>PROCESSING HALTED</span>
              <h2 style={{ fontSize: '1.25rem', marginBottom: '8px' }}>Generation Failed</h2>
              {/* Surface plain English failureReason, never raw stack traces */}
              <p style={{ fontSize: '14px', lineHeight: 1.5, marginBottom: '1.5rem' }}>
                {failureReason}
              </p>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleRetry}
                  disabled={isRetrying}
                >
                  {isRetrying ? 'Retrying…' : 'Retry Processing'}
                </button>
                <Link href="/lessons" className="btn btn-secondary">
                  Return to Lessons
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-4">
            <div className="flex-between">
              <div>
                <span className="eyebrow">CURRENT STAGE</span>
                {/* Never a bare spinner: plain human sentence */}
                <div className="processing-sentence">{getStageSentence(stage)}</div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <span className="eyebrow">ELAPSED TIME</span>
                <div className="processing-timer-display">{formatTimer(elapsedSec)}</div>
              </div>
            </div>

            {/* Brutalist Stage Progression List */}
            <div className="progress-steps-list">
              {STAGES_ORDER.map((s, idx) => {
                const isCompleted = idx < currentIdx;
                const isActive = idx === currentIdx;

                let itemClass = 'progress-step-item';
                let mark = '[ ]';
                if (isCompleted) {
                  itemClass += ' step-done';
                  mark = '[DONE]';
                } else if (isActive) {
                  itemClass += ' step-active';
                  mark = '[RUNNING]';
                }

                return (
                  <div key={s.key} className={itemClass}>
                    <span>{s.label}</span>
                    <span className="text-mono" style={{ fontSize: '10px', fontWeight: 800 }}>
                      {mark}
                    </span>
                  </div>
                );
              })}
            </div>

            <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="text-secondary text-mono" style={{ fontSize: '11px' }}>
                POLLING LESSON STATUS EVERY 2 SECONDS
              </span>
              <Link href="/lessons" className="btn btn-ghost btn-sm">
                View Lessons List
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
