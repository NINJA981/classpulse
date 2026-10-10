'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BarChart3, EyeOff, Radio, RefreshCw, Send, Sparkles, Trash2 } from 'lucide-react';
import type { GenerateLessonInput, LessonDetail } from '@classpulse/shared';
import { Button, ButtonLink, InlineError, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { ConfirmDialog } from '@/components/teacher/common';
import { lessonKey } from './use-lesson';

/** POST /lessons/:id/generate, flipping the cached lesson to `queued` so the processing view shows at once. */
export function useGenerate(lesson: LessonDetail) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (input: GenerateLessonInput) => api.post<{ jobId: string }>(`/lessons/${lesson.id}/generate`, input),
    onSuccess: () => {
      const prev = qc.getQueryData<LessonDetail>(lessonKey(lesson.id));
      if (prev) qc.setQueryData<LessonDetail>(lessonKey(lesson.id), { ...prev, status: 'queued', progress: null, failureReason: null });
      qc.invalidateQueries({ queryKey: lessonKey(lesson.id) });
      qc.invalidateQueries({ queryKey: ['lessons', lesson.id, 'transcript'] });
      toast('Quiz generation started');
    },
  });
}

type Confirm = 'generate' | 'regenerate' | 'delete' | 'unpublish' | null;

/** Header actions for the lesson workspace. */
export function LessonActions({ lesson }: { lesson: LessonDetail }) {
  const qc = useQueryClient();
  const router = useRouter();
  const toast = useToast();
  const [confirm, setConfirm] = useState<Confirm>(null);
  const generate = useGenerate(lesson);

  const approved = lesson.questions.filter((q) => q.status === 'approved').length;
  const s = lesson.status;
  const canGenerate = lesson.hasAudio && (s === 'draft' || s === 'failed');
  const canRegenerate = lesson.hasAudio && (s === 'ready_for_review' || s === 'published');
  const canDelete = s === 'draft' || s === 'failed';

  const transition = useMutation({
    mutationFn: (kind: 'publish' | 'unpublish') => api.post<LessonDetail>(`/lessons/${lesson.id}/${kind}`),
    onSuccess: (l, kind) => {
      qc.setQueryData(lessonKey(lesson.id), l);
      qc.invalidateQueries({ queryKey: ['lessons'] });
      qc.invalidateQueries({ queryKey: ['teacher', 'dashboard'] });
      setConfirm(null);
      toast(kind === 'publish' ? 'Published — students can now take the quiz' : 'Unpublished — you can edit the questions again');
    },
  });

  const remove = useMutation({
    mutationFn: () => api.delete(`/lessons/${lesson.id}`),
    onSuccess: () => {
      qc.removeQueries({ queryKey: lessonKey(lesson.id) });
      qc.invalidateQueries({ queryKey: ['lessons'] });
      qc.invalidateQueries({ queryKey: ['teacher', 'dashboard'] });
      toast('Lesson deleted');
      router.replace('/teacher/lessons');
    },
  });

  function runGenerate() {
    if (lesson.questions.length > 0) setConfirm('generate');
    else generate.mutate({});
  }

  return (
    <>
      {canGenerate && (
        <Button icon={<Sparkles className="size-4" aria-hidden />} loading={generate.isPending} onClick={runGenerate}>
          Generate quiz
        </Button>
      )}
      {s === 'ready_for_review' && (
        <Button
          icon={<Send className="size-4" aria-hidden />}
          loading={transition.isPending && transition.variables === 'publish'}
          disabled={approved === 0 || transition.isPending}
          title={approved === 0 ? 'Approve at least one question to publish' : undefined}
          onClick={() => transition.mutate('publish')}
        >
          Publish
        </Button>
      )}
      {s === 'published' && (
        <>
          <Button icon={<Radio className="size-4" aria-hidden />} onClick={() => router.push(`/teacher/lessons/${lesson.id}/live`)}>
            Start live quiz
          </Button>
          <ButtonLink variant="secondary" href={`/teacher/lessons/${lesson.id}/analytics`} icon={<BarChart3 className="size-4" aria-hidden />}>
            Analytics
          </ButtonLink>
          <Button variant="secondary" icon={<EyeOff className="size-4" aria-hidden />} onClick={() => setConfirm('unpublish')}>
            Unpublish
          </Button>
        </>
      )}
      {canRegenerate && (
        <Button variant="secondary" icon={<RefreshCw className="size-4" aria-hidden />} onClick={() => setConfirm('regenerate')}>
          Regenerate
        </Button>
      )}
      {canDelete && (
        <Button variant="ghost" icon={<Trash2 className="size-4" aria-hidden />} onClick={() => setConfirm('delete')}>
          Delete
        </Button>
      )}

      {!confirm && (generate.error || transition.error) ? (
        <div className="w-full">
          <InlineError error={generate.error ?? transition.error} />
        </div>
      ) : null}

      <ConfirmDialog
        open={confirm === 'generate' || confirm === 'regenerate'}
        onClose={() => setConfirm(null)}
        title="Replace the questions?"
        description={
          s === 'published'
            ? 'The lesson is unpublished and every current question — including your edits — is replaced with a new set. Students will not see the quiz until you publish again.'
            : 'Every current question — including your edits — is replaced with a newly generated set.'
        }
        confirmLabel="Replace questions"
        danger
        loading={generate.isPending}
        error={generate.error}
        onConfirm={() => generate.mutate({ confirmRegenerate: true }, { onSuccess: () => setConfirm(null) })}
      />
      <ConfirmDialog
        open={confirm === 'unpublish'}
        onClose={() => setConfirm(null)}
        title="Unpublish this lesson?"
        description="Students can no longer start the quiz. Existing attempts are kept. You can publish again after editing."
        confirmLabel="Unpublish lesson"
        loading={transition.isPending}
        error={transition.error}
        onConfirm={() => transition.mutate('unpublish')}
      />
      <ConfirmDialog
        open={confirm === 'delete'}
        onClose={() => setConfirm(null)}
        title="Delete this lesson?"
        description="The lesson, its audio, transcript and questions are deleted permanently."
        confirmLabel="Delete lesson"
        danger
        loading={remove.isPending}
        error={remove.error}
        onConfirm={() => remove.mutate()}
      />
    </>
  );
}
