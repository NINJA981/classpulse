'use client';
import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BarChart3, Lock, RefreshCw } from 'lucide-react';
import type { ExamDetail, ExamMonitor, ExamMonitorRow } from '@classiq/shared';
import {
  Button,
  ButtonLink,
  Card,
  CardBody,
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
  useToast,
} from '@/components/ui';
import { ConfirmDialog } from '@/components/teacher/common';
import {
  AttemptStatusBadge,
  clockText,
  ExamStatusBadge,
  ViolationBadge,
  windowText,
} from '@/components/teacher/exams/exam-ui';
import { CloseExamButton } from '@/components/teacher/exams/exam-overview';
import { useNow } from '@/components/teacher/hooks';
import { api } from '@/lib/api';
import { formatRelative } from '@/lib/format';

const POLL_MS = 5000;
const EXTRA_MINUTES = 10;

type Action = { kind: 'unlock' | 'extra' | 'force'; row: ExamMonitorRow } | null;

const ACTION_COPY = {
  unlock: {
    title: 'Unlock device?',
    confirm: 'Unlock device',
    text: (name: string) =>
      `${name} can then continue on whichever device opens the exam next (with the access code).`,
  },
  extra: {
    title: `Give ${EXTRA_MINUTES} more minutes?`,
    confirm: `Add ${EXTRA_MINUTES} minutes`,
    text: (name: string) =>
      `${name}'s deadline moves ${EXTRA_MINUTES} minutes later, even past the closing time.`,
  },
  force: {
    title: 'Force submit?',
    confirm: 'Force submit',
    text: (name: string) => `${name}'s exam ends now and is graded with the answers saved so far.`,
  },
} as const;

