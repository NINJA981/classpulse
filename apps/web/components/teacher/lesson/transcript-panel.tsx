'use client';
import { useEffect, useState, type RefObject } from 'react';
import clsx from 'clsx';
import { useQuery } from '@tanstack/react-query';
import { FileText } from 'lucide-react';
import type { LessonDetail, LessonTranscript } from '@classiq/shared';
import { Card, CardBody, CardHeader, EmptyState, ErrorState, Skeleton } from '@/components/ui';
import { api } from '@/lib/api';
import { formatDate, formatDuration } from '@/lib/format';

/** Audio player + timestamped transcript. Clicking a segment seeks the audio. */
export function AudioTranscript({
  lesson,
  audioRef,
  onSeek,
}: {
  lesson: LessonDetail;
  audioRef: RefObject<HTMLAudioElement | null>;
  onSeek: (sec: number) => void;
}) {
  // Stays visible while a quiz is generated from an existing transcript.
  const transcriptReady = lesson.hasAudio && lesson.hasTranscript;
  const q = useQuery({
    queryKey: ['lessons', lesson.id, 'transcript'],
    queryFn: () => api.get<LessonTranscript>(`/lessons/${lesson.id}/transcript`),
    enabled: transcriptReady,
    staleTime: 5 * 60_000,
  });

  const [currentTime, setCurrentTime] = useState(0);
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime = () => setCurrentTime(a.currentTime);
    a.addEventListener('timeupdate', onTime);
    return () => a.removeEventListener('timeupdate', onTime);
  }, [audioRef, lesson.hasAudio]);

  if (!lesson.hasAudio) return null;

  return (
    <Card>
      <CardHeader
        eyebrow="Source"
        title="Class recording"
        actions={
          lesson.durationSec != null ? <span className="text-xs font-bold text-muted">{formatDuration(lesson.durationSec)}</span> : null
        }
      />
      <CardBody className="space-y-4">
        <audio ref={audioRef} controls preload="metadata" src={`/api/lessons/${lesson.id}/audio`} className="w-full">
          Your browser cannot play this audio.
        </audio>
        {lesson.audioExpiresAt && (
          <p className="text-xs text-muted">The audio is kept until {formatDate(lesson.audioExpiresAt)}; the transcript stays.</p>
        )}

        <div>
          <h3 className="eyebrow mb-2">Transcript</h3>
          {!transcriptReady ? (
            <p className="text-sm text-muted">The transcript appears once the audio has been transcribed.</p>
          ) : q.isPending ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          ) : q.isError ? (
            <ErrorState error={q.error} onRetry={() => q.refetch()} />
          ) : q.data.segments.length > 0 ? (
            <ol className="max-h-96 space-y-0.5 overflow-y-auto border border-line p-1 rounded-control">
              {q.data.segments.map((seg, i) => {
                const active = currentTime >= seg.startSec && currentTime < seg.endSec;
                return (
                  <li key={`${seg.startSec}-${i}`}>
                    <button
                      type="button"
                      onClick={() => onSeek(seg.startSec)}
                      aria-current={active ? 'true' : undefined}
                      className={clsx(
                        'flex w-full gap-3 px-2 py-1.5 text-left text-sm rounded-control',
                        active ? 'bg-accent-soft' : 'hover:bg-surface-2',
                      )}
                    >
                      <span className="w-12 shrink-0 font-mono text-xs font-bold tabular-nums text-muted">
                        {formatDuration(seg.startSec)}
                      </span>
                      <span className="text-ink-2">{seg.text}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
          ) : q.data.transcript ? (
            <p className="max-h-96 overflow-y-auto whitespace-pre-line text-sm leading-relaxed text-ink-2">{q.data.transcript}</p>
          ) : (
            <EmptyState icon={<FileText className="size-8" aria-hidden />} title="No transcript" description="No speech was detected in this recording." />
          )}
        </div>
      </CardBody>
    </Card>
  );
}
