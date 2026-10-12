/**
 * Live quiz engine (Socket.IO). Implements ClientToServerEvents /
 * ServerToClientEvents from @classpulse/shared.
 *
 * - Identity only from socket.data.user (the session cookie). Payloads never carry a studentId.
 * - State machine: lobby → question_open → question_closed → … → ended.
 * - Server-owned timing: the open/close timestamps live in Postgres and a server
 *   timer auto-closes each question. Late answers are rejected.
 * - The answer key goes only to host sockets until the question closes.
 * - Every transition/answer is persisted first; the in-memory room is a cache that
 *   can be rebuilt from the database (e.g. after a restart).
 * - All operations on one session are serialized through a per-room promise chain.
 *
 * Socket rooms: `live:<id>` (everyone), `live:<id>:hosts`, `live:<id>:players`,
 * `live:<id>:p:<participantId>` (one player's sockets).
 *
 * Scale-out note: this is single-instance by design for the pilot. Running more
 * than one API instance needs @socket.io/redis-adapter plus sticky sessions and
 * a session-ownership lock so only one instance runs a session's timers.
 */
import { ZodError } from 'zod';
import {
  HostJoinPayload,
  PlayerAnswerPayload,
  PlayerJoinPayload,
  type Ack,
  type ErrorCode,
  type HostQuestion,
  type LeaderboardEntry,
  type LiveStateSnapshot,
  type LiveStatus,
  type ParticipantInfo,
  type PlayerResultPayload,
  type PublicQuestion,
  type QuestionClosedPayload,
} from '@classpulse/shared';
import { AppError, forbidden, invalidState, notFound } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { assertNotInMaintenance, assertSchoolActive } from '../lib/platformState.js';
import {
  ensureParticipant,
  findActiveSessionIdByPin,
  isEnrolled,
  loadLiveSession,
  persistAnswer,
  persistCloseQuestion,
  persistEnd,
  persistOpenQuestion,
  rankLeaderboard,
  type CloseOutcome,
  type LiveQuestion,
  type LoadedLiveSession,
} from '../modules/live/service.js';
import type { AppServer, AppSocket } from './types.js';

export const LEADERBOARD_SIZE = 10;

interface RoomParticipant {
  id: string;
  studentId: string;
  name: string;
  score: number;
  correct: number;
  connections: number;
}

interface LiveRoom {
  id: string;
  pin: string;
  title: string;
  sectionId: string;
  hostTeacherId: string;
  timeLimitSec: number;
  status: LiveStatus;
  currentIndex: number | null;
  openedAt: Date | null;
  closesAt: Date | null;
  questions: LiveQuestion[];
  participants: Map<string, RoomParticipant>;
  /** participantId → selected option for the open question. */
  answers: Map<string, number>;
  /** Results of the most recently closed question, replayed to sockets that (re)join. */
  lastClosed: QuestionClosedPayload | null;
  lastResults: Map<string, PlayerResultPayload>;
  timer: NodeJS.Timeout | null;
  chain: Promise<void>;
}

type HostAction = 'start' | 'next' | 'close' | 'end';

/** A join result: the ack payload plus events to send to the joining socket after the ack. */
interface JoinResult {
  snapshot: LiveStateSnapshot;
  replay: () => void;
}

const rooms = {
  all: (id: string) => `live:${id}`,
  hosts: (id: string) => `live:${id}:hosts`,
  players: (id: string) => `live:${id}:players`,
  player: (id: string, participantId: string) => `live:${id}:p:${participantId}`,
};

/**
 * The platform may suspend the school, switch live quizzes off or block sign-ins for maintenance
 * at any time: checked on every live-quiz action (the platform state is cached for 30 s).
 */
async function assertLiveQuizAllowed(socket: AppSocket): Promise<void> {
  await assertNotInMaintenance();
  const state = await assertSchoolActive(socket.data.user.institutionId);
  if (!state.features.liveQuiz) throw new AppError('FEATURE_DISABLED', 'Live quiz is switched off for your school.');
}

