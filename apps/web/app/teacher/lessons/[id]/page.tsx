'use client';
import { useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import { ErrorState, LoadingBlock, PageHeader } from '@/components/ui';
import { AssignmentEditor } from '@/components/teacher/lesson/assignment-editor';
import { LessonActions, useGenerate } from '@/components/teacher/lesson/lesson-actions';
import { LessonAudioUpload } from '@/components/teacher/lesson/lesson-audio-upload';
import { FailedView, ProcessingView, RecordingNotice } from '@/components/teacher/lesson/processing-view';
import { QuestionList } from '@/components/teacher/lesson/question-list';
import { SummaryEditor } from '@/components/teacher/lesson/summary-editor';
import { AudioTranscript } from '@/components/teacher/lesson/transcript-panel';
import { useLesson } from '@/components/teacher/lesson/use-lesson';
import { LessonStatusBadge, isProcessing } from '@/components/teacher/status';
import { formatDate, formatDuration, languageLabel } from '@/lib/format';
import type { LessonDetail } from '@classpulse/shared';

export default function LessonWorkspacePage() {
  const { id } = useParams<{ id: string }>();
  const q = useLesson(id);

  if (q.isPending) return <LoadingBlock label="Loading lesson…" />;
  if (q.isError)
    return (
      <>
        <PageHeader title="Lesson" back={{ href: '/teacher/lessons', label: 'Lessons' }} />
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      </>
    );
  return <Workspace lesson={q.data} />;
}

function Workspace({ lesson }: { lesson: LessonDetail }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const generate = useGenerate(lesson);
  const processing = isProcessing(lesson.status);

  const seek = useCallback((sec: number) => {
    const a = audioRef.current;
    if (!a) return;
    a.currentTime = sec;
    a.scrollIntoView({ behavior: 'smooth', block: 'center' });
    void a.play().catch(() => undefined);
  }, []);

  return (
    <>
      <PageHeader
        back={{ href: '/teacher/lessons', label: 'Lessons' }}
        eyebrow={`${lesson.section.name} · ${lesson.subject}`}
        title={lesson.title}
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <LessonStatusBadge status={lesson.status} />
            <span>{languageLabel(lesson.language)}</span>
            {lesson.durationSec != null && <span>{formatDuration(lesson.durationSec)}</span>}
            <span>Created {formatDate(lesson.createdAt)}</span>
            {lesson.publishedAt && <span>Published {formatDate(lesson.publishedAt)}</span>}
          </span>
        }
        actions={<LessonActions lesson={lesson} />}
      />

      <div className="space-y-6">
        {lesson.status === 'recording' && <RecordingNotice />}
        {processing && <ProcessingView lesson={lesson} />}
        {lesson.status === 'failed' && (
          <FailedView
            lesson={lesson}
            retrying={generate.isPending}
            error={generate.error}
            onRetry={
              lesson.hasAudio ? () => generate.mutate(lesson.questions.length ? { confirmRegenerate: true } : {}) : null
            }
          />
        )}
        {!lesson.hasAudio && (lesson.status === 'draft' || lesson.status === 'failed') && <LessonAudioUpload lesson={lesson} />}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          <div className="min-w-0 lg:col-span-3">
            {processing ? null : <QuestionList lesson={lesson} onSeek={lesson.hasAudio ? seek : null} />}
          </div>
          <div className="min-w-0 space-y-6 lg:col-span-2">
            <AudioTranscript lesson={lesson} audioRef={audioRef} onSeek={seek} />
            <SummaryEditor lesson={lesson} readOnly={processing} />
          </div>
        </div>

        {!processing && lesson.status !== 'recording' && <AssignmentEditor lesson={lesson} />}
      </div>
    </>
  );
}
