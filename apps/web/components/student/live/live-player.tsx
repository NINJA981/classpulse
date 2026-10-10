'use client';
import { useEffect, useReducer, useRef, useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import clsx from 'clsx';
import { CheckCircle2, Clock, Home, LogOut, PartyPopper, Radio, Trophy, Users, WifiOff, XCircle } from 'lucide-react';
import {
  LIVE_PIN_PATTERN,
  type LivePinLookup,
  type LiveStateSnapshot,
  type PublicQuestion,
} from '@classpulse/shared';
import { Button, ButtonLink, Card, CardBody, Field, InlineError, Input, Spinner } from '@/components/ui';
import { ApiError, api, errorMessage } from '@/lib/api';
import { connectSocket, emitWithAck, type ClassPulseSocket } from '@/lib/socket';
import { useSessionUser } from '@/lib/session-context';
import { LanguageToggle, Note } from '../common';
import { OPTION_LETTERS, OptionButton, OptionGroup } from '../quiz/option-button';
import { CountdownBar, useCountdown } from './countdown';
import { Leaderboard, Podium } from './leaderboard';
import { initialLiveState, liveReducer, type LiveGameState } from './live-state';

type Connection = 'connecting' | 'connected' | 'reconnecting';

function lookupErrorText(err: unknown): string {
  if (err instanceof ApiError && err.status === 404) return 'No live quiz found with that PIN. Check the PIN on your teacher’s screen.';
  return errorMessage(err);
}

/* -------------------------------------------------------------------------- */
/* PIN entry                                                                   */
/* -------------------------------------------------------------------------- */

function PinForm({
  initialPin,
  error,
  onJoin,
}: {
  initialPin: string;
  error: string | null;
  onJoin: (lookup: LivePinLookup, pin: string) => void;
}) {
  const [pin, setPin] = useState(() => initialPin.replace(/\D/g, '').slice(0, 6));
  const [localError, setLocalError] = useState<string | null>(null);
  const lookup = useMutation({
    mutationFn: (p: string) => api.get<LivePinLookup>(`/live-sessions/pin/${p}`),
    onSuccess: (data, p) => {
      if (data.status === 'ended') {
        setLocalError('This live quiz has already ended.');
        return;
      }
      onJoin(data, p);
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLocalError(null);
    if (!LIVE_PIN_PATTERN.test(pin)) {
      setLocalError('Enter the 6-digit game PIN.');
      return;
    }
    lookup.mutate(pin);
  }

  const shownError = localError ?? (lookup.isError ? lookupErrorText(lookup.error) : error);

  return (
    <Card>
      <CardBody>
        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <div className="flex items-center gap-3">
            <span className="grid size-12 shrink-0 place-items-center rounded-full border-2 border-line-strong bg-accent" aria-hidden>
              <Radio className="size-6" />
            </span>
            <p className="text-sm text-ink-2">Enter the PIN shown on your teacher’s screen to join the game.</p>
          </div>
          <Field label="Game PIN" error={shownError}>
            {(p) => (
              <Input
                {...p}
                value={pin}
                onChange={(e) => {
                  setPin(e.target.value.replace(/\D/g, '').slice(0, 6));
                  setLocalError(null);
                  lookup.reset();
                }}
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="off"
                maxLength={6}
                placeholder="123456"
                className="h-16 text-center font-display text-3xl font-black tracking-[0.35em]"
              />
            )}
          </Field>
          <Button type="submit" size="lg" className="w-full" loading={lookup.isPending} disabled={pin.length !== 6}>
            Join game
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* Screens                                                                     */
/* -------------------------------------------------------------------------- */

function GameHeader({ state }: { state: LiveGameState }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="eyebrow">Live quiz</p>
        <p className="truncate font-display text-lg font-black">{state.title || 'Live quiz'}</p>
      </div>
      <div className="shrink-0 rounded-control border-2 border-line-strong bg-surface px-3 py-1 text-right">
        <p className="text-[10px] font-extrabold uppercase tracking-wide text-muted">Score</p>
        <p className="font-display text-lg font-black tabular-nums">{state.myScore}</p>
      </div>
    </div>
  );
}

function Lobby({ state }: { state: LiveGameState }) {
  return (
    <Card className="bg-accent-soft">
      <CardBody className="flex flex-col items-center gap-3 py-10 text-center">
        <span className="relative grid size-16 place-items-center rounded-full border-2 border-line-strong bg-accent" aria-hidden>
          <PartyPopper className="size-8" />
          <span className="absolute inset-0 animate-ping rounded-full border-2 border-line-strong opacity-30" />
        </span>
        <h2 className="font-display text-2xl font-black">You’re in!</h2>
        <p className="text-ink-2" role="status">
          Waiting for your teacher to start…
        </p>
        <p className="inline-flex items-center gap-1.5 text-sm font-bold">
          <Users className="size-4" aria-hidden />
          {state.participantCount} {state.participantCount === 1 ? 'player' : 'players'} joined
        </p>
        {state.questionCount > 0 && (
          <p className="text-xs text-muted">
            {state.questionCount} {state.questionCount === 1 ? 'question' : 'questions'}
          </p>
        )}
      </CardBody>
    </Card>
  );
}

function QuestionScreen({
  question,
  state,
  connected,
  local,
  answerPending,
  answerError,
  onAnswer,
}: {
  question: PublicQuestion;
  state: LiveGameState;
  connected: boolean;
  local: boolean;
  answerPending: boolean;
  answerError: string | null;
  onAnswer: (index: number) => void;
}) {
  const remaining = useCountdown(question.closesAt, state.offset);
  const timeUp = remaining <= 0;
  const stem = local && question.stemLocal ? question.stemLocal : question.stem;
  const saved = state.savedAnswer != null && state.savedAnswer === state.myAnswer;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-bold">
          Question {question.index + 1} of {question.total}
        </p>
        <CountdownBar remainingMs={remaining} totalMs={question.closesAt - question.openedAt} />
      </div>

      <Card>
        <CardBody className="flex flex-col gap-5">
          <h2 className="font-display text-xl font-extrabold leading-snug">{stem}</h2>
          <OptionGroup label={`Answer options for question ${question.index + 1}`}>
            {question.options.map((opt, i) => {
              const text = local && question.optionsLocal?.[i] ? question.optionsLocal[i]! : opt;
              return (
                <OptionButton
                  key={i}
                  index={i}
                  text={text}
                  checked={state.myAnswer === i}
                  disabled={timeUp || !connected}
                  onSelect={() => onAnswer(i)}
                />
              );
            })}
          </OptionGroup>
        </CardBody>
      </Card>

      <div aria-live="polite" className="min-h-6">
        {timeUp ? (
          <Note tone="warning" icon={<Clock className="size-4 text-warning" aria-hidden />}>
            <p className="font-semibold">Time’s up! Waiting for the answer…</p>
          </Note>
        ) : answerError ? (
          <InlineError error={new Error(answerError)} />
        ) : answerPending ? (
          <p className="inline-flex items-center gap-2 text-sm text-muted">
            <Spinner className="size-4" label="Saving answer" /> Saving your answer…
          </p>
        ) : saved ? (
          <Note tone="success" icon={<CheckCircle2 className="size-4 text-success" aria-hidden />}>
            <p className="font-semibold">Answer saved — you can change it until time runs out</p>
          </Note>
        ) : (
          <p className="text-sm text-muted">Tap an answer. You can change it until the timer ends.</p>
        )}
      </div>
    </div>
  );
}

function RevealScreen({ state, meId, local }: { state: LiveGameState; meId: string; local: boolean }) {
  const { closed, result, question } = state;
  const sameQuestion = question && closed && question.questionId === closed.questionId;
  const explanation = closed ? (local && closed.explanationLocal ? closed.explanationLocal : closed.explanation) : null;

  return (
    <div className="flex flex-col gap-4">
      {result ? (
        <Card className={clsx('border-2', result.isCorrect ? 'border-success bg-success-soft' : 'border-danger bg-danger-soft')}>
          <CardBody className="flex items-center gap-4" role="status">
            {result.isCorrect ? (
              <CheckCircle2 className="size-10 shrink-0 text-success" aria-hidden />
            ) : (
              <XCircle className="size-10 shrink-0 text-danger" aria-hidden />
            )}
            <div className="min-w-0 flex-1">
              <p className="font-display text-2xl font-black">
                {result.isCorrect ? 'Correct!' : result.selectedIndex == null ? 'No answer' : 'Not quite'}
              </p>
              <p className="text-sm font-semibold">
                {result.isCorrect ? `+${result.pointsAwarded} points` : result.selectedIndex == null ? 'Time ran out.' : 'No points this time.'}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-xs font-bold text-ink-2">Rank</p>
              <p className="font-display text-2xl font-black">#{result.rank}</p>
            </div>
          </CardBody>
        </Card>
      ) : (
        <Card>
          <CardBody className="flex items-center gap-3 text-sm" role="status">
            <Clock className="size-5 shrink-0" aria-hidden />
            {state.myAnswer == null ? 'Time’s up! You didn’t answer this one.' : 'Time’s up! Checking your answer…'}
          </CardBody>
        </Card>
      )}

      {closed && (
        <Card>
          <CardBody className="flex flex-col gap-3">
            <p className="eyebrow">Question {closed.index + 1} · Answer</p>
            {sameQuestion ? (
              <>
                <h2 className="font-bold leading-snug">{local && question.stemLocal ? question.stemLocal : question.stem}</h2>
                <ul className="flex flex-col gap-2">
                  {question.options.map((opt, i) => {
                    const text = local && question.optionsLocal?.[i] ? question.optionsLocal[i]! : opt;
                    const correct = i === closed.correctIndex;
                    const mine = i === (result?.selectedIndex ?? state.myAnswer);
                    return (
                      <li
                        key={i}
                        className={clsx(
                          'flex min-h-12 items-center gap-3 rounded-control border-2 px-3 py-2 text-sm font-semibold',
                          correct ? 'border-success bg-success-soft' : mine ? 'border-danger bg-danger-soft' : 'border-line bg-surface text-muted',
                        )}
                      >
                        <span aria-hidden className="font-display font-black">
                          {OPTION_LETTERS[i]}
                        </span>
                        <span className="min-w-0 flex-1">{text}</span>
                        {correct && <span className="text-xs font-extrabold text-success">Correct answer</span>}
                        {mine && !correct && <span className="text-xs font-extrabold text-danger">Your answer</span>}
                      </li>
                    );
                  })}
                </ul>
              </>
            ) : (
              <p className="font-semibold">Correct answer: {OPTION_LETTERS[closed.correctIndex]}</p>
            )}
            {explanation && (
              <div className="rounded-control bg-info-soft px-3 py-2 text-sm leading-relaxed">
                <p className="text-xs font-bold text-ink-2">Explanation</p>
                <p>{explanation}</p>
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {state.leaderboard.length > 0 && (
        <Card>
          <CardBody className="flex flex-col gap-3">
            <h2 className="inline-flex items-center gap-2 font-display text-lg font-extrabold">
              <Trophy className="size-5" aria-hidden /> Leaderboard
            </h2>
            <Leaderboard entries={state.leaderboard} meId={meId} />
          </CardBody>
        </Card>
      )}

      <p className="flex items-center justify-center gap-2 text-sm text-muted" role="status">
        <Spinner className="size-4" label="Waiting" /> Waiting for the next question…
      </p>
    </div>
  );
}

function EndScreen({ state, meId }: { state: LiveGameState; meId: string }) {
  const board = state.finalLeaderboard ?? state.leaderboard;
  const me = board.find((e) => e.studentId === meId);
  return (
    <div className="flex flex-col gap-4">
      <Card className="bg-accent-soft">
        <CardBody className="flex flex-col items-center gap-2 text-center">
          <Trophy className="size-10" aria-hidden />
          <h2 className="font-display text-2xl font-black">Quiz finished!</h2>
          {me ? (
            <p className="text-lg font-bold">
              You came #{me.rank} with {me.score} points
            </p>
          ) : (
            <p className="text-lg font-bold">Your score: {state.myScore} points</p>
          )}
          {me && (
            <p className="text-sm text-ink-2">
              {me.correct} correct {me.correct === 1 ? 'answer' : 'answers'}
            </p>
          )}
        </CardBody>
      </Card>
      {board.length > 0 && (
        <Card>
          <CardBody className="flex flex-col gap-5">
            <Podium entries={board} meId={meId} />
            <Leaderboard entries={board} meId={meId} top={10} />
          </CardBody>
        </Card>
      )}
      <ButtonLink href="/student" size="lg" icon={<Home className="size-5" aria-hidden />}>
        Back to home
      </ButtonLink>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Player                                                                      */
/* -------------------------------------------------------------------------- */

export function LivePlayer({ initialPin }: { initialPin: string }) {
  const user = useSessionUser();
  const [activePin, setActivePin] = useState<string | null>(null);
  const [pinError, setPinError] = useState<string | null>(null);
  const [state, dispatch] = useReducer(liveReducer, undefined, () => initialLiveState());
  const [conn, setConn] = useState<Connection>('connecting');
  const [gameError, setGameError] = useState<string | null>(null);
  const [answerPending, setAnswerPending] = useState(false);
  const [answerError, setAnswerError] = useState<string | null>(null);
  const [local, setLocal] = useState(false);

  const socketRef = useRef<ClassPulseSocket | null>(null);
  const answerSeq = useRef(0);
  const endedRef = useRef(false);
  useEffect(() => {
    endedRef.current = state.phase === 'ended';
  }, [state.phase]);

  useEffect(() => {
    if (!activePin) return;
    const socket = connectSocket();
    socketRef.current = socket;
    let disposed = false;
    let joined = false;

    const join = () => {
      emitWithAck<LiveStateSnapshot>(socket, (ack) => socket.emit('player:join', { pin: activePin }, ack))
        .then((snap) => {
          if (disposed) return;
          joined = true;
          dispatch({ type: 'snapshot', snap, now: Date.now() });
          setConn('connected');
          setGameError(null);
        })
        .catch((err: unknown) => {
          if (disposed) return;
          if (!joined) {
            // First join failed (e.g. not enrolled, quiz ended): back to the PIN form.
            setPinError(errorMessage(err));
            setActivePin(null);
          } else {
            setConn('connected');
            setGameError(errorMessage(err));
          }
        });
    };

    socket.on('connect', join);
    socket.on('disconnect', (reason) => {
      if (disposed || endedRef.current) return;
      setConn('reconnecting');
      // A server-side disconnect is not retried automatically by socket.io.
      if (reason === 'io server disconnect') socket.connect();
    });
    socket.on('connect_error', () => {
      if (disposed) return;
      setConn(joined ? 'reconnecting' : 'connecting');
    });
    socket.on('live:state', (snap) => dispatch({ type: 'snapshot', snap, now: Date.now() }));
    socket.on('question:open', (question) => {
      answerSeq.current += 1;
      setAnswerPending(false);
      setAnswerError(null);
      dispatch({ type: 'open', question });
    });
    socket.on('question:closed', (payload) => {
      answerSeq.current += 1;
      setAnswerPending(false);
      dispatch({ type: 'closed', payload });
    });
    socket.on('player:result', (payload) => dispatch({ type: 'result', payload }));
    socket.on('live:leaderboard', (entries) => dispatch({ type: 'leaderboard', entries }));
    socket.on('live:ended', ({ leaderboard }) => {
      endedRef.current = true;
      dispatch({ type: 'ended', leaderboard });
    });

    return () => {
      disposed = true;
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [activePin]);

  function start(lookup: LivePinLookup, pin: string) {
    setPinError(null);
    setGameError(null);
    setConn('connecting');
    dispatch({ type: 'reset', title: lookup.title });
    setActivePin(pin);
  }

  function leave() {
    setActivePin(null);
    setPinError(null);
  }

  function answer(index: number) {
    const socket = socketRef.current;
    const q = state.question;
    if (!socket || !q || conn !== 'connected') return;
    dispatch({ type: 'select', index });
    setAnswerError(null);
    setAnswerPending(true);
    const seq = ++answerSeq.current;
    emitWithAck<{ questionId: string; optionIndex: number; revision: number }>(socket, (ack) =>
      socket.emit('player:answer', { questionId: q.questionId, optionIndex: index }, ack),
    )
      .then((d) => {
        if (seq !== answerSeq.current) return;
        setAnswerPending(false);
        dispatch({ type: 'saved', questionId: d.questionId, index: d.optionIndex });
      })
      .catch((err: unknown) => {
        if (seq !== answerSeq.current) return;
        setAnswerPending(false);
        setAnswerError(errorMessage(err));
      });
  }

  if (!activePin) {
    return <PinForm initialPin={initialPin} error={pinError} onJoin={start} />;
  }

  const hasLocal = Boolean(state.question && (state.question.stemLocal || state.question.optionsLocal));

  return (
    <div className="flex flex-col gap-4">
      {conn === 'reconnecting' && (
        <div
          role="status"
          className="sticky top-16 z-20 flex items-center gap-2 rounded-control border-2 border-warning bg-warning-soft px-4 py-3 text-sm font-bold text-warning lg:top-2"
        >
          <WifiOff className="size-4 shrink-0" aria-hidden />
          Reconnecting… your answers are safe.
        </div>
      )}

      <GameHeader state={state} />
      {gameError && <InlineError error={new Error(gameError)} />}

      {(state.phase === 'question' || state.phase === 'closed') && hasLocal && (
        <div className="flex justify-end">
          <LanguageToggle local={local} onChange={setLocal} />
        </div>
      )}

      {state.phase === 'connecting' ? (
        <Card>
          <CardBody className="flex flex-col items-center gap-3 py-10 text-center" role="status">
            <Spinner className="size-6" label="Joining" />
            <p className="font-bold">Joining the game…</p>
            {conn === 'connecting' && <p className="text-sm text-muted">Connecting to the classroom server.</p>}
          </CardBody>
        </Card>
      ) : state.phase === 'lobby' ? (
        <Lobby state={state} />
      ) : state.phase === 'question' && state.question ? (
        <QuestionScreen
          key={state.question.questionId}
          question={state.question}
          state={state}
          connected={conn === 'connected'}
          local={local}
          answerPending={answerPending}
          answerError={answerError}
          onAnswer={answer}
        />
      ) : state.phase === 'ended' ? (
        <EndScreen state={state} meId={user.id} />
      ) : (
        <RevealScreen state={state} meId={user.id} local={local} />
      )}

      {state.phase !== 'ended' && (
        <Button variant="ghost" size="lg" onClick={leave} icon={<LogOut className="size-5" aria-hidden />}>
          Leave game
        </Button>
      )}
    </div>
  );
}
