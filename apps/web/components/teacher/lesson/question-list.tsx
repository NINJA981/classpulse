'use client';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCheck, ListChecks, Lock, Plus } from 'lucide-react';
import { languageLabel } from '@/lib/format';
import type { LessonDetail, Question } from '@classiq/shared';
import { Button, Card, CardBody, CardHeader, EmptyState, InlineError, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { QuestionCard } from './question-card';
import { QuestionEditorDialog } from './question-editor-dialog';
import { lessonKey } from './use-lesson';

/** Review list for the generated questions. Read-only once the lesson is published. */
export function QuestionList({ lesson, onSeek }: { lesson: LessonDetail; onSeek: ((sec: number) => void) | null }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [editing, setEditing] = useState<Question | 'new' | null>(null);

  const readOnly = lesson.status === 'published';
  const canEdit = lesson.status === 'ready_for_review' || lesson.status === 'draft' || lesson.status === 'failed';
  const questions = [...lesson.questions].sort((a, b) => a.position - b.position);
  const counts = {
    approved: questions.filter((q) => q.status === 'approved').length,
    draft: questions.filter((q) => q.status === 'draft').length,
    rejected: questions.filter((q) => q.status === 'rejected').length,
  };

  const approveAll = useMutation({
    mutationFn: () => api.post<Question[]>(`/lessons/${lesson.id}/questions/approve-all`),
    onSuccess: (qs) => {
      qc.invalidateQueries({ queryKey: lessonKey(lesson.id) });
      toast(`${qs.length} ${qs.length === 1 ? 'question' : 'questions'} approved`);
    },
  });

  const localLanguageLabel = lesson.language !== 'en-IN' ? languageLabel(lesson.language) : null;

  return (
    <section aria-labelledby="questions-heading" className="space-y-4">
      <Card>
        <CardHeader
          eyebrow="Quiz"
          title={<span id="questions-heading">Questions</span>}
          actions={
            canEdit ? (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<Plus className="size-3.5" aria-hidden />}
                  onClick={() => setEditing('new')}
                >
                  Add question
                </Button>
                {counts.draft > 0 && (
                  <Button
                    size="sm"
                    icon={<CheckCheck className="size-3.5" aria-hidden />}
                    loading={approveAll.isPending}
                    onClick={() => approveAll.mutate()}
                  >
                    Approve all
                  </Button>
                )}
              </>
            ) : null
          }
        />
        <CardBody className="space-y-3">
          <p className="text-sm text-muted">
            {questions.length} {questions.length === 1 ? 'question' : 'questions'} · {counts.approved} approved ·{' '}
            {counts.draft} pending · {counts.rejected} rejected. Only approved questions are published to students.
          </p>
          {readOnly && (
            <p
              role="note"
              className="flex items-start gap-2 border border-line bg-surface-2 px-3 py-2 text-sm text-ink-2 rounded-control"
            >
              <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
              This lesson is published, so its questions are read-only. Unpublish it to edit, approve or reject questions.
            </p>
          )}
          <InlineError error={approveAll.error} />
        </CardBody>
      </Card>

      {questions.length === 0 ? (
        <Card>
          <EmptyState
            icon={<ListChecks className="size-8" aria-hidden />}
            title="No questions yet"
            description={
              lesson.hasAudio
                ? 'Generate the quiz from the class recording, or write questions yourself.'
                : 'Upload the class audio to generate questions, or write them yourself.'
            }
            action={
              canEdit ? (
                <Button variant="secondary" onClick={() => setEditing('new')}>
                  Write a question
                </Button>
              ) : null
            }
          />
        </Card>
      ) : (
        <ol className="space-y-4">
          {questions.map((q, i) => (
            <li key={q.id}>
              <QuestionCard
                question={q}
                number={i + 1}
                readOnly={!canEdit}
                onEdit={() => setEditing(q)}
                onSeek={lesson.hasAudio ? onSeek : null}
              />
            </li>
          ))}
        </ol>
      )}

      <QuestionEditorDialog
        key={editing === 'new' ? 'new' : (editing?.id ?? 'closed')}
        open={editing !== null}
        onClose={() => setEditing(null)}
        lessonId={lesson.id}
        question={editing === 'new' ? null : editing}
        localLanguageLabel={localLanguageLabel}
      />
    </section>
  );
}
