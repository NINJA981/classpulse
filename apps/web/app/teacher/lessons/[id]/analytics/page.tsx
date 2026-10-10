'use client';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BarChart3, ClipboardCheck, Lightbulb, Sparkles, Users } from 'lucide-react';
import type { LessonAnalytics, RemedialPlan } from '@classpulse/shared';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  ErrorState,
  InlineError,
  LoadingBlock,
  PageHeader,
  StatCard,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
  useToast,
} from '@/components/ui';
import { AccuracyChart, BandBadge } from '@/components/teacher/analytics/accuracy-chart';
import { OptionDistribution } from '@/components/teacher/analytics/option-distribution';
import { useLesson } from '@/components/teacher/lesson/use-lesson';
import { api } from '@/lib/api';
import { formatDateTime, formatPct } from '@/lib/format';

export default function LessonAnalyticsPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const toast = useToast();
  const lessonQ = useLesson(id);
  const key = ['lessons', id, 'analytics'];
  const q = useQuery({ queryKey: key, queryFn: () => api.get<LessonAnalytics>(`/lessons/${id}/analytics`) });

  const remedial = useMutation({
    mutationFn: () => api.post<RemedialPlan>(`/lessons/${id}/analytics/remedial`),
    onSuccess: (plan) => {
      const prev = qc.getQueryData<LessonAnalytics>(key);
      if (prev) qc.setQueryData<LessonAnalytics>(key, { ...prev, remedial: plan });
      toast('Remedial plan ready');
    },
  });

  const header = (
    <PageHeader
      back={{ href: `/teacher/lessons/${id}`, label: 'Back to lesson' }}
      eyebrow="Quiz analytics"
      title={lessonQ.data?.title ?? 'Lesson analytics'}
      description={lessonQ.data ? `${lessonQ.data.section.name} · ${lessonQ.data.subject}` : undefined}
    />
  );

  if (q.isPending)
    return (
      <>
        {header}
        <LoadingBlock label="Loading analytics…" />
      </>
    );
  if (q.isError)
    return (
      <>
        {header}
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      </>
    );

  const a = q.data;
  const questionsById = new Map((lessonQ.data?.questions ?? []).map((x) => [x.id, x]));
  const questions = [...a.questions].sort((x, y) => x.position - y.position);
  const participation = a.enrolledStudents ? Math.round((a.studentsAttempted / a.enrolledStudents) * 100) : null;

  return (
    <>
      {header}
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard label="Enrolled" value={a.enrolledStudents} icon={<Users className="size-4" aria-hidden />} />
          <StatCard
            label="Attempted"
            value={a.studentsAttempted}
            hint={participation != null ? `${participation}% of the section` : undefined}
            icon={<ClipboardCheck className="size-4" aria-hidden />}
          />
          <StatCard label="Average score" value={formatPct(a.averageScorePct)} icon={<BarChart3 className="size-4" aria-hidden />} />
        </div>

        {a.studentsAttempted === 0 ? (
          <Card>
            <EmptyState
              icon={<BarChart3 className="size-8" aria-hidden />}
              title="No attempts yet"
              description="Analytics appear once students in this section take the quiz. Run it live in class or let them take it on their own."
            />
          </Card>
        ) : (
          <>
            <Card>
              <CardHeader eyebrow="Accuracy" title="How the class did on each question" />
              <CardBody>
                <AccuracyChart questions={questions} />
              </CardBody>
            </Card>

            <Card>
              <CardHeader eyebrow="Answers" title="Option distribution" />
              <CardBody>
                <ol className="grid gap-6 md:grid-cols-2">
                  {questions.map((qa, i) => {
                    const full = questionsById.get(qa.questionId);
                    return (
                      <li key={qa.questionId} className="space-y-3 border border-line p-4 rounded-control">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-display text-sm font-black">Q{i + 1}</span>
                          <BandBadge band={qa.band} />
                          <span className="text-xs font-bold text-muted">
                            {formatPct(qa.accuracyPct)} correct · {qa.correct}/{qa.attempts}
                          </span>
                          {qa.topicTag && <span className="text-xs text-muted">· {qa.topicTag}</span>}
                        </div>
                        <p className="text-sm font-bold">{qa.stem}</p>
                        <OptionDistribution
                          distribution={qa.optionDistribution}
                          options={full?.options}
                          correctIndex={full?.correctIndex ?? null}
                        />
                      </li>
                    );
                  })}
                </ol>
              </CardBody>
            </Card>

            <Card>
              <CardHeader
                eyebrow="Next steps"
                title="Remedial plan"
                actions={
                  <Button
                    size="sm"
                    variant={a.remedial ? 'secondary' : 'primary'}
                    icon={<Sparkles className="size-3.5" aria-hidden />}
                    loading={remedial.isPending}
                    onClick={() => remedial.mutate()}
                  >
                    {a.remedial ? 'Regenerate remedial plan' : 'Generate remedial plan'}
                  </Button>
                }
              />
              <CardBody className="space-y-4">
                <InlineError error={remedial.error} />
                {a.remedial ? (
                  <>
                    <p className="text-sm leading-relaxed text-ink-2">{a.remedial.summary}</p>
                    <ul className="space-y-3">
                      {a.remedial.actions.map((act, i) => (
                        <li key={i} className="flex gap-3 border border-line p-3 rounded-control">
                          <Lightbulb className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden />
                          <div>
                            <p className="text-sm font-bold">{act.topic}</p>
                            <p className="text-sm text-ink-2">{act.recommendation}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                    <p className="text-xs text-muted">Generated {formatDateTime(a.remedial.generatedAt)}</p>
                  </>
                ) : (
                  <p className="text-sm text-muted">
                    Get AI suggestions for re-teaching the topics your class struggled with, based on these results.
                  </p>
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader eyebrow="Students" title="Scores" />
              <CardBody className="p-0 pb-2">
                <Table>
                  <THead>
                    <tr>
                      <TH>Student</TH>
                      <TH>Roll no.</TH>
                      <TH className="text-right">Score</TH>
                      <TH>Submitted</TH>
                    </tr>
                  </THead>
                  <TBody>
                    {[...a.students]
                      .sort((x, y) => y.scorePct - x.scorePct)
                      .map((s) => (
                        <TR key={s.studentId}>
                          <TD className="font-bold">{s.name}</TD>
                          <TD className="font-mono text-xs">{s.rollNumber}</TD>
                          <TD className="text-right font-bold tabular-nums">{formatPct(s.scorePct)}</TD>
                          <TD className="whitespace-nowrap text-ink-2">{formatDateTime(s.submittedAt)}</TD>
                        </TR>
                      ))}
                  </TBody>
                </Table>
              </CardBody>
            </Card>
          </>
        )}
      </div>
    </>
  );
}