export default function ExamMonitorPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const toast = useToast();
  const key = ['exams', id, 'monitor'];
  const q = useQuery({
    queryKey: key,
    queryFn: async () => {
      const m = await api.get<ExamMonitor>(`/exams/${id}/monitor`);
      return { ...m, offset: m.serverTime - Date.now() };
    },
    refetchInterval: POLL_MS,
  });
  const now = useNow(1000);
  const [action, setAction] = useState<Action>(null);
  const [rotateOpen, setRotateOpen] = useState(false);

  const act = useMutation({
    mutationFn: ({ kind, row }: NonNullable<Action>) => {
      const base = `/exams/${id}/attempts/${row.attemptId}`;
      if (kind === 'unlock') return api.post<ExamMonitorRow>(`${base}/unlock`);
      if (kind === 'extra') return api.post<ExamMonitorRow>(`${base}/extra-time`, { minutes: EXTRA_MINUTES });
      return api.post<ExamMonitorRow>(`${base}/force-submit`);
    },
    onSuccess: (_row, vars) => {
      setAction(null);
      void qc.invalidateQueries({ queryKey: key });
      toast(
        vars.kind === 'unlock'
          ? `${vars.row.student.name} can now continue on another device`
          : vars.kind === 'extra'
            ? `${vars.row.student.name} has ${EXTRA_MINUTES} more minutes`
            : `${vars.row.student.name}'s exam was submitted`,
      );
    },
  });

  const rotate = useMutation({
    mutationFn: () => api.post<ExamDetail>(`/exams/${id}/rotate-code`),
    onSuccess: () => {
      setRotateOpen(false);
      void qc.invalidateQueries({ queryKey: key });
      toast('New access code ready');
    },
  });

  const back = { href: `/teacher/exams/${id}`, label: 'Exam details' };
  if (q.isPending)
    return (
      <>
        <PageHeader back={back} title="Live monitor" />
        <LoadingBlock label="Loading monitor…" />
      </>
    );
  if (q.isError)
    return (
      <>
        <PageHeader back={back} title="Live monitor" />
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      </>
    );

  const { exam, rows, offset } = q.data;
  const serverNow = now + offset;
  const count = (s: ExamMonitorRow['status']) => rows.filter((r) => r.status === s).length;
  const finished = count('submitted') + count('auto_submitted');

  return (
    <>
      <PageHeader
        back={back}
        eyebrow="Live monitor"
        title={
          <span className="inline-flex flex-wrap items-center gap-3">
            {exam.title} <ExamStatusBadge status={exam.status} />
          </span>
        }
        description={`${exam.section.name} · ${windowText(exam.opensAt, exam.closesAt)} · ${exam.durationMin} min`}
        actions={
          <>
            <ButtonLink
              href={`/teacher/exams/${id}/results`}
              variant="secondary"
              icon={<BarChart3 className="size-4" aria-hidden />}
            >
              Results
            </ButtonLink>
            <CloseExamButton exam={exam} />
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
        <Card>
          <CardBody className="flex flex-col items-center gap-3 text-center">
            <p className="eyebrow">Access code</p>
            {exam.useAccessCode && exam.accessCode ? (
              <>
                <p
                  className="font-mono text-5xl font-black tracking-[0.2em] break-all sm:text-6xl"
                  aria-label={`Access code ${exam.accessCode.split('').join(' ')}`}
                >
                  {exam.accessCode}
                </p>
                <p className="text-xs text-muted">Write it on the board. Students type it to start.</p>
                {exam.status === 'published' && (
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<RefreshCw className="size-4" aria-hidden />}
                    onClick={() => {
                      rotate.reset();
                      setRotateOpen(true);
                    }}
                  >
                    New code
                  </Button>
                )}
              </>
            ) : (
              <p className="text-sm text-muted">This exam does not use an access code.</p>
            )}
          </CardBody>
        </Card>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="Enrolled" value={rows.length} />
          <StatCard label="Writing" value={count('in_progress')} />
          <StatCard label="Submitted" value={finished} />
          <StatCard label="Not started" value={count('not_started')} />
        </div>
      </div>

      <Card className="mt-6">
        {rows.length === 0 ? (
          <EmptyState
            title="No students in this section"
            description="Students enrolled in the section appear here."
          />
        ) : (
          <Table aria-label="Students" aria-busy={q.isFetching}>
            <THead>
              <tr>
                <TH>Student</TH>
                <TH>Status</TH>
                <TH className="text-right">Answered</TH>
                <TH className="text-right">Time left</TH>
                <TH>Warnings</TH>
                <TH>Device</TH>
                <TH>Last seen</TH>
                <TH>
                  <span className="sr-only">Actions</span>
                </TH>
              </tr>
            </THead>
            <TBody>
              {rows.map((r) => {
                const running = r.status === 'in_progress';
                const left = running && r.deadlineAt ? Date.parse(r.deadlineAt) - serverNow : null;
                return (
                  <TR key={r.student.id}>
                    <TD>
                      <p className="font-bold">{r.student.name}</p>
                      {r.student.rollNumber && <p className="text-xs text-muted">{r.student.rollNumber}</p>}
                    </TD>
                    <TD>
                      <AttemptStatusBadge status={r.status} />
                    </TD>
                    <TD className="text-right tabular-nums">
                      {r.answered}/{r.total}
                    </TD>
                    <TD className="text-right font-mono tabular-nums">
                      {left === null ? '—' : left > 0 ? clockText(left) : "Time's up"}
                      {r.extraMinutes > 0 && <p className="text-xs text-muted">+{r.extraMinutes} min</p>}
                    </TD>
                    <TD>
                      <ViolationBadge count={r.violationCount} max={exam.maxViolations} />
                    </TD>
                    <TD>
                      {r.deviceLocked ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold">
                          <Lock className="size-3.5" aria-hidden /> Locked
                        </span>
                      ) : (
                        <span className="text-xs text-muted">—</span>
                      )}
                    </TD>
                    <TD className="whitespace-nowrap text-xs text-ink-2">
                      {r.lastSeenAt ? formatRelative(r.lastSeenAt) : '—'}
                    </TD>
                    <TD>
                      {running && (
                        <div className="flex flex-wrap justify-end gap-1.5">
                          {r.deviceLocked && (
                            <Button
                              size="sm"
                              variant="secondary"
                              aria-label={`Unlock device for ${r.student.name}`}
                              onClick={() => setAction({ kind: 'unlock', row: r })}
                            >
                              Unlock
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="secondary"
                            aria-label={`Give ${r.student.name} ${EXTRA_MINUTES} more minutes`}
                            onClick={() => setAction({ kind: 'extra', row: r })}
                          >
                            +{EXTRA_MINUTES} min
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            aria-label={`Force submit for ${r.student.name}`}
                            onClick={() => setAction({ kind: 'force', row: r })}
                          >
                            Force submit
                          </Button>
                        </div>
                      )}
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        )}
      </Card>

      {action && (
        <ConfirmDialog
          open
          onClose={() => {
            setAction(null);
            act.reset();
          }}
          title={ACTION_COPY[action.kind].title}
          description={ACTION_COPY[action.kind].text(action.row.student.name)}
          confirmLabel={ACTION_COPY[action.kind].confirm}
          danger={action.kind === 'force'}
          loading={act.isPending}
          error={act.error}
          onConfirm={() => act.mutate(action)}
        />
      )}
      <ConfirmDialog
        open={rotateOpen}
        onClose={() => setRotateOpen(false)}
        title="Generate a new access code?"
        description="The current code stops working. Students already writing are not affected."
        confirmLabel="Generate new code"
        loading={rotate.isPending}
        error={rotate.error}
        onConfirm={() => rotate.mutate()}
      />
    </>
  );
}
