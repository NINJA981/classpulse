'use client';

/**
 * What the class actually said.
 *
 * A lesson can hold two transcripts: one captured live while the teacher spoke, and one
 * produced from the uploaded recording afterwards. The teacher reads either, and chooses
 * which one the questions are written from.
 */

import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Transcript, TranscriptSource } from '../types';

interface TranscriptPanelProps {
  lessonId: string;
  /** Collapsed by default on the review screen, open while processing. */
  defaultOpen?: boolean;
}

const LABELS: Record<TranscriptSource, string> = {
  live: 'Captured live',
  upload: 'From the recording',
};

export default function TranscriptPanel({ lessonId, defaultOpen = false }: TranscriptPanelProps) {
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [selected, setSelected] = useState<TranscriptSource | null>(null);
  const [viewing, setViewing] = useState<TranscriptSource | null>(null);
  const [open, setOpen] = useState(defaultOpen);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const result = await api.getTranscript(lessonId);
        if (cancelled) return;
        setTranscripts(result.transcripts);
        setSelected(result.selected);
        setViewing(result.selected ?? result.transcripts[0]?.source ?? null);
      } catch {
        if (!cancelled) setTranscripts([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [lessonId]);

  if (loading || transcripts.length === 0) return null;

  const current = transcripts.find((t) => t.source === viewing) ?? transcripts[0];
  const minutes = current.segments.length
    ? Math.round(current.segments[current.segments.length - 1].endSec / 60)
    : null;

  const choose = async (source: TranscriptSource) => {
    setSaving(true);
    setNotice('');
    try {
      await api.selectTranscript(lessonId, source);
      setSelected(source);
      setNotice('Saved. Regenerate the questions to write them from this transcript.');
    } catch {
      setNotice('Could not save that choice.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card mb-2">
      <div className="flex-between">
        <div>
          <span className="eyebrow">TRANSCRIPT</span>
          <p className="text-secondary" style={{ fontSize: '12px', margin: '4px 0 0' }}>
            {current.wordCount.toLocaleString()} words
            {minutes ? ` · about ${minutes} min` : ''} · {current.provider}
            {current.language ? ` · ${current.language}` : ''}
          </p>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(!open)}>
          {open ? 'Hide' : 'Show transcript'}
        </button>
      </div>

      {open && (
        <>
          {transcripts.length > 1 && (
            <div style={{ display: 'flex', gap: 8, margin: '12px 0', flexWrap: 'wrap' }}>
              {transcripts.map((transcript) => {
                const isViewing = transcript.source === viewing;
                const isSelected = transcript.source === selected;
                return (
                  <button
                    key={transcript.source}
                    type="button"
                    className={`btn btn-sm ${isViewing ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => setViewing(transcript.source)}
                  >
                    {LABELS[transcript.source]}
                    {isSelected ? ' · used for questions' : ''}
                  </button>
                );
              })}
            </div>
          )}

          {transcripts.length > 1 && viewing && viewing !== selected && (
            <div style={{ marginBottom: 12 }}>
              <button
                type="button"
                className="btn btn-sm"
                disabled={saving}
                onClick={() => void choose(viewing)}
              >
                {saving ? 'Saving…' : `Use ${LABELS[viewing].toLowerCase()} for the questions`}
              </button>
            </div>
          )}

          {notice && (
            <p className="text-secondary" style={{ fontSize: '12px', marginBottom: 8 }}>
              {notice}
            </p>
          )}

          <div
            style={{
              maxHeight: 320,
              overflowY: 'auto',
              fontSize: '14px',
              lineHeight: 1.7,
              whiteSpace: 'pre-wrap',
            }}
          >
            {current.segments.length > 0
              ? current.segments.map((segment, index) => (
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
              : current.text}
          </div>
        </>
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