function toAckError(err: unknown): { code: ErrorCode; message: string } {
  if (err instanceof AppError) return { code: err.code, message: err.message };
  if (err instanceof ZodError) return { code: 'VALIDATION_FAILED', message: 'Invalid request payload' };
  logger.error({ err }, 'Live quiz handler failed');
  return { code: 'INTERNAL', message: 'Something went wrong. Please try again.' };
}

export class LiveQuizEngine {
  private readonly cache = new Map<string, LiveRoom>();
  private readonly loading = new Map<string, Promise<LiveRoom | null>>();
  private closed = false;

  constructor(private readonly io: AppServer) {}

  /** Wire the live-quiz events for one authenticated socket. */
  register(socket: AppSocket): void {
    socket.on('host:join', (payload, ack) => this.handleJoin(ack, () => this.hostJoin(socket, payload)));
    socket.on('host:start', (ack) => this.handle(ack, () => this.hostAction(socket, 'start')));
    socket.on('host:next', (ack) => this.handle(ack, () => this.hostAction(socket, 'next')));
    socket.on('host:close_question', (ack) => this.handle(ack, () => this.hostAction(socket, 'close')));
    socket.on('host:end', (ack) => this.handle(ack, () => this.hostAction(socket, 'end')));
    socket.on('player:join', (payload, ack) => this.handleJoin(ack, () => this.playerJoin(socket, payload)));
    socket.on('player:answer', (payload, ack) => {
      const receivedAt = new Date(); // server time of receipt is the answer time
      this.handle(ack, () => this.answer(socket, payload, receivedAt));
    });
    socket.on('disconnect', () => {
      this.leave(socket).catch((err: unknown) => logger.warn({ err }, 'Live quiz leave failed'));
    });
  }

  /** Stop all timers and drop the cache (server shutdown). State is already persisted. */
  close(): void {
    this.closed = true;
    for (const room of this.cache.values()) if (room.timer) clearTimeout(room.timer);
    this.cache.clear();
  }

  /* --------------------------------------------------------------------------
   * Event handlers
   * ----------------------------------------------------------------------- */

  private handle<T>(ack: unknown, fn: () => Promise<T>): void {
    if (typeof ack !== 'function') return; // every event requires an ack callback
    const reply = ack as (res: Ack<T>) => void;
    fn().then(
      (data) => reply({ ok: true, data }),
      (err: unknown) => reply({ ok: false, error: toAckError(err) }),
    );
  }

  /** Like handle(), but sends the join's replay events to the socket right after the ack. */
  private handleJoin(ack: unknown, fn: () => Promise<JoinResult>): void {
    if (typeof ack !== 'function') return;
    const reply = ack as (res: Ack<LiveStateSnapshot>) => void;
    fn().then(
      (result) => {
        reply({ ok: true, data: result.snapshot });
        result.replay();
      },
      (err: unknown) => reply({ ok: false, error: toAckError(err) }),
    );
  }

  private async hostJoin(socket: AppSocket, raw: unknown): Promise<JoinResult> {
    const user = socket.data.user;
    if (user.role !== 'teacher') throw forbidden('Only the lesson teacher can host a live quiz');
    const { sessionId } = HostJoinPayload.parse(raw);
    await assertLiveQuizAllowed(socket);
    const room = await this.getRoom(sessionId);
    if (!room || room.hostTeacherId !== user.id) throw notFound('Live session');
    await this.leave(socket);
    return this.run(room, async () => {
      await socket.join([rooms.all(room.id), rooms.hosts(room.id)]);
      socket.data.live = { sessionId: room.id, role: 'host', participantId: null };
      logger.info({ sessionId: room.id }, 'Live host joined');
      const snapshot = this.snapshot(room, null);
      const participants = this.participantList(room);
      const replay = this.replayFor(socket, room, null);
      return {
        snapshot,
        replay: () => {
          socket.emit('live:participants', participants);
          replay();
        },
      };
    });
  }

