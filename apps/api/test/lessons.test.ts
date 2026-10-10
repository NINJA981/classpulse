import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { env } from '../src/config/env.js';
import { db } from '../src/db/client.js';
import { assignments, lessons } from '../src/db/schema/index.js';
import { setInProcessRunner, type LessonJobData } from '../src/jobs/queue.js';
import { storage } from '../src/lib/storage.js';
import { anon, as, createInstitution, createSection, createUser, createWorld } from './helpers.js';
import { insertAttempt, insertLesson, insertQuestions, makeWav, writeTempFile } from './fixtures/lessons.js';

let queued: LessonJobData[] = [];
beforeEach(() => {
  queued = [];
  setInProcessRunner((d) => queued.push(d));
});

const lessonFor = (w: Awaited<ReturnType<typeof createWorld>>, extra: Parameters<typeof insertLesson>[0] extends infer T ? Partial<T> : never = {}) =>
  insertLesson({ institutionId: w.institution.id, teacherId: w.teacher.id, sectionId: w.section.id, ...extra });

describe('lessons: create / list / detail / update / delete', () => {
  it('creates a draft lesson only for sections the teacher teaches', async () => {
    const w = await createWorld();
    const res = await as(w.teacher).post('/api/lessons').send({ title: 'Cells', sectionId: w.section.id, subject: 'Biology', language: 'hi-IN' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      title: 'Cells',
      status: 'draft',
      language: 'hi-IN',
      section: { id: w.section.id },
      teacher: { id: w.teacher.id },
      hasAudio: false,
      questions: [],
      assignment: null,
      progress: null,
      questionCount: 0,
    });

    const otherSection = await createSection(w.institution.id, { teacherIds: [w.otherTeacher.id] });
    const forbiddenRes = await as(w.teacher).post('/api/lessons').send({ title: 'X', sectionId: otherSection.id, subject: 'Y' });
    expect(forbiddenRes.status).toBe(403);

    const foreign = await createInstitution();
    const foreignSection = await createSection(foreign.id);
    expect((await as(w.teacher).post('/api/lessons').send({ title: 'X', sectionId: foreignSection.id, subject: 'Y' })).status).toBe(404);

    expect((await as(w.teacher).post('/api/lessons').send({ title: '', sectionId: w.section.id, subject: 'Y' })).status).toBe(400);
    expect((await as(w.admin).post('/api/lessons').send({ title: 'X', sectionId: w.section.id, subject: 'Y' })).status).toBe(403);
  });

  it('lists with pagination, filters and question counts', async () => {
    const w = await createWorld();
    const a = await lessonFor(w, { status: 'ready_for_review' });
    await insertQuestions(a.id, 3);
    await insertQuestions(a.id, 1, 'rejected'); // rejected questions are not counted
    await lessonFor(w);
    const otherSection = await createSection(w.institution.id, { teacherIds: [w.otherTeacher.id] });
    await insertLesson({ institutionId: w.institution.id, teacherId: w.otherTeacher.id, sectionId: otherSection.id });

    const mine = await as(w.teacher).get('/api/lessons?pageSize=1');
    expect(mine.status).toBe(200);
    expect(mine.body.total).toBe(2);
    expect(mine.body.items).toHaveLength(1);

    const filtered = await as(w.teacher).get('/api/lessons?status=ready_for_review');
    expect(filtered.body.items).toHaveLength(1);
    expect(filtered.body.items[0].questionCount).toBe(3);

    const admin = await as(w.admin).get('/api/lessons');
    expect(admin.body.total).toBe(3);
    expect((await as(w.teacher).get('/api/lessons?status=nope')).status).toBe(400);
  });

  it('enforces visibility: other teacher 404, student 403, anonymous 401, admin read ok / write 403', async () => {
    const w = await createWorld();
    const lesson = await lessonFor(w);
    expect((await anon().get(`/api/lessons/${lesson.id}`)).status).toBe(401);
    expect((await as(w.student).get(`/api/lessons/${lesson.id}`)).status).toBe(403);
    expect((await as(w.student).get('/api/lessons')).status).toBe(403);
    expect((await as(w.otherTeacher).get(`/api/lessons/${lesson.id}`)).status).toBe(404);
    expect((await as(w.otherTeacher).patch(`/api/lessons/${lesson.id}`).send({ title: 'Hack' })).status).toBe(404);
    expect((await as(w.otherTeacher).delete(`/api/lessons/${lesson.id}`)).status).toBe(404);
    expect((await as(w.admin).get(`/api/lessons/${lesson.id}`)).status).toBe(200);
    expect((await as(w.admin).patch(`/api/lessons/${lesson.id}`).send({ title: 'Hack' })).status).toBe(403);
    expect((await as(w.admin).post(`/api/lessons/${lesson.id}/publish`)).status).toBe(403);
    expect((await as(w.teacher).get('/api/lessons/not-a-uuid')).status).toBe(400);

    const foreignAdmin = await createUser((await createInstitution()).id, 'admin');
    expect((await as(foreignAdmin).get(`/api/lessons/${lesson.id}`)).status).toBe(404);
  });

  it('updates metadata and deletes only draft/failed lessons without attempts', async () => {
    const w = await createWorld();
    const lesson = await lessonFor(w, { withAudio: true });
    const upd = await as(w.teacher).patch(`/api/lessons/${lesson.id}`).send({ title: 'Renamed', keyTakeaways: ['One'] });
    expect(upd.status).toBe(200);
    expect(upd.body.title).toBe('Renamed');
    expect(upd.body.keyTakeaways).toEqual(['One']);

    const published = await lessonFor(w, { status: 'published' });
    expect((await as(w.teacher).delete(`/api/lessons/${published.id}`)).status).toBe(409);

    const failed = await lessonFor(w, { status: 'failed' });
    const qs = await insertQuestions(failed.id, 1, 'approved');
    await insertAttempt(failed.id, w.student.id, qs, [0]);
    expect((await as(w.teacher).delete(`/api/lessons/${failed.id}`)).status).toBe(409);

    expect((await as(w.teacher).delete(`/api/lessons/${lesson.id}`)).status).toBe(204);
    expect(await storage.stat(lesson.audioObjectKey!)).toBeNull();
    expect((await as(w.teacher).get(`/api/lessons/${lesson.id}`)).status).toBe(404);
  });
});

