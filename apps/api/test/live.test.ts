import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { db } from '../src/db/client.js';
import { liveSessions } from '../src/db/schema/index.js';
import { anon, as, createUser, createWorld } from './helpers.js';
import { publishedLesson } from './live.fixtures.js';

describe('POST /api/live-sessions', () => {
  it('creates a session with a 6-digit PIN for the owner of a published lesson', async () => {
    const w = await createWorld();
    const { lesson } = await publishedLesson(w, { questionCount: 2 });
    const res = await as(w.teacher).post('/api/live-sessions').send({ lessonId: lesson.id, timeLimitSec: 30 });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      lessonId: lesson.id,
      title: 'Photosynthesis',
      status: 'lobby',
      questionCount: 2,
      currentQuestionIndex: null,
      timeLimitSec: 30,
      participantCount: 0,
      endedAt: null,
    });
    expect(res.body.pin).toMatch(/^\d{6}$/);
  });

  it('enforces ownership, role, lesson state and input', async () => {
    const w = await createWorld();
    const { lesson } = await publishedLesson(w);
    expect((await anon().post('/api/live-sessions').send({ lessonId: lesson.id })).status).toBe(401);
    expect((await as(w.student).post('/api/live-sessions').send({ lessonId: lesson.id })).status).toBe(403);
    expect((await as(w.otherTeacher).post('/api/live-sessions').send({ lessonId: lesson.id })).status).toBe(404);
    expect((await as(w.teacher).post('/api/live-sessions').send({ lessonId: 'nope' })).status).toBe(400);
    expect((await as(w.teacher).post('/api/live-sessions').send({ lessonId: lesson.id, timeLimitSec: 2 })).status).toBe(400);

    const draft = await publishedLesson(w, { status: 'ready_for_review' });
    const r1 = await as(w.teacher).post('/api/live-sessions').send({ lessonId: draft.lesson.id });
    expect(r1.status).toBe(409);
    expect(r1.body.error.code).toBe('INVALID_STATE');

    const noApproved = await publishedLesson(w, { approved: false });
    const r2 = await as(w.teacher).post('/api/live-sessions').send({ lessonId: noApproved.lesson.id });
    expect(r2.status).toBe(409);
    expect(r2.body.error.code).toBe('INVALID_STATE');
  });
});

describe('GET /api/live-sessions/:id and /results', () => {
  it('is visible to the host only', async () => {
    const w = await createWorld();
    const { lesson } = await publishedLesson(w);
    const created = await as(w.teacher).post('/api/live-sessions').send({ lessonId: lesson.id });
    const id = created.body.id as string;
    expect((await as(w.teacher).get(`/api/live-sessions/${id}`)).body).toMatchObject({ id, status: 'lobby' });
    expect((await as(w.otherTeacher).get(`/api/live-sessions/${id}`)).status).toBe(404);
    expect((await as(w.student).get(`/api/live-sessions/${id}`)).status).toBe(403);
    expect((await as(w.teacher).get('/api/live-sessions/not-a-uuid')).status).toBe(400);

    const results = await as(w.teacher).get(`/api/live-sessions/${id}/results`);
    expect(results.status).toBe(200);
    expect(results.body.leaderboard).toEqual([]);
    expect(results.body.questions).toHaveLength(3);
    expect(results.body.questions[0]).toMatchObject({ position: 0, correctIndex: 0, distribution: [0, 0, 0, 0] });
    expect((await as(w.otherTeacher).get(`/api/live-sessions/${id}/results`)).status).toBe(404);
  });
});

describe('GET /api/live-sessions/pin/:pin', () => {
  it('resolves for enrolled students only, and not after the session ends', async () => {
    const w = await createWorld();
    const { lesson } = await publishedLesson(w);
    const created = await as(w.teacher).post('/api/live-sessions').send({ lessonId: lesson.id });
    const pin = created.body.pin as string;

    const ok = await as(w.student).get(`/api/live-sessions/pin/${pin}`);
    expect(ok.status).toBe(200);
    expect(ok.body).toEqual({ sessionId: created.body.id, title: 'Photosynthesis', status: 'lobby' });

    const outsider = await createUser(w.institution.id, 'student');
    expect((await as(outsider).get(`/api/live-sessions/pin/${pin}`)).status).toBe(404);
    expect((await as(w.teacher).get(`/api/live-sessions/pin/${pin}`)).status).toBe(403);
    expect((await as(w.student).get('/api/live-sessions/pin/12ab')).status).toBe(400);
    const other = pin === '999999' ? '999998' : '999999';
    expect((await as(w.student).get(`/api/live-sessions/pin/${other}`)).status).toBe(404);

    await db.update(liveSessions).set({ status: 'ended', endedAt: new Date() }).where(eq(liveSessions.id, created.body.id));
    expect((await as(w.student).get(`/api/live-sessions/pin/${pin}`)).status).toBe(404);
  });
});
