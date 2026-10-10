'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { LessonDetail } from '@classpulse/shared';
import { Field, Input } from '@/components/ui';
import { ProgressBar } from './common';
import { uploadFile, type UploadHandle } from './upload';

const MAX_HINT = 'MP3, WAV, M4A, OGG or WebM. Long lectures can take a few minutes to upload.';

/** Upload state for POST /api/lessons/:id/audio with progress + abort. */
export function useAudioUpload() {
  const [progress, setProgress] = useState<number | null>(null);
  const handle = useRef<UploadHandle<LessonDetail> | null>(null);

  useEffect(() => () => handle.current?.abort(), []);

  const upload = useCallback(async (lessonId: string, file: File) => {
    setProgress(0);
    const h = uploadFile<LessonDetail>(`/lessons/${lessonId}/audio`, file, setProgress);
    handle.current = h;
    try {
      return await h.promise;
    } finally {
      handle.current = null;
      setProgress(null);
    }
  }, []);

  const abort = useCallback(() => handle.current?.abort(), []);

  return { upload, abort, progress, uploading: progress !== null };
}

/** File input labelled "Audio file" plus upload progress. */
export function AudioFileField({
  file,
  onChange,
  progress,
  disabled,
  error,
}: {
  file: File | null;
  onChange: (file: File | null) => void;
  progress: number | null;
  disabled?: boolean;
  error?: string | null;
}) {
  return (
    <div className="space-y-3">
      <Field label="Audio file" required hint={MAX_HINT} error={error}>
        {(p) => (
          <Input
            {...p}
            type="file"
            accept="audio/*,.m4a,.mp4,.mpeg"
            disabled={disabled}
            className="py-1.5 file:mr-3 file:border-0 file:bg-surface-2 file:px-3 file:py-1 file:text-xs file:font-bold"
            onChange={(e) => onChange(e.target.files?.[0] ?? null)}
          />
        )}
      </Field>
      {file && (
        <p className="text-xs text-muted">
          {file.name} · {(file.size / (1024 * 1024)).toFixed(1)} MB
        </p>
      )}
      {progress !== null && (
        <div className="space-y-1">
          <ProgressBar value={progress} label="Upload progress" />
          <p className="text-xs font-bold tabular-nums text-muted" aria-live="polite">
            {progress < 100 ? `Uploading… ${progress}%` : 'Processing audio on the server…'}
          </p>
        </div>
      )}
    </div>
  );
}