  private async playerJoin(socket: AppSocket, raw: unknown): Promise<JoinResult> {
    const user = socket.data.user;
    if (user.role !== 'student') throw forbidden('Only students can join a live quiz');
    const { pin } = PlayerJoinPayload.parse(raw);
    await assertLiveQuizAllowed(socket);
    const sessionId = await findActiveSessionIdByPin(pin);
    const room = sessionId ? await this.getRoom(sessionId) : null;
    if (!room || room.status === 'ended' || !(await isEnrolled(user.id, room.sectionId))) {
      throw notFound('Live quiz');
    }
    await this.leave(socket);
    return this.run(room, async () => {
      if (room.status === 'ended') throw notFound('Live quiz');
      const row = await ensureParticipant(room.id, user.id);
      let participant = room.participants.get(row.id);
      if (!participant) {
        participant = { ...row, connections: 0 };
        room.participants.set(row.id, participant);
      }
      participant.connections++;
      await socket.join([rooms.all(room.id), rooms.players(room.id), rooms.player(room.id, participant.id)]);
      socket.data.live = { sessionId: room.id, role: 'player', participantId: participant.id };
      this.emitParticipants(room);
      logger.info({ sessionId: room.id, participantId: participant.id }, 'Live player joined');
      return { snapshot: this.snapshot(room, participant), replay: this.replayFor(socket, room, participant.id) };
    });
  }

  private async hostAction(socket: AppSocket, action: HostAction): Promise<undefined> {
    const membership = socket.data.live;
    if (!membership || membership.role !== 'host') throw forbidden('Join the session as host first');
    await assertLiveQuizAllowed(socket);
    const room = await this.getRoom(membership.sessionId);
    if (!room || room.hostTeacherId !== socket.data.user.id) throw notFound('Live session');
    await this.run(room, async () => {
      switch (action) {
        case 'start':
          if (room.status !== 'lobby') throw invalidState('The quiz has already started');
          if (!room.questions.length) throw invalidState('This quiz has no approved questions');
          await this.openQuestion(room, 0, 'lobby');
          return;
        case 'next': {
          if (room.status !== 'question_closed') throw invalidState('Close the current question first');
          const nextIndex = (room.currentIndex ?? -1) + 1;
          if (nextIndex < room.questions.length) await this.openQuestion(room, nextIndex, 'question_closed');
          else await this.endSession(room);
          return;
        }
        case 'close':
          if (room.status !== 'question_open') throw invalidState('No question is open');
          await this.closeQuestion(room);
          return;
        case 'end':
          if (room.status === 'ended') return; // idempotent
          if (room.status === 'question_open') await this.closeQuestion(room);
          await this.endSession(room);
          return;
      }
    });
    return undefined;
  }

  private async answer(
    socket: AppSocket,
    raw: unknown,
    receivedAt: Date,
  ): Promise<{ questionId: string; optionIndex: number; revision: number }> {
    const membership = socket.data.live;
    if (!membership || membership.role !== 'player' || !membership.participantId) {
      throw forbidden('Join the quiz before answering');
    }
    const { questionId, optionIndex } = PlayerAnswerPayload.parse(raw);
    await assertLiveQuizAllowed(socket);
    const participantId = membership.participantId;
    const room = await this.getRoom(membership.sessionId);
    if (!room) throw notFound('Live quiz');
    return this.run(room, async () => {
      const question = room.currentIndex !== null ? room.questions[room.currentIndex] : undefined;
      if (room.status !== 'question_open' || !question || question.id !== questionId) {
        throw invalidState('This question is no longer open');
      }
      if (!room.closesAt || receivedAt.getTime() > room.closesAt.getTime()) throw invalidState("Time's up for this question");
      if (optionIndex >= question.options.length) throw new AppError('VALIDATION_FAILED', 'Invalid option');
      if (!room.participants.has(participantId)) throw forbidden('Join the quiz before answering');

      const revision = await persistAnswer(participantId, questionId, optionIndex, receivedAt);
      room.answers.set(participantId, optionIndex);
      this.io.to(rooms.hosts(room.id)).emit('question:progress', {
        questionId,
        answeredCount: room.answers.size,
        participantCount: room.participants.size,
      });
      return { questionId, optionIndex, revision };
    });
  }

