import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type { StudentQuizListItem } from '@classpulse/shared';
import { Badge, Card } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { ScoreBadge } from '../common';

/** Tappable quiz summary card linking to the player. */
export function QuizCard({ quiz }: { quiz: StudentQuizListItem }) {
  return (
    <Link href={`/student/quizzes/${quiz.lessonId}`} className="group block rounded-card focus-visible:outline-offset-4">
      <Card className="flex items-center gap-3 p-4 transition-transform group-hover:-translate-y-0.5">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            {quiz.latestAttempt ? <ScoreBadge pct={quiz.latestAttempt.scorePct} /> : <Badge tone="accent">New</Badge>}
            <span className="eyebrow">{quiz.subject}</span>
          </div>
          <p className="font-display text-lg font-extrabold leading-snug">{quiz.title}</p>
          <p className="mt-0.5 text-sm text-muted">
            {quiz.section.name} · {quiz.teacherName}
          </p>
          <p className="mt-1 text-xs text-muted">
            {quiz.questionCount} {quiz.questionCount === 1 ? 'question' : 'questions'} · Published {formatDate(quiz.publishedAt)}
          </p>
        </div>
        <ChevronRight className="size-5 shrink-0 text-muted" aria-hidden />
      </Card>
    </Link>
  );
}