describe('lessons: audio', () => {
  afterEach(() => {
    env.MAX_AUDIO_UPLOAD_MB = 300;
  });

  it('uploads valid audio, normalizes it and reports hasAudio + duration', async () => {
    const w = await createWorld();
    const lesson = await lessonFor(w);
    const file = await writeTempFile('lecture.wav', makeWav(3, 44100));
    const res = await as(w.teacher).post(`/api/lessons/${lesson.id}/audio`).attach('file', file, { contentType: 'audio/wav' });
    expect(res.status).toBe(200);
    expect(res.body.hasAudio).toBe(true);
    expect(res.body.sourceType).toBe('upload');
    expect(res.body.durationSec).toBeCloseTo(3, 1);
    expect(res.body.audioExpiresAt).toBeTruthy();

    const row = await db.query.lessons.findFirst({ where: eq(lessons.id, lesson.id) });
    expect(row!.audioObjectKey).toMatch(new RegExp(`^audio/${lesson.id}/`));
    // 16 kHz mono 16-bit => ~32 KB/s
    expect(row!.audioSizeBytes).toBeGreaterThan(90_000);
    expect(row!.audioSizeBytes).toBeLessThan(100_000);
  });

  it('rejects non-audio files with 415 and undecodable "audio" with 415', async () => {
    const w = await createWorld();
    const lesson = await lessonFor(w);
    const txt = await writeTempFile('notes.txt', 'hello');
    const res = await as(w.teacher).post(`/api/lessons/${lesson.id}/audio`).attach('file', txt, { contentType: 'text/plain' });
    expect(res.status).toBe(415);
    expect(res.body.error.code).toBe('UNSUPPORTED_MEDIA_TYPE');

    const fake = await writeTempFile('fake.mp3', Buffer.alloc(2048, 7));
    const res2 = await as(w.teacher).post(`/api/lessons/${lesson.id}/audio`).attach('file', fake, { contentType: 'audio/mpeg' });
    expect(res2.status).toBe(415);

    expect((await as(w.teacher).post(`/api/lessons/${lesson.id}/audio`)).status).toBe(400);
  });

  it('accepts phone recordings in an MP4/MPEG container that browsers label video/*', async () => {
    const w = await createWorld();
    const lesson = await lessonFor(w);
    const file = await writeTempFile('recording.m4a.mp4', makeWav(2));
    const res = await as(w.teacher).post(`/api/lessons/${lesson.id}/audio`).attach('file', file, { contentType: 'video/mp4' });
    expect(res.status).toBe(200);
    expect(res.body.durationSec).toBeCloseTo(2, 1);
  });

  it('rejects oversized uploads with 413', async () => {
    const w = await createWorld();
    const lesson = await lessonFor(w);
    env.MAX_AUDIO_UPLOAD_MB = 1;
    const big = await writeTempFile('big.wav', makeWav(40)); // ~1.3 MB
    const res = await as(w.teacher).post(`/api/lessons/${lesson.id}/audio`).attach('file', big, { contentType: 'audio/wav' });
    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('refuses uploads while processing or published (409) and to non-owners', async () => {
    const w = await createWorld();
    const busy = await lessonFor(w, { status: 'transcribing' });
    const file = await writeTempFile('a.wav', makeWav(1));
    expect((await as(w.teacher).post(`/api/lessons/${busy.id}/audio`).attach('file', file, { contentType: 'audio/wav' })).status).toBe(409);
    const ok = await lessonFor(w);
    expect((await as(w.otherTeacher).post(`/api/lessons/${ok.id}/audio`).attach('file', file, { contentType: 'audio/wav' })).status).toBe(404);
  });

  it('streams audio with Range support', async () => {
    const w = await createWorld();
    const lesson = await lessonFor(w, { withAudio: true });
    const full = await as(w.teacher).get(`/api/lessons/${lesson.id}/audio`).buffer(true);
    expect(full.status).toBe(200);
    expect(full.headers['accept-ranges']).toBe('bytes');
    expect(full.headers['content-type']).toContain('audio/wav');
    const size = Number(full.headers['content-length']);
    expect(size).toBe(lesson.audioSizeBytes);

    const part = await as(w.teacher).get(`/api/lessons/${lesson.id}/audio`).set('Range', 'bytes=0-99').buffer(true);
    expect(part.status).toBe(206);
    expect(part.headers['content-range']).toBe(`bytes 0-99/${size}`);
    expect(part.headers['content-length']).toBe('100');

    const tail = await as(w.admin).get(`/api/lessons/${lesson.id}/audio`).set('Range', 'bytes=-10').buffer(true);
    expect(tail.status).toBe(206);
    expect(tail.headers['content-range']).toBe(`bytes ${size - 10}-${size - 1}/${size}`);

    const bad = await as(w.teacher).get(`/api/lessons/${lesson.id}/audio`).set('Range', `bytes=${size + 10}-`);
    expect(bad.status).toBe(416);

    expect((await as(w.otherTeacher).get(`/api/lessons/${lesson.id}/audio`)).status).toBe(404);
    const noAudio = await lessonFor(w);
    expect((await as(w.teacher).get(`/api/lessons/${noAudio.id}/audio`)).status).toBe(404);
    const expired = await lessonFor(w, { withAudio: true, audioExpiresAt: new Date(Date.now() - 1000) });
    expect((await as(w.teacher).get(`/api/lessons/${expired.id}/audio`)).status).toBe(404);
  });
});

describe('lessons: generate / publish', () => {
  it('generate requires audio and an idle lesson, returns 202 with a job id', async () => {
    const w = await createWorld();
    const noAudio = await lessonFor(w);
    const r1 = await as(w.teacher).post(`/api/lessons/${noAudio.id}/generate`).send({});
    expect(r1.status).toBe(409);
    expect(r1.body.error.code).toBe('INVALID_STATE');

    const lesson = await lessonFor(w, { withAudio: true });
    const r2 = await as(w.teacher).post(`/api/lessons/${lesson.id}/generate`).send({});
    expect(r2.status).toBe(202);
    expect(r2.body.jobId).toBe(`lesson:${lesson.id}:1`);
    expect(queued).toEqual([{ lessonId: lesson.id, attempt: 1 }]);
    const detail = await as(w.teacher).get(`/api/lessons/${lesson.id}`);
    expect(detail.body.status).toBe('queued');
    expect(detail.body.progress).toMatchObject({ status: 'queued', attempt: 1 });
    const row = await db.query.lessons.findFirst({ where: eq(lessons.id, lesson.id) });
    // Defaults: the school's questions-per-lesson setting, mixed difficulty, a fresh quiz.
    expect(row!.quizRequest).toEqual({ questionCount: 5, difficulty: 'mixed', mode: 'replace_all' });

    expect((await as(w.teacher).post(`/api/lessons/${lesson.id}/generate`).send({})).status).toBe(409);
    expect((await as(w.admin).post(`/api/lessons/${lesson.id}/generate`).send({})).status).toBe(403);
    expect((await as(w.student).post(`/api/lessons/${lesson.id}/generate`).send({})).status).toBe(403);
  });

  it('regenerating requires confirmRegenerate and unpublishes a published lesson first', async () => {
    const w = await createWorld();
    const lesson = await lessonFor(w, { withAudio: true, status: 'published' });
    await insertQuestions(lesson.id, 2, 'approved');
    await db.insert(assignments).values({ lessonId: lesson.id, title: 'T', prompt: 'P', status: 'published' });

    const refused = await as(w.teacher).post(`/api/lessons/${lesson.id}/generate`).send({});
    expect(refused.status).toBe(409);
    expect(refused.body.error.message).toMatch(/confirm/i);

    const ok = await as(w.teacher).post(`/api/lessons/${lesson.id}/generate`).send({ confirmRegenerate: true });
    expect(ok.status).toBe(202);
    const row = await db.query.lessons.findFirst({ where: eq(lessons.id, lesson.id) });
    expect(row!.status).toBe('queued');
    expect(row!.publishedAt).toBeNull();
    const [a] = await db.select().from(assignments).where(eq(assignments.lessonId, lesson.id));
    expect(a!.status).toBe('draft');
  });

  it('append needs no confirmation; replacing confirms only when questions would be removed', async () => {
    const w = await createWorld();
    const lesson = await lessonFor(w, { withAudio: true, status: 'ready_for_review' });
    await insertQuestions(lesson.id, 2, 'approved');
    const gen = (body: object) => as(w.teacher).post(`/api/lessons/${lesson.id}/generate`).send(body);

    expect((await gen({ questionCount: 31 })).status).toBe(400);
    expect((await gen({ difficulty: 'impossible' })).status).toBe(400);
    // Every question is approved, so replace_unapproved removes nothing and needs no confirmation.
    const keep = await gen({ questionCount: 3, difficulty: 'hard', mode: 'replace_unapproved' });
    expect(keep.status).toBe(202);
    let row = await db.query.lessons.findFirst({ where: eq(lessons.id, lesson.id) });
    expect(row!.quizRequest).toEqual({ questionCount: 3, difficulty: 'hard', mode: 'replace_unapproved' });

    await db.update(lessons).set({ status: 'ready_for_review' }).where(eq(lessons.id, lesson.id));
    expect((await gen({ questionCount: 4, mode: 'append' })).status).toBe(202);
    await db.update(lessons).set({ status: 'ready_for_review' }).where(eq(lessons.id, lesson.id));
    const refused = await gen({ mode: 'replace_all' });
    expect(refused.status).toBe(409);
    expect(refused.body.error.message).toMatch(/remove 2 existing questions/);
    expect((await gen({ mode: 'replace_all', confirmRegenerate: true })).status).toBe(202);
    row = await db.query.lessons.findFirst({ where: eq(lessons.id, lesson.id) });
    expect(row!.quizRequest).toMatchObject({ mode: 'replace_all' });
  });

  it('upload transcribes automatically; /transcribe re-runs transcription only', async () => {
    const w = await createWorld();
    const lesson = await lessonFor(w);
    const file = await writeTempFile('lecture.wav', makeWav(2));
    const up = await as(w.teacher).post(`/api/lessons/${lesson.id}/audio`).attach('file', file, { contentType: 'audio/wav' });
    expect(up.status).toBe(200);
    expect(up.body.status).toBe('queued');
    expect(queued).toEqual([{ lessonId: lesson.id, attempt: 1 }]);
    let row = await db.query.lessons.findFirst({ where: eq(lessons.id, lesson.id) });
    expect(row!.quizRequest).toBeNull();

    expect((await as(w.teacher).post(`/api/lessons/${lesson.id}/transcribe`)).status).toBe(409); // busy
    await db.update(lessons).set({ status: 'failed' }).where(eq(lessons.id, lesson.id));
    const again = await as(w.teacher).post(`/api/lessons/${lesson.id}/transcribe`);
    expect(again.status).toBe(202);
    row = await db.query.lessons.findFirst({ where: eq(lessons.id, lesson.id) });
    expect(row).toMatchObject({ status: 'queued', generationAttempt: 2, quizRequest: null });
    expect((await as(w.student).post(`/api/lessons/${lesson.id}/transcribe`)).status).toBe(403);
  });

  it('publish needs ready_for_review and an approved question; unpublish reverts', async () => {
    const w = await createWorld();
    const draft = await lessonFor(w);
    expect((await as(w.teacher).post(`/api/lessons/${draft.id}/publish`)).status).toBe(409);

    const lesson = await lessonFor(w, { status: 'ready_for_review' });
    await insertQuestions(lesson.id, 2, 'draft');
    const noApproved = await as(w.teacher).post(`/api/lessons/${lesson.id}/publish`);
    expect(noApproved.status).toBe(409);
    expect(noApproved.body.error.message).toMatch(/approve/i);

    await as(w.teacher).put(`/api/lessons/${lesson.id}/assignment`).send({ title: 'Essay', prompt: 'Write', rubric: [] }).expect(200);
    await as(w.teacher).post(`/api/lessons/${lesson.id}/questions/approve-all`).expect(200);
    const pub = await as(w.teacher).post(`/api/lessons/${lesson.id}/publish`);
    expect(pub.status).toBe(200);
    expect(pub.body.status).toBe('published');
    expect(pub.body.publishedAt).toBeTruthy();
    expect(pub.body.assignment.status).toBe('published');

    // Published lessons are read-only
    expect((await as(w.teacher).put(`/api/lessons/${lesson.id}/assignment`).send({ title: 'E', prompt: 'W' })).status).toBe(409);
    expect((await as(w.teacher).patch(`/api/lessons/${lesson.id}`).send({ title: 'X' })).status).toBe(409);

    const unpub = await as(w.teacher).post(`/api/lessons/${lesson.id}/unpublish`);
    expect(unpub.status).toBe(200);
    expect(unpub.body.status).toBe('ready_for_review');
    expect(unpub.body.assignment.status).toBe('draft');
    expect((await as(w.teacher).post(`/api/lessons/${lesson.id}/unpublish`)).status).toBe(409);
  });

  it('upserts the assignment', async () => {
    const w = await createWorld();
    const lesson = await lessonFor(w, { status: 'ready_for_review' });
    const body = { title: 'Lab', prompt: 'Do it', rubric: [{ criterion: 'Care', marks: 5 }], estimatedMinutes: 20, dueAt: '2026-12-01T10:00:00.000Z' };
    const r1 = await as(w.teacher).put(`/api/lessons/${lesson.id}/assignment`).send(body);
    expect(r1.status).toBe(200);
    expect(r1.body).toMatchObject({ title: 'Lab', status: 'draft', dueAt: '2026-12-01T10:00:00.000Z', rubric: [{ criterion: 'Care', marks: 5, descriptor: '' }] });
    const r2 = await as(w.teacher).put(`/api/lessons/${lesson.id}/assignment`).send({ ...body, title: 'Lab 2' });
    expect(r2.body.id).toBe(r1.body.id);
    expect(r2.body.title).toBe('Lab 2');
    expect((await as(w.teacher).put(`/api/lessons/${lesson.id}/assignment`).send({ title: 'x' })).status).toBe(400);
  });
});
