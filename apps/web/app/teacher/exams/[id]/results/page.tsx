'use client';
import { Fragment, useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, Download, MonitorPlay } from 'lucide-react';
import type { ExamResults } from '@classpulse/shared';
import {
  Button,
  ButtonLink,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  ErrorState,
  LoadingBlock,
  PageHeader,
  StatCard,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from '@/components/ui';
import { OptionDistribution } from '@/components/teacher/analytics/option-distribution';
import {
  AttemptStatusBadge,
  ExamStatusBadge,
  IntegrityTimeline,
  ViolationBadge,
} from '@/components/teacher/exams/exam-ui';
import { api } from '@/lib/api';
import { formatDateTime, formatPct } from '@/lib/format';

export default function ExamResultsPage() {
  const { id } = useParams<{ id: string }>();
  const q = useQuery({
    queryKey: ['exams', id, 'results'],
    queryFn: () => api.get<ExamResults>(`/exams/${id}/results`),
  });
  const [open, setOpen] = useState<Set<string>>(new Set());

  const back = { href: `/teacher/exams/${id}`, label: 'Exam details' };
  if (q.isPending)
    return (
      <>
        <PageHeader back={back} title="Exam results" />
        <LoadingBlock label="Loading results…" />
      </>
    );
  if (q.isError)
    return (
      <>
        <PageHeader back={back} title="Exam results" />
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      </>
    );

  const r = q.data;
  const finished = r.students.filter((s) => s.status === 'submitted' || s.status === 'auto_submitted');
  const flagged = r.students.filter((s) => s.violationCount > 0).length;
  const pool = new Map(r.exam.pool.map((p) => [p.id, p]));
  const toggle = (sid: string) =>
    setOpen((s) => {
      const next = new Set(s);
      if (next.has(sid)) next.delete(sid);
      else next.add(sid);
      return next;
    });

  return (
    <>
      <PageHeader
        back={back}
        eyebrow="Exam results"
        title={
          <span className="inline-flex flex-wrap items-center gap-3">
            {r.exam.title} <ExamStatusBadge status={r.exam.status} />
          </span>
        }
        description={r.exam.section.name}
        actions={
          <>
            {r.exam.status === 'published' && (
              <ButtonLink
                href={`/teacher/exams/${id}/monitor`}
                variant="secondary"
                icon={<MonitorPlay className="size-4" aria-hidden />}
              >
                Monitor
              </ButtonLink>
            )}
            <Button
              icon={<Download className="size-4" aria-hidden />}
              onClick={() => window.location.assign(`/api/exams/${id}/results.csv`)}
            >
              Download CSV
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Average score" value={formatPct(r.averageScorePct)} hint="Submitted attempts only" />
        <StatCard label="Submitted" value={`${finished.length}/${r.students.length}`} />
        <StatCard label="Students with warnings" value={flagged} />
      </div>

      <Card className="mt-6">
        <CardHeader title="Students" />
        <CardBody className="px-0 pb-2">
          {r.students.length === 0 ? (
            <EmptyState title="No students in this section" />
          ) : (
            <Table aria-label="Student results">
              <THead>
                <tr>
                  <TH>Student</TH>
                  <TH>Status</TH>
                  <TH className="text-right">Score</TH>
                  <TH className="text-right">Correct</TH>
                  <TH>Warnings</TH>
                  <TH>Submitted</TH>
                  <TH>
                    <span className="sr-only">Integrity timeline</span>
                  </TH>
                </tr>
              </THead>
              <TBody>
                {r.students.map((s) => {
                  const expanded = open.has(s.student.id);
                  const panelId = `timeline-${s.student.id}`;
                  return (
                    <Fragment key={s.student.id}>
                      <TR>
                        <TD>
                          <p className="font-bold">{s.student.name}</p>
                          {s.student.rollNumber && (
                            <p className="text-xs text-muted">{s.student.rollNumber}</p>
                          )}
                        </TD>
                        <TD>
                          <AttemptStatusBadge status={s.status} />
                        </TD>
                        <TD className="text-right font-bold tabular-nums">{formatPct(s.scorePct)}</TD>
                        <TD className="text-right tabular-nums">
                          {s.correct === null ? '—' : `${s.correct}/${s.total}`}
                        </TD>
                        <TD>
                          <ViolationBadge count={s.violationCount} max={r.exam.maxViolations} />
                        </TD>
                        <TD className="whitespace-nowrap text-xs text-ink-2">
                          {formatDateTime(s.submittedAt)}
                        </TD>
                        <TD className="text-right">
                          {s.attemptId && (
                            <Button
                              size="sm"
                              variant="ghost"
                              aria-expanded={expanded}
                              aria-controls={panelId}
                              aria-label={`${expanded ? 'Hide' : 'Show'} timeline for ${s.student.name}`}
                              icon={
                                expanded ? (
                                  <ChevronDown className="size-4" aria-hidden />
                                ) : (
                                  <ChevronRight className="size-4" aria-hidden />
                                )
                              }
                              onClick={() => toggle(s.student.id)}
                            >
                              Timeline
                            </Button>
                          )}
                        </TD>
                      </TR>
                      {expanded && (
                        <tr id={panelId} className="border-b border-line bg-surface-2/60">
                          <td colSpan={7} className="px-4 py-3">
                            <IntegrityTimeline
                              events={s.events}
                              label={`Integrity timeline for ${s.student.name}`}
                            />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </TBody>
            </Table>
          )}
        </CardBody>
      </Card>

      <Card className="mt-6">
        <CardHeader title="Questions" eyebrow="Accuracy across submitted papers" />
        <CardBody>
          <ol className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {r.questions.map((qs) => (
              <li key={qs.examQuestionId} className="min-w-0 rounded-control border border-line p-4">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <p className="min-w-0 font-semibold break-words">
                    {qs.position}. {qs.stem}
                  </p>
                  <span className="shrink-0 font-display text-xl font-black tabular-nums">
                    {formatPct(qs.accuracyPct)}
                  </span>
                </div>
                <p className="mb-2 text-xs text-muted">
                  Given to {qs.served} · answered by {qs.answered}
                </p>
                <OptionDistribution
                  distribution={qs.optionDistribution}
                  options={pool.get(qs.examQuestionId)?.options}
                  correctIndex={qs.correctIndex}
                />
              </li>
            ))}
          </ol>
        </CardBody>
      </Card>
    </>
  );
}
