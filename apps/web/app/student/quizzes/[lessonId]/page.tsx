'use client';
import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { QuizAttemptResult, StudentQuiz, SubmitQuizAttemptInput } from '@classiq/shared';
import { ButtonLink, EmptyState, ErrorState, LoadingBlock, PageHeader, useToast } from '@/components/ui';
import { QuizIntro, QuizPlayer, type QuizAnswers } from '@/components/student/quiz/quiz-player';
import { QuizResults } from '@/components/student/quiz/quiz-results';
import { ApiError, api } from '@/lib/api';

/**
 * The idempotency key lives in sessionStorage until the attempt is accepted, so a
 * double-tap or a refresh-and-resubmit returns the original result instead of
 * recording a second attempt.
 */
const keyName = (lessonId: string) => `classpulse:quiz-attempt:${lessonId}`;

function getAttemptKey(lessonId: string): string {
  try {
    const existing = window.sessionStorage.getItem(keyName(lessonId));
    if (existing) return existing;
    const fresh = crypto.randomUUID();
    window.sessionStorage.setItem(keyName(lessonId), fresh);
    return fresh;
  } catch {
    return crypto.randomUUID();
  }
}

function clearAttemptKey(lessonId: string) {
  try {
    window.sessionStorage.removeItem(keyName(lessonId));
  } catch {
    /* storage unavailable */
  }
}

type View = 'auto' | 'intro' | 'playing' | 'result';

export default function QuizPage() {
  const { lessonId } = useParams<{ lessonId: string }>();
  const qc = useQueryClient();
  const toast = useToast();
  const [view, setView] = useState<View>('auto');
  const [run, setRun] = useState(0);

  const quiz = useQuery({
    queryKey: ['student', 'quizzes', lessonId],
    queryFn: () => api.get<StudentQuiz>(`/student/quizzes/${lessonId}`),
  });

  const latest = useQuery({
    queryKey: ['student', 'quizzes', lessonId, 'latest'],
    queryFn: async () => {
      try {
        return await api.get<QuizAttemptResult>(`/student/quizzes/${lessonId}/attempts/latest`);
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) return null;
        throw err;
      }
    },
  });

  const submit = useMutation({
    mutationFn: (answers: QuizAnswers) => {
      const body: SubmitQuizAttemptInput = {
        idempotencyKey: getAttemptKey(lessonId),
        answers: (quiz.data?.questions ?? []).map((q) => ({ questionId: q.id, selectedIndex: answers[q.id] ?? null })),
      };
      return api.post<QuizAttemptResult>(`/student/quizzes/${lessonId}/attempts`, body);
    },
    onSuccess: (result) => {
      clearAttemptKey(lessonId);
      qc.setQueryData(['student', 'quizzes', lessonId, 'latest'], result);
      void qc.invalidateQueries({ queryKey: ['student', 'quizzes'], exact: true });
      void qc.invalidateQueries({ queryKey: ['student', 'dashboard'] });
      setView('result');
      toast('Quiz submitted');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
  });

  const back = { href: '/student/quizzes', label: 'All quizzes' };

  if (quiz.isPending || latest.isPending) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader back={back} title="Quiz" />
        <LoadingBlock label="Loading quiz…" />
      </div>
    );
  }

  if (quiz.isError || latest.isError) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader back={back} title="Quiz" />
        <ErrorState
          error={quiz.error ?? latest.error}
          onRetry={() => {
            void quiz.refetch();
            void latest.refetch();
          }}
        />
      </div>
    );
  }

  const data = quiz.data;
  const current: View = view === 'auto' ? (latest.data ? 'result' : 'intro') : view;

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader back={back} eyebrow={data.subject} title={data.title} />

      {data.questions.length === 0 ? (
        <EmptyState
          title="No questions yet"
          description="Your teacher hasn't added questions to this quiz yet. Check back later."
          action={<ButtonLink href="/student/quizzes">Back to quizzes</ButtonLink>}
        />
      ) : current === 'result' && latest.data ? (
        <QuizResults
          result={latest.data}
          onRetake={() => {
            submit.reset();
            setRun((r) => r + 1);
            setView('intro');
            window.scrollTo({ top: 0 });
          }}
        />
      ) : current === 'playing' ? (
        <QuizPlayer
          key={run}
          quiz={data}
          submitting={submit.isPending}
          submitError={submit.error}
          onSubmit={(answers) => {
            if (!submit.isPending) submit.mutate(answers);
          }}
        />
      ) : (
        <QuizIntro quiz={data} onStart={() => setView('playing')} />
      )}
    </div>
  );
}