  private async leave(socket: AppSocket): Promise<void> {
    const membership = socket.data.live;
    if (!membership) return;
    socket.data.live = null;
    const id = membership.sessionId;
    const names = [rooms.all(id), rooms.hosts(id), rooms.players(id)];
    if (membership.participantId) names.push(rooms.player(id, membership.participantId));
    for (const name of names) await socket.leave(name);
    const room = this.cache.get(id);
    if (!room || membership.role !== 'player' || !membership.participantId) return;
    const participantId = membership.participantId;
    await this.run(room, async () => {
      const p = room.participants.get(participantId);
      if (p) p.connections = Math.max(0, p.connections - 1);
      this.emitParticipants(room);
    });
  }

  /* --------------------------------------------------------------------------
   * Transitions (always called inside run())
   * ----------------------------------------------------------------------- */

  private async openQuestion(room: LiveRoom, index: number, from: LiveStatus): Promise<void> {
    const openedAt = new Date();
    const closesAt = new Date(openedAt.getTime() + room.timeLimitSec * 1000);
    if (!(await persistOpenQuestion(room.id, from, index, openedAt, closesAt))) {
      this.evict(room);
      throw invalidState('The session changed; please rejoin');
    }
    room.status = 'question_open';
    room.currentIndex = index;
    room.openedAt = openedAt;
    room.closesAt = closesAt;
    room.answers.clear();
    room.lastClosed = null;
    room.lastResults = new Map();
    this.armTimer(room);

    this.emitState(room);
    this.io.to(rooms.players(room.id)).emit('question:open', this.publicQuestion(room));
    this.io.to(rooms.hosts(room.id)).emit('question:host_open', this.hostQuestion(room));
    logger.info({ sessionId: room.id, index }, 'Live question opened');
  }

  private async closeQuestion(room: LiveRoom): Promise<void> {
    this.clearTimer(room);
    const index = room.currentIndex!;
    const question = room.questions[index]!;
    const outcome = await persistCloseQuestion(room.id, index, question, room.openedAt!, room.closesAt!);
    if (!outcome) {
      this.evict(room);
      throw invalidState('The session changed; please rejoin');
    }
    room.status = 'question_closed';
    for (const p of outcome.participants) {
      const cached = room.participants.get(p.id);
      if (cached) {
        cached.score = p.score;
        cached.correct = p.correct;
      }
    }
    room.answers.clear();

    const closed = this.recordCloseResults(room, index, question, outcome.answers);
    this.io.to(rooms.all(room.id)).emit('question:closed', closed);
    for (const [participantId, result] of room.lastResults) {
      this.io.to(rooms.player(room.id, participantId)).emit('player:result', result);
    }
    this.io.to(rooms.all(room.id)).emit('live:leaderboard', this.leaderboard(room).slice(0, LEADERBOARD_SIZE));
    this.emitState(room);
    logger.info({ sessionId: room.id, index, answered: outcome.answers.length }, 'Live question closed');
  }

  private async endSession(room: LiveRoom): Promise<void> {
    this.clearTimer(room);
    await persistEnd(room.id);
    room.status = 'ended';
    room.closesAt = null;
    room.answers.clear();
    this.io.to(rooms.all(room.id)).emit('live:ended', { leaderboard: this.leaderboard(room).slice(0, LEADERBOARD_SIZE) });
    this.emitState(room);
    this.evict(room);
    logger.info({ sessionId: room.id, participants: room.participants.size }, 'Live session ended');
  }

  /* --------------------------------------------------------------------------
   * Cache
   * ----------------------------------------------------------------------- */

