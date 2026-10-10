'use client';
import { useQuery } from '@tanstack/react-query';
import { ListChecks } from 'lucide-react';
import type { StudentQuizListItem } from '@classpulse/shared';
import { ButtonLink, Card, EmptyState, ErrorState, PageHeader, Skeleton } from '@/components/ui';
import { QuizCard } from '@/components/student/quiz/quiz-card';
import { api } from '@/lib/api';

export default function QuizzesPage() {
  const quizzes = useQuery({
    queryKey: ['student', 'quizzes'],
    queryFn: () => api.get<StudentQuizListItem[]>('/student/quizzes'),
  });

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader eyebrow="Practice" title="Quizzes" description="Quizzes made from your class lectures. Take them as often as you like." />
      {quizzes.isPending ? (
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 rounded-card" />
          ))}
        </div>
      ) : quizzes.isError ? (
        <ErrorState error={quizzes.error} onRetry={() => void quizzes.refetch()} />
      ) : quizzes.data.length === 0 ? (
        <Card>
          <EmptyState
            icon={<ListChecks className="size-8" aria-hidden />}
            title="No quizzes yet"
            description="When your teacher publishes a lesson, its quiz shows up here. Not in a class yet? Join one with the code from your teacher."
            action={
              <ButtonLink href="/student/join" size="lg">
                Join a class
              </ButtonLink>
            }
          />
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {quizzes.data.map((q) => (
            <li key={q.lessonId}>
              <QuizCard quiz={q} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
