'use client';

/**
 * The transcript of record: what the ASR provider (or the document extractor) produced from
 * the lesson source. This is the text the questions were written from, so it is the thing a
 * teacher checks when a question looks wrong.
 */

import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Transcript } from '../types';

interface TranscriptPanelProps {
  lessonId: string;
  /** Collapsed by default on the review screen, open while processing. */
  defaultOpen?: boolean;
}

export default function TranscriptPanel({ lessonId, defaultOpen = false }: TranscriptPanelProps) {
  const [transcript, setTranscript] = useState<Transcript | null>(null);
  const [open, setOpen] = useState(defaultOpen);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const { transcript: result } = await api.getTranscript(lessonId);
        if (!cancelled) setTranscript(result);
      } catch {
        if (!cancelled) setTranscript(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [lessonId]);

  // Nothing to show until ASR has run — the processing screen already says what stage it is at.
  if (loading || !transcript) return null;

  const minutes = transcript.segments.length
    ? Math.round(transcript.segments[transcript.segments.length - 1].endSec / 60)
    : null;

  return (
    <div className="card mb-2">
      <div className="flex-between">
        <div>
          <span className="eyebrow">TRANSCRIPT</span>
          <p className="text-secondary" style={{ fontSize: '12px', margin: '4px 0 0' }}>
            {transcript.wordCount.toLocaleString()} words
            {minutes ? ` · about ${minutes} min` : ''} · {transcript.provider}
            {transcript.language ? ` · ${transcript.language}` : ''}
          </p>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(!open)}>
          {open ? 'Hide' : 'Show transcript'}
        </button>
      </div>

      {open && (
        <div
          style={{
            marginTop: 12,
            maxHeight: 320,
            overflowY: 'auto',
            fontSize: '14px',
            lineHeight: 1.7,
            whiteSpace: 'pre-wrap',
          }}
        >
          {transcript.segments.length > 0
            ? transcript.segments.map((segment, index) => (
                <p key={index} style={{ margin: '0 0 8px' }}>
                  <span
                    className="text-mono text-secondary"
                    style={{ fontSize: '11px', marginRight: 8 }}
                  >
                    {formatClock(segment.startSec)}
                  </span>
                  {segment.text}
                </p>
              ))
            : transcript.text}
        </div>
      )}
    </div>
  );
}

function formatClock(seconds: number): string {
  const total = Math.floor(seconds);
  const mm = String(Math.floor(total / 60)).padStart(2, '0');
  const ss = String(total % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}