  private run<T>(room: LiveRoom, fn: () => Promise<T>): Promise<T> {
    const result = room.chain.then(fn);
    room.chain = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  /** Cached room, or rebuilt from Postgres. Ended sessions are returned but never cached. */
  private async getRoom(sessionId: string): Promise<LiveRoom | null> {
    const cached = this.cache.get(sessionId);
    if (cached) return cached;
    let pending = this.loading.get(sessionId);
    if (!pending) {
      pending = loadLiveSession(sessionId)
        .then((loaded) => (loaded ? this.adopt(loaded) : null))
        .finally(() => this.loading.delete(sessionId));
      this.loading.set(sessionId, pending);
    }
    return pending;
  }

  private adopt(loaded: LoadedLiveSession): LiveRoom {
    const s = loaded.session;
    const room: LiveRoom = {
      id: s.id,
      pin: s.pin,
      title: loaded.lesson.title,
      sectionId: loaded.lesson.sectionId,
      hostTeacherId: s.hostTeacherId,
      timeLimitSec: s.timeLimitSec,
      status: s.status,
      currentIndex: s.currentQuestionIndex,
      openedAt: s.questionOpenedAt,
      closesAt: s.questionClosesAt,
      questions: loaded.questions,
      participants: new Map(loaded.participants.map((p) => [p.id, { ...p, connections: 0 }])),
      answers: new Map(loaded.currentAnswers.map((a) => [a.participantId, a.selectedIndex])),
      lastClosed: null,
      lastResults: new Map(),
      timer: null,
      chain: Promise.resolve(),
    };
    const closedQuestion = room.currentIndex !== null ? room.questions[room.currentIndex] : undefined;
    if (room.status === 'question_closed' && closedQuestion) {
      this.recordCloseResults(room, room.currentIndex!, closedQuestion, loaded.closedAnswers);
    }
    if (room.status === 'ended' || this.closed) return room;

    // A question index that no longer exists (questions edited mid-session) can't be resumed.
    if (room.status === 'question_open' && (room.currentIndex === null || !room.questions[room.currentIndex] || !room.openedAt || !room.closesAt)) {
      room.status = 'question_closed';
    }
    this.cache.set(room.id, room);
    if (room.status === 'question_open') {
      if (room.closesAt!.getTime() <= Date.now()) {
        this.run(room, () => this.closeIfOpen(room, room.currentIndex!)).catch((err: unknown) =>
          logger.error({ err, sessionId: room.id }, 'Failed to close an expired live question'),
        );
      } else {
        this.armTimer(room);
      }
    }
    logger.info({ sessionId: room.id, status: room.status }, 'Live session loaded');
    return room;
  }

  private evict(room: LiveRoom): void {
    this.clearTimer(room);
    if (this.cache.get(room.id) === room) this.cache.delete(room.id);
  }

  private armTimer(room: LiveRoom): void {
    this.clearTimer(room);
    if (this.closed || !room.closesAt || room.currentIndex === null) return;
    const index = room.currentIndex;
    const delay = Math.max(0, room.closesAt.getTime() - Date.now());
    room.timer = setTimeout(() => {
      room.timer = null;
      this.run(room, () => this.closeIfOpen(room, index)).catch((err: unknown) =>
        logger.error({ err, sessionId: room.id }, 'Live question auto-close failed'),
      );
    }, delay);
    room.timer.unref();
  }

  private async closeIfOpen(room: LiveRoom, index: number): Promise<void> {
    if (room.status === 'question_open' && room.currentIndex === index) await this.closeQuestion(room);
  }

  private clearTimer(room: LiveRoom): void {
    if (room.timer) clearTimeout(room.timer);
    room.timer = null;
  }

  /** Build (and remember) the question:closed payload and each participant's player:result. */
  private recordCloseResults(
    room: LiveRoom,
    index: number,
    question: LiveQuestion,
    answers: CloseOutcome['answers'],
  ): QuestionClosedPayload {
    const distribution = question.options.map(() => 0);
    for (const a of answers) {
      if (a.selectedIndex >= 0 && a.selectedIndex < distribution.length) distribution[a.selectedIndex]!++;
    }
    const closed: QuestionClosedPayload = {
      questionId: question.id,
      index,
      correctIndex: question.correctIndex,
      explanation: question.explanation,
      explanationLocal: question.explanationLocal,
      distribution,
      answeredCount: answers.length,
    };
    const byParticipant = new Map(answers.map((a) => [a.participantId, a]));
    const leaderboard = this.leaderboard(room);
    const rankOf = new Map(leaderboard.map((e) => [e.participantId, e.rank]));
    room.lastClosed = closed;
    room.lastResults = new Map();
    for (const p of room.participants.values()) {
      const a = byParticipant.get(p.id);
      room.lastResults.set(p.id, {
        questionId: question.id,
        selectedIndex: a?.selectedIndex ?? null,
        isCorrect: a?.isCorrect ?? false,
        pointsAwarded: a?.pointsAwarded ?? 0,
        totalScore: p.score,
        rank: rankOf.get(p.id) ?? leaderboard.length,
      });
    }
    return closed;
  }

  /**
   * Events that bring a (re)joining socket up to date, sent right after the join ack:
   * the open question's answer key (hosts only), the last close results (plus the
   * player's own result), the leaderboard once any question has closed, and the
   * final results of an ended session. Payloads are captured inside the room lock
   * so they are consistent with the snapshot.
   */
  private replayFor(socket: AppSocket, room: LiveRoom, participantId: string | null): () => void {
    const events: (() => void)[] = [];
    if (participantId === null && room.status === 'question_open') {
      const q = this.hostQuestion(room);
      events.push(() => socket.emit('question:host_open', q));
    }
    if (room.status === 'question_closed' && room.lastClosed) {
      const closed = room.lastClosed;
      events.push(() => socket.emit('question:closed', closed));
      const result = participantId ? room.lastResults.get(participantId) : undefined;
      if (result) events.push(() => socket.emit('player:result', result));
    }
    const anyClosed =
      room.status === 'question_closed' ||
      room.status === 'ended' ||
      (room.status === 'question_open' && (room.currentIndex ?? 0) > 0);
    const leaderboard = this.leaderboard(room).slice(0, LEADERBOARD_SIZE);
    if (anyClosed) events.push(() => socket.emit('live:leaderboard', leaderboard));
    if (room.status === 'ended') events.push(() => socket.emit('live:ended', { leaderboard }));
    return () => events.forEach((emit) => emit());
  }

  /* --------------------------------------------------------------------------
   * Projections
   * ----------------------------------------------------------------------- */

  private publicQuestion(room: LiveRoom): PublicQuestion {
    const q = room.questions[room.currentIndex!]!;
    return {
      questionId: q.id,
      index: room.currentIndex!,
      total: room.questions.length,
      stem: q.stem,
      stemLocal: q.stemLocal,
      options: q.options,
      optionsLocal: q.optionsLocal,
      timeLimitSec: room.timeLimitSec,
      openedAt: room.openedAt!.getTime(),
      closesAt: room.closesAt!.getTime(),
    };
  }

  private hostQuestion(room: LiveRoom): HostQuestion {
    const q = room.questions[room.currentIndex!]!;
    return { ...this.publicQuestion(room), correctIndex: q.correctIndex, explanation: q.explanation };
  }

  private snapshot(room: LiveRoom, participant: RoomParticipant | null): LiveStateSnapshot {
    const open = room.status === 'question_open';
    return {
      sessionId: room.id,
      pin: room.pin,
      title: room.title,
      status: room.status,
      questionCount: room.questions.length,
      currentQuestionIndex: room.currentIndex,
      participantCount: room.participants.size,
      question: open ? this.publicQuestion(room) : null,
      myAnswer: participant && open ? (room.answers.get(participant.id) ?? null) : null,
      myScore: participant ? participant.score : null,
      serverTime: Date.now(),
    };
  }

  private leaderboard(room: LiveRoom): LeaderboardEntry[] {
    return rankLeaderboard([...room.participants.values()]);
  }

  private participantList(room: LiveRoom): ParticipantInfo[] {
    return [...room.participants.values()].map((p) => ({
      participantId: p.id,
      studentId: p.studentId,
      name: p.name,
      connected: p.connections > 0,
      score: p.score,
    }));
  }

  private emitParticipants(room: LiveRoom): void {
    this.io.to(rooms.hosts(room.id)).emit('live:participants', this.participantList(room));
  }

  /** Hosts get the neutral snapshot; each connected player gets their own (myAnswer/myScore). */
  private emitState(room: LiveRoom): void {
    this.io.to(rooms.hosts(room.id)).emit('live:state', this.snapshot(room, null));
    for (const p of room.participants.values()) {
      if (p.connections > 0) this.io.to(rooms.player(room.id, p.id)).emit('live:state', this.snapshot(room, p));
    }
  }
}
