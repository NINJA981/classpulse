/**
 * Live quiz Socket.IO integration: a real HTTP server on an ephemeral port with
 * socket.io-client connections authenticated by session cookies.
 */
import { createServer, type Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { and, eq } from 'drizzle-orm';
import { io as connectClient, type Socket as ClientSocket } from 'socket.io-client';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { Ack, LiveStateSnapshot, PlayerResultPayload, PublicQuestion, HostQuestion, QuestionClosedPayload, LeaderboardEntry, ParticipantInfo } from '@classiq/shared';
import { createApp } from '../src/app.js';
import { db } from '../src/db/client.js';
import { enrollments, liveAnswers, liveParticipants, liveSessions } from '../src/db/schema/index.js';
import { attachSockets, type SocketHandle } from '../src/sockets/index.js';
import { as, createUser, createWorld, sessionCookie } from './helpers.js';
import { correctFor, publishedLesson } from './live.fixtures.js';

type User = { id: string; tokenVersion: number; role: 'admin' | 'teacher' | 'student' };
interface Recorded {
  event: string;
  payload: unknown;
}
interface Client {
  socket: ClientSocket;
  events: Recorded[];
}

let server: HttpServer;
let handle: SocketHandle;
let url: string;
const open: Client[] = [];

beforeAll(async () => {
  server = createServer(createApp());
  handle = attachSockets(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterEach(() => {
  for (const c of open.splice(0)) c.socket.disconnect();
});

afterAll(async () => {
  await handle.close(); // also closes the HTTP server
});

function connect(user: User | null, extraHeaders: Record<string, string> = {}): Promise<Client> {
  const socket = connectClient(url, {
    transports: ['websocket'],
    forceNew: true,
    reconnection: false,
    extraHeaders: { ...(user ? { Cookie: sessionCookie(user) } : {}), ...extraHeaders },
  });
  const client: Client = { socket, events: [] };
  socket.onAny((event: string, payload: unknown) => client.events.push({ event, payload }));
  open.push(client);
  return new Promise((resolve, reject) => {
    socket.once('connect', () => resolve(client));
    socket.once('connect_error', (err) => reject(err));
  });
}

function call<T = undefined>(c: Client, event: string, ...args: unknown[]): Promise<Ack<T>> {
  return c.socket.timeout(10_000).emitWithAck(event, ...args) as Promise<Ack<T>>;
}

async function ok<T = undefined>(c: Client, event: string, ...args: unknown[]): Promise<T> {
  const res = await call<T>(c, event, ...args);
  if (!res.ok) throw new Error(`${event} failed: ${res.error.code} ${res.error.message}`);
  return res.data;
}

function waitFor<T>(c: Client, event: string, pred: (p: T) => boolean = () => true, timeoutMs = 10_000): Promise<T> {
  return new Promise((resolve, reject) => {
    const handler = (p: T) => {
      if (!pred(p)) return;
      clearTimeout(timer);
      c.socket.off(event, handler);
      resolve(p);
    };
    const timer = setTimeout(() => {
      c.socket.off(event, handler);
      reject(new Error(`timed out waiting for ${event}`));
    }, timeoutMs);
    c.socket.on(event, handler);
  });
}

async function eventually(check: () => boolean, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  while (!check()) {
    if (Date.now() > deadline) throw new Error('condition not met in time');
    await new Promise((r) => setTimeout(r, 20));
  }
}

const received = (c: Client, event: string) => c.events.filter((e) => e.event === event).map((e) => e.payload);

async function liveSession(w: Awaited<ReturnType<typeof createWorld>>, opts: { questionCount?: number; timeLimitSec?: number } = {}) {
  const { lesson, questions } = await publishedLesson(w, { questionCount: opts.questionCount ?? 2 });
  const res = await as(w.teacher).post('/api/live-sessions').send({ lessonId: lesson.id, timeLimitSec: opts.timeLimitSec ?? 60 });
  expect(res.status).toBe(201);
  return { sessionId: res.body.id as string, pin: res.body.pin as string, lesson, questions };
}

describe('socket authentication and roles', () => {
  it('rejects unauthenticated, password-change and foreign-origin connections', async () => {
    await expect(connect(null)).rejects.toThrow('UNAUTHENTICATED');
    const w = await createWorld();
    const pending = await createUser(w.institution.id, 'student', { mustChangePassword: true });
    await expect(connect(pending)).rejects.toThrow('PASSWORD_CHANGE_REQUIRED');
    await expect(connect(w.student, { Origin: 'https://evil.example' })).rejects.toThrow();
    const c = await connect(w.student, { Origin: 'http://localhost:3000' });
    expect(c.socket.connected).toBe(true);
  });

  it('allows host controls only for the owning teacher and joins only for enrolled students', async () => {
    const w = await createWorld();
    const { sessionId, pin } = await liveSession(w);

    const student = await connect(w.student);
    const r1 = await call(student, 'host:join', { sessionId });
    expect(r1).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
    expect(await call(student, 'host:start')).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });

    const otherTeacher = await connect(w.otherTeacher);
    expect(await call(otherTeacher, 'host:join', { sessionId })).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });
    expect(await call(otherTeacher, 'player:join', { pin })).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });

    const outsider = await connect(await createUser(w.institution.id, 'student'));
    expect(await call(outsider, 'player:join', { pin })).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });
    expect(await call(outsider, 'player:join', { pin: 'abc' })).toMatchObject({ ok: false, error: { code: 'VALIDATION_FAILED' } });

    // A joined player still cannot drive the session.
    const snap = await ok<LiveStateSnapshot>(student, 'player:join', { pin });
    expect(snap).toMatchObject({ sessionId, status: 'lobby', myScore: 0, myAnswer: null });
    expect(await call(student, 'host:start')).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
    expect(await call(student, 'host:end')).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });

    // Answering without joining is refused.
    const loner = await connect(w.otherStudent);
    expect(await call(loner, 'player:answer', { questionId: sessionId, optionIndex: 0 })).toMatchObject({
      ok: false,
      error: { code: 'FORBIDDEN' },
    });
  });
});

