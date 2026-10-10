'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MonitorUp, Play, SkipForward, Square, Users } from 'lucide-react';
import type { LeaderboardEntry, LiveSessionInfo, LiveSessionResults } from '@classpulse/shared';
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  CardBody,
  CardHeader,
  ErrorState,
  InlineError,
  LoadingBlock,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from '@/components/ui';
import { api } from '@/lib/api';
import { ConfirmDialog } from '@/components/teacher/common';
import { OptionDistribution } from '@/components/teacher/analytics/option-distribution';
import { Countdown, ConnectionBanner, Leaderboard, OptionTiles, Podium } from './parts';
import { useLiveHost } from './use-live-host';

type Cmd = 'host:start' | 'host:next' | 'host:close_question' | 'host:end';

/** Host console for a live quiz session. */
export function LiveHost({ session, lessonId }: { session: LiveSessionInfo; lessonId: string }) {
  const { state, command } = useLiveHost(session.id);
  const [pending, setPending] = useState<Cmd | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [started, setStarted] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);

  async function run(cmd: Cmd) {
    setPending(cmd);
    setError(null);
    try {
      await command(cmd);
      if (cmd === 'host:start') setStarted(true);
      if (cmd === 'host:end') setConfirmEnd(false);
    } catch (err) {
      setError(err);
    } finally {
      setPending(null);
    }
  }

  function openProjector() {
    window.open(`/teacher/lessons/${lessonId}/present?session=${session.id}`, '_blank', 'noopener');
  }

  if (state.joinError)
    return <ErrorState error={new Error(state.joinError)} onRetry={() => window.location.reload()} />;
  if (!state.snapshot) return <LoadingBlock label="Connecting to the live session…" />;

  const snap = state.snapshot;
  const total = state.question?.total ?? snap.questionCount;
  const index = state.closed?.index ?? state.question?.index ?? snap.currentQuestionIndex;
  const isLast = index != null && index + 1 >= total;
  const ended = state.status === 'ended';

  const toolbar = (
    <div className="flex flex-wrap items-center gap-3">
      <span className="font-mono text-sm font-bold">
        PIN <span className="text-lg tracking-widest">{snap.pin}</span>
      </span>
      <Badge tone="info">
        <Users className="size-3" aria-hidden /> {state.participantCount} joined
      </Badge>
      {index != null && !ended && (
        <Badge>
          Question {index + 1} of {total}
        </Badge>
      )}
      <div className="ml-auto flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" icon={<MonitorUp className="size-4" aria-hidden />} onClick={openProjector}>
          Open projector view
        </Button>
        {!ended && (
          <Button variant="ghost" size="sm" onClick={() => setConfirmEnd(true)}>
            End session
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <ConnectionBanner connection={state.connection} />
      {toolbar}
      {!confirmEnd && <InlineError error={error} />}

      {ended ? (
        <EndedView sessionId={session.id} lessonId={lessonId} board={state.finalBoard ?? state.leaderboard} />
      ) : state.status === 'lobby' ? (
        <Card>
          <CardBody className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            <div className="flex flex-col items-center justify-center gap-3 text-center">
              <p className="eyebrow">Students join at Live quiz with PIN</p>
              <p className="font-display text-7xl font-black tracking-[0.15em] tabular-nums">{snap.pin}</p>
              <p className="text-sm text-muted">
                {total} {total === 1 ? 'question' : 'questions'} · {session.timeLimitSec}s each
              </p>
              {started ? (
                <Button size="lg" icon={<SkipForward className="size-4" aria-hidden />} loading={pending === 'host:next'} onClick={() => run('host:next')}>
                  Next question
                </Button>
              ) : (
                <Button
                  size="lg"
                  icon={<Play className="size-4" aria-hidden />}
                  loading={pending === 'host:start'}
                  onClick={() => run('host:start')}
                >
                  Start
                </Button>
              )}
              {state.participantCount === 0 && !started && (
                <p className="text-xs text-muted">Waiting for at least one student to join.</p>
              )}
            </div>
            <div>
              <h2 className="eyebrow mb-3">Participants ({state.participantCount})</h2>
              {state.participants.length === 0 ? (
                <p className="text-sm text-muted">Nobody has joined yet.</p>
              ) : (
                <ul className="flex flex-wrap gap-2">
                  {state.participants.map((p) => (
                    <li key={p.participantId}>
                      <Badge tone={p.connected ? 'accent' : 'neutral'}>
                        {p.name}
                        {!p.connected && ' (offline)'}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </CardBody>
        </Card>
      ) : state.status === 'question_open' && state.question ? (
        <Card>
          <CardBody className="space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <p className="eyebrow mb-2">
                  Question {state.question.index + 1} of {state.question.total}
                </p>
                <h2 className="font-display text-2xl font-black leading-snug">{state.question.stem}</h2>
                {state.question.stemLocal && <p className="mt-1 text-ink-2">{state.question.stemLocal}</p>}
              </div>
              <Countdown closesAt={state.question.closesAt} offsetMs={state.offsetMs} />
            </div>
            <OptionTiles options={state.question.options} correctIndex={state.question.correctIndex ?? null} />
            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line pt-4">
              <p className="text-sm font-bold" aria-live="polite">
                {state.answered?.questionId === state.question.questionId ? state.answered.answeredCount : 0} /{' '}
                {state.answered?.participantCount ?? state.participantCount} answered
              </p>
              <Button
                variant="secondary"
                icon={<Square className="size-4" aria-hidden />}
                loading={pending === 'host:close_question'}
                onClick={() => run('host:close_question')}
              >
                Close question
              </Button>
            </div>
          </CardBody>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          <Card className="lg:col-span-3">
            <CardHeader eyebrow={index != null ? `Question ${index + 1} results` : 'Results'} title={state.question?.stem ?? 'Question closed'} />
            <CardBody className="space-y-5">
              {state.closed ? (
                <>
                  <OptionDistribution
                    distribution={state.closed.distribution}
                    options={state.question?.options}
                    correctIndex={state.closed.correctIndex}
                  />
                  <p className="text-sm text-muted">{state.closed.answeredCount} answered</p>
                  {state.closed.explanation && (
                    <div className="border-l-2 border-line-strong pl-3 text-sm text-ink-2">
                      <p className="eyebrow mb-1">Explanation</p>
                      <p>{state.closed.explanation}</p>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted">This question is closed.</p>
              )}
            </CardBody>
          </Card>
          <Card className="lg:col-span-2">
            <CardHeader eyebrow="Standings" title="Leaderboard" />
            <CardBody className="space-y-5">
              <Leaderboard entries={state.leaderboard} limit={8} />
              <div className="flex flex-wrap gap-2">
                {!isLast && (
                  <Button icon={<SkipForward className="size-4" aria-hidden />} loading={pending === 'host:next'} onClick={() => run('host:next')}>
                    Next question
                  </Button>
                )}
                <Button variant={isLast ? 'primary' : 'secondary'} loading={pending === 'host:end'} onClick={() => run('host:end')}>
                  Finish quiz
                </Button>
              </div>
            </CardBody>
          </Card>
        </div>
      )}

      <ConfirmDialog
        open={confirmEnd}
        onClose={() => setConfirmEnd(false)}
        title="End the live session now?"
        description="Remaining questions are skipped and the final leaderboard is shown to everyone."
        confirmLabel="End now"
        danger
        loading={pending === 'host:end'}
        error={error}
        onConfirm={() => run('host:end')}
      />
    </div>
  );
}

function EndedView({ sessionId, lessonId, board }: { sessionId: string; lessonId: string; board: LeaderboardEntry[] }) {
  const results = useQuery({
    queryKey: ['live-sessions', sessionId, 'results'],
    queryFn: () => api.get<LiveSessionResults>(`/live-sessions/${sessionId}/results`),
  });
  const finalBoard = results.data?.leaderboard ?? board;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader eyebrow="Quiz finished" title="Final standings" />
        <CardBody className="space-y-6">
          <Podium entries={finalBoard} />
          <Leaderboard entries={finalBoard} limit={50} />
        </CardBody>
      </Card>
      <Card>
        <CardHeader
          eyebrow="Results"
          title="Question breakdown"
          actions={
            <ButtonLink variant="secondary" size="sm" href={`/teacher/lessons/${lessonId}/analytics`}>
              Lesson analytics
            </ButtonLink>
          }
        />
        <CardBody className="p-0 pb-2">
          {results.isPending ? (
            <LoadingBlock label="Loading results…" />
          ) : results.isError ? (
            <ErrorState error={results.error} onRetry={() => results.refetch()} />
          ) : (
            <Table>
              <THead>
                <tr>
                  <TH>#</TH>
                  <TH>Question</TH>
                  <TH className="text-right">Answers</TH>
                  <TH className="text-right">Correct</TH>
                </tr>
              </THead>
              <TBody>
                {results.data.questions.map((q, i) => {
                  const total = q.distribution.reduce((a, b) => a + b, 0);
                  const correct = q.distribution[q.correctIndex] ?? 0;
                  return (
                    <TR key={q.questionId}>
                      <TD className="font-bold">{i + 1}</TD>
                      <TD>{q.stem}</TD>
                      <TD className="text-right tabular-nums">{total}</TD>
                      <TD className="text-right font-bold tabular-nums">
                        {total ? `${Math.round((correct / total) * 100)}%` : '—'}
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