describe('live quiz game', () => {
  it('runs a full game with 30 concurrent players without leaking the answer key', async () => {
    const w = await createWorld();
    const players = await Promise.all(
      Array.from({ length: 30 }, async () => {
        const s = await createUser(w.institution.id, 'student');
        await db.insert(enrollments).values({ sectionId: w.section.id, studentId: s.id });
        return s;
      }),
    );
    const { sessionId, pin, questions } = await liveSession(w, { questionCount: 2 });

    const host = await connect(w.teacher);
    const hostSnap = await ok<LiveStateSnapshot>(host, 'host:join', { sessionId });
    expect(hostSnap).toMatchObject({ status: 'lobby', questionCount: 2, participantCount: 0, myScore: null });

    const clients = await Promise.all(players.map((p) => connect(p)));
    const snaps = await Promise.all(clients.map((c) => ok<LiveStateSnapshot>(c, 'player:join', { pin })));
    expect(snaps.every((s) => s.status === 'lobby')).toBe(true);
    await eventually(() => received(host, 'live:participants').some((p) => (p as ParticipantInfo[]).filter((x) => x.connected).length === 30));

    // Start opens question 0 immediately.
    const opened = clients.map((c) => waitFor<PublicQuestion>(c, 'question:open'));
    const hostOpen = waitFor<HostQuestion>(host, 'question:host_open');
    await ok(host, 'host:start');
    const q0 = (await Promise.all(opened))[0]!;
    expect(q0).toMatchObject({ questionId: questions[0]!.id, index: 0, total: 2, timeLimitSec: 60 });
    expect(q0).not.toHaveProperty('correctIndex');
    expect(q0).not.toHaveProperty('explanation');
    expect(q0.closesAt - q0.openedAt).toBe(60_000);
    expect((await hostOpen).correctIndex).toBe(correctFor(0));

    // Players 0-19 answer correctly, 20-29 wrongly. Player 0 revises; player 1 tries to impersonate player 25.
    const correct = correctFor(0);
    const wrong = (correct + 1) % 4;
    const acks = await Promise.all(
      clients.map(async (c, i) => {
        if (i === 0) {
          await ok(c, 'player:answer', { questionId: q0.questionId, optionIndex: wrong });
          return ok<{ revision: number; optionIndex: number }>(c, 'player:answer', { questionId: q0.questionId, optionIndex: correct });
        }
        const payload: Record<string, unknown> = { questionId: q0.questionId, optionIndex: i < 20 ? correct : wrong };
        if (i === 1) payload.studentId = players[25]!.id;
        return ok<{ revision: number; optionIndex: number }>(c, 'player:answer', payload);
      }),
    );
    expect(acks[0]).toEqual({ questionId: q0.questionId, optionIndex: correct, revision: 2 });
    expect(acks.slice(1).every((a) => a.revision === 1)).toBe(true);
    for (const a of acks) expect(a).not.toHaveProperty('isCorrect');
    await eventually(() =>
      received(host, 'question:progress').some((p) => (p as { answeredCount: number }).answeredCount === 30),
    );
    expect(await call(clients[0]!, 'player:answer', { questionId: questions[1]!.id, optionIndex: 0 })).toMatchObject({
      ok: false,
      error: { code: 'INVALID_STATE' },
    });

    // Close: every player gets their own result, everyone gets the distribution and the leaderboard.
    const closedAll = clients.map((c) => waitFor<QuestionClosedPayload>(c, 'question:closed'));
    const results = clients.map((c) => waitFor<PlayerResultPayload>(c, 'player:result'));
    const board = waitFor<LeaderboardEntry[]>(host, 'live:leaderboard');
    await ok(host, 'host:close_question');
    const closed = await Promise.all(closedAll);
    expect(closed[0]).toMatchObject({ correctIndex: correct, distribution: [20, 10, 0, 0], answeredCount: 30 });
    const res = await Promise.all(results);
    res.forEach((r, i) => {
      expect(r.questionId).toBe(q0.questionId);
      if (i < 20) {
        expect(r.isCorrect).toBe(true);
        expect(r.pointsAwarded).toBeGreaterThan(500);
        expect(r.pointsAwarded).toBeLessThanOrEqual(1000);
        expect(r.totalScore).toBe(r.pointsAwarded);
      } else {
        expect(r).toMatchObject({ isCorrect: false, pointsAwarded: 0, totalScore: 0, rank: 21 });
      }
    });
    expect(res[0]!.selectedIndex).toBe(correct);
    expect((await board).length).toBe(10);

    // No player received the answer key before the question closed.
    for (const c of clients) {
      const idx = c.events.findIndex((e) => e.event === 'question:closed');
      expect(idx).toBeGreaterThan(-1);
      expect(JSON.stringify(c.events.slice(0, idx))).not.toContain('correctIndex');
      expect(received(c, 'question:host_open')).toHaveLength(0);
    }

    // Persistence: revisions and identity come from the server.
    const rows = await db
      .select({ studentId: liveParticipants.studentId, selected: liveAnswers.selectedIndex, revision: liveAnswers.revision, points: liveAnswers.pointsAwarded })
      .from(liveAnswers)
      .innerJoin(liveParticipants, eq(liveParticipants.id, liveAnswers.participantId))
      .where(eq(liveParticipants.sessionId, sessionId));
    expect(rows).toHaveLength(30);
    const byStudent = new Map(rows.map((r) => [r.studentId, r]));
    expect(byStudent.get(players[0]!.id)).toMatchObject({ selected: correct, revision: 2 });
    expect(byStudent.get(players[1]!.id)).toMatchObject({ selected: correct, revision: 1 });
    expect(byStudent.get(players[25]!.id)).toMatchObject({ selected: wrong, revision: 1, points: 0 });

    // Next question, then next again ends the game.
    const q1Open = waitFor<PublicQuestion>(clients[0]!, 'question:open');
    await ok(host, 'host:next');
    expect((await q1Open).index).toBe(1);
    expect(await call(host, 'host:next')).toMatchObject({ ok: false, error: { code: 'INVALID_STATE' } });
    await ok(host, 'host:close_question');
    const ended = waitFor<{ leaderboard: LeaderboardEntry[] }>(clients[5]!, 'live:ended');
    await ok(host, 'host:next');
    expect((await ended).leaderboard.length).toBe(10);
    await ok(host, 'host:end'); // idempotent
    expect(await call(host, 'host:start')).toMatchObject({ ok: false, error: { code: 'INVALID_STATE' } });
    const [row] = await db.select().from(liveSessions).where(eq(liveSessions.id, sessionId));
    expect(row!.status).toBe('ended');
    expect(row!.endedAt).toBeInstanceOf(Date);

    // A host (re)joining an ended session gets the final results replayed.
    const projector = await connect(w.teacher);
    const endSnap = await ok<LiveStateSnapshot>(projector, 'host:join', { sessionId });
    expect(endSnap.status).toBe('ended');
    await eventually(() => received(projector, 'live:ended').length === 1 && received(projector, 'live:leaderboard').length === 1);

    // Results endpoint.
    const results2 = await as(w.teacher).get(`/api/live-sessions/${sessionId}/results`);
    expect(results2.status).toBe(200);
    expect(results2.body.session.status).toBe('ended');
    expect(results2.body.leaderboard).toHaveLength(30);
    expect(results2.body.leaderboard[0].rank).toBe(1);
    expect(results2.body.questions[0].distribution).toEqual([20, 10, 0, 0]);
    const p0 = results2.body.leaderboard.find((e: LeaderboardEntry) => e.studentId === players[0]!.id);
    expect(p0.score).toBe(res[0]!.totalScore);
  });

  it('rejects invalid transitions', async () => {
    const w = await createWorld();
    const { sessionId } = await liveSession(w);
    const host = await connect(w.teacher);
    await ok(host, 'host:join', { sessionId });
    expect(await call(host, 'host:next')).toMatchObject({ ok: false, error: { code: 'INVALID_STATE' } });
    expect(await call(host, 'host:close_question')).toMatchObject({ ok: false, error: { code: 'INVALID_STATE' } });
    await ok(host, 'host:start');
    const [row] = await db.select().from(liveSessions).where(eq(liveSessions.id, sessionId));
    expect(row).toMatchObject({ status: 'question_open', currentQuestionIndex: 0 });
    expect(row!.questionClosesAt!.getTime() - row!.questionOpenedAt!.getTime()).toBe(60_000);
    expect(await call(host, 'host:start')).toMatchObject({ ok: false, error: { code: 'INVALID_STATE' } });
    expect(await call(host, 'host:next')).toMatchObject({ ok: false, error: { code: 'INVALID_STATE' } });
    await ok(host, 'host:end'); // from question_open
    await ok(host, 'host:end');
    expect(await call(host, 'host:close_question')).toMatchObject({ ok: false, error: { code: 'INVALID_STATE' } });
  });

  it('auto-closes at the server deadline and rejects late answers', async () => {
    const w = await createWorld();
    const { sessionId, pin } = await liveSession(w, { timeLimitSec: 5 });
    const host = await connect(w.teacher);
    await ok(host, 'host:join', { sessionId });
    const player = await connect(w.student);
    await ok(player, 'player:join', { pin });

    const opened = waitFor<PublicQuestion>(player, 'question:open');
    await ok(host, 'host:start');
    const q = await opened;
    const closed = waitFor<QuestionClosedPayload>(player, 'question:closed', () => true, 9000);
    const result = waitFor<PlayerResultPayload>(player, 'player:result', () => true, 9000);
    await closed;
    expect(Date.now()).toBeGreaterThanOrEqual(q.closesAt - 50);
    expect(await result).toMatchObject({ selectedIndex: null, isCorrect: false, pointsAwarded: 0 });
    expect(await call(player, 'player:answer', { questionId: q.questionId, optionIndex: correctFor(0) })).toMatchObject({
      ok: false,
      error: { code: 'INVALID_STATE' },
    });
    const [row] = await db.select().from(liveSessions).where(eq(liveSessions.id, sessionId));
    expect(row!.status).toBe('question_closed');
  }, 20_000);

  it('restores the same participant, answer and score on reconnect', async () => {
    const w = await createWorld();
    const { sessionId, pin } = await liveSession(w);
    const host = await connect(w.teacher);
    await ok(host, 'host:join', { sessionId });
    let player = await connect(w.student);
    await ok(player, 'player:join', { pin });
    await ok(host, 'host:start');
    const snap1 = await ok<LiveStateSnapshot>(player, 'player:join', { pin }); // rejoin on the same socket is fine
    const qid = snap1.question!.questionId;
    await ok(player, 'player:answer', { questionId: qid, optionIndex: correctFor(0) });

    // Drop and reconnect while the question is open.
    player.socket.disconnect();
    await eventually(() => {
      const last = received(host, 'live:participants').at(-1) as ParticipantInfo[] | undefined;
      return Boolean(last && last.length === 1 && !last[0]!.connected);
    });
    player = await connect(w.student);
    const snap2 = await ok<LiveStateSnapshot>(player, 'player:join', { pin });
    expect(snap2).toMatchObject({ status: 'question_open', myAnswer: correctFor(0), myScore: 0, participantCount: 1 });
    expect(snap2.question).not.toHaveProperty('correctIndex');

    // A host reconnecting mid-question gets the answer key replayed after the ack.
    const projector = await connect(w.teacher);
    await ok(projector, 'host:join', { sessionId });
    await eventually(() => received(projector, 'question:host_open').length === 1 && received(projector, 'live:participants').length === 1);

    const result = waitFor<PlayerResultPayload>(player, 'player:result');
    await ok(host, 'host:close_question');
    const r = await result;
    expect(r.isCorrect).toBe(true);

    // Reconnect after close: score restored and the close results replayed.
    player.socket.disconnect();
    player = await connect(w.student);
    const snap3 = await ok<LiveStateSnapshot>(player, 'player:join', { pin });
    expect(snap3).toMatchObject({ status: 'question_closed', myScore: r.totalScore, myAnswer: null, question: null });
    await eventually(
      () =>
        received(player, 'question:closed').length === 1 &&
        received(player, 'player:result').length === 1 &&
        received(player, 'live:leaderboard').length === 1,
    );
    expect(received(player, 'player:result')[0]).toEqual(r);
    const participants = await db.select().from(liveParticipants).where(eq(liveParticipants.sessionId, sessionId));
    expect(participants).toHaveLength(1);
    expect(participants[0]!.studentId).toBe(w.student.id);
  });

  it('rebuilds a session from the database and closes an overdue question', async () => {
    const w = await createWorld();
    const { sessionId, pin, questions } = await liveSession(w);
    // Simulate a restart mid-question: the DB says question 0 is open but its deadline passed.
    const [participant] = await db.insert(liveParticipants).values({ sessionId, studentId: w.student.id }).returning();
    await db.insert(liveAnswers).values({
      participantId: participant!.id,
      questionId: questions[0]!.id,
      selectedIndex: correctFor(0),
      answeredAt: new Date(Date.now() - 20_000),
    });
    await db
      .update(liveSessions)
      .set({
        status: 'question_open',
        currentQuestionIndex: 0,
        questionOpenedAt: new Date(Date.now() - 30_000),
        questionClosesAt: new Date(Date.now() - 1_000),
        startedAt: new Date(Date.now() - 30_000),
      })
      .where(eq(liveSessions.id, sessionId));

    const host = await connect(w.teacher);
    const snap = await ok<LiveStateSnapshot>(host, 'host:join', { sessionId });
    expect(snap.status).toBe('question_closed');
    await eventually(() => received(host, 'question:closed').length >= 1);

    const [p] = await db.select().from(liveParticipants).where(and(eq(liveParticipants.sessionId, sessionId), eq(liveParticipants.studentId, w.student.id)));
    // Answered 10 s into a 29 s window: 500 + round(500 * 19/29).
    expect(p!.score).toBe(500 + Math.round((500 * 19) / 29));
    expect(p!.correct).toBe(1);

    const player = await connect(w.student);
    const s2 = await ok<LiveStateSnapshot>(player, 'player:join', { pin });
    expect(s2.myScore).toBe(p!.score);
    await eventually(() => received(player, 'player:result').length === 1);
    await ok(host, 'host:next');
    expect((await db.select().from(liveSessions).where(eq(liveSessions.id, sessionId)))[0]!.currentQuestionIndex).toBe(1);
  });
});
