import { and, eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import type {
  ExamDetail,
  ExamMonitor,
  ExamResults,
  StartExamResponse,
  StudentExamListItem,
  StudentExamResult,
} from '@classpulse/shared';
import { db } from '../src/db/client.js';
import {
  enrollments,
  examAnswers,
  examAttempts,
  examEvents,
  exams,
  questions,
} from '../src/db/schema/index.js';
import { sweepExams } from '../src/modules/exams/sweep.js';
import { anon, as, createSection, createUser, createWorld } from './helpers.js';
import { insertLesson, insertQuestions } from './fixtures/lessons.js';

type World = Awaited<ReturnType<typeof createWorld>>;
type Actor = Parameters<typeof as>[0];

const TOKEN = 'X-Exam-Token';
const inMin = (m: number) => new Date(Date.now() + m * 60_000).toISOString();
const letters = ['A', 'B', 'C', 'D'];

async function seedLesson(
  world: World,
  n: number,
  opts: { sectionId?: string; teacherId?: string; status?: 'draft' | 'approved' | 'rejected' } = {},
) {
  const lesson = await insertLesson({
    institutionId: world.institution.id,
    teacherId: opts.teacherId ?? world.teacher.id,
    sectionId: opts.sectionId ?? world.section.id,
    status: 'published',
  });
  const qs = await insertQuestions(lesson.id, n, opts.status ?? 'approved');
  // Give every question an explanation so leaks are detectable.
  await db
    .update(questions)
    .set({ explanation: 'Secret explanation' })
    .where(eq(questions.lessonId, lesson.id));
  return { lesson, qs };
}

const examBody = (world: World, overrides: Record<string, unknown> = {}) => ({
  title: 'Unit test 1',
  sectionId: world.section.id,
  instructions: 'No notes allowed.',
  opensAt: inMin(-5),
  closesAt: inMin(120),
  durationMin: 30,
  questionsPerStudent: 3,
  ...overrides,
});

async function publishedExam(
  world: World,
  opts: { n?: number; per?: number; overrides?: Record<string, unknown> } = {},
) {
  const { lesson, qs } = await seedLesson(world, opts.n ?? 6);
  const created = await as(world.teacher)
    .post('/api/exams')
    .send(examBody(world, { questionsPerStudent: opts.per ?? 3, ...opts.overrides }));
  expect(created.status).toBe(201);
  const id = created.body.id as string;
  const picked = await as(world.teacher)
    .put(`/api/exams/${id}/questions`)
    .send({ questionIds: qs.map((q) => q.id) });
  expect(picked.status).toBe(200);
  const pub = await as(world.teacher).post(`/api/exams/${id}/publish`);
  expect(pub.status).toBe(200);
  return { id, exam: pub.body as ExamDetail, lesson, qs };
}

function start(user: Actor, examId: string, accessCode?: string | null, token?: string) {
  const req = as(user)
    .post(`/api/student/exams/${examId}/start`)
    .send(accessCode ? { accessCode } : {});
  return token ? req.set(TOKEN, token) : req;
}

async function startOk(user: Actor, exam: { id: string; exam: ExamDetail }): Promise<StartExamResponse> {
  const res = await start(user, exam.id, exam.exam.accessCode);
  expect(res.status).toBe(201);
  return res.body as StartExamResponse;
}

const save = (user: Actor, examId: string, qid: string, selectedIndex: number | null, token?: string) => {
  const req = as(user).put(`/api/student/exams/${examId}/attempt/answers/${qid}`).send({ selectedIndex });
  return token ? req.set(TOKEN, token) : req;
};

const event = (user: Actor, examId: string, type: string, token: string) =>
  as(user).post(`/api/student/exams/${examId}/attempt/events`).set(TOKEN, token).send({ type });

const submit = (user: Actor, examId: string, token: string) =>
  as(user).post(`/api/student/exams/${examId}/attempt/submit`).set(TOKEN, token);

/** Shown index of the correct option for each paper question (via the teacher's frozen pool). */
function correctShown(exam: ExamDetail, started: StartExamResponse): Map<string, number> {
  const pool = new Map(exam.pool.map((q) => [q.id, q]));
  return new Map(
    started.paper.questions.map((q) => {
      const p = pool.get(q.examQuestionId)!;
      return [q.examQuestionId, q.options.indexOf(p.options[p.correctIndex]!)];
    }),
  );
}

const attemptOf = async (examId: string, studentId: string) =>
  (
    await db
      .select()
      .from(examAttempts)
      .where(and(eq(examAttempts.examId, examId), eq(examAttempts.studentId, studentId)))
  )[0]!;

describe('exams', () => {
  let world: World;
  beforeEach(async () => {
    world = await createWorld();
  });

  describe('RBAC', () => {
    it('requires a session and the right role', async () => {
      expect((await anon().get('/api/exams')).status).toBe(401);
      expect((await anon().get('/api/student/exams')).status).toBe(401);
      expect((await as(world.student).get('/api/exams')).status).toBe(403);
      expect((await as(world.admin).get('/api/exams')).status).toBe(403);
      expect((await as(world.teacher).get('/api/student/exams')).status).toBe(403);
    });

    it("hides other teachers' exams (404)", async () => {
      const { id } = await publishedExam(world);
      const other = as(world.otherTeacher);
      expect((await other.get(`/api/exams/${id}`)).status).toBe(404);
      expect((await other.get(`/api/exams/${id}/monitor`)).status).toBe(404);
      expect((await other.get(`/api/exams/${id}/results`)).status).toBe(404);
      expect((await other.post(`/api/exams/${id}/close`)).status).toBe(404);
      expect((await other.get('/api/exams')).body).toEqual([]);
    });
  });

  describe('drafts', () => {
    it('creates, lists, updates and deletes a draft', async () => {
      const t = as(world.teacher);
      const created = await t.post('/api/exams').send(examBody(world));
      expect(created.status).toBe(201);
      expect(created.body).toMatchObject({
        status: 'draft',
        poolSize: 0,
        enrolled: 2,
        accessCode: null,
        useAccessCode: true,
        singleDevice: true,
        resultsVisibility: 'after_close',
        section: { id: world.section.id, name: world.section.name },
      });
      const id = created.body.id as string;

      const list = await t.get('/api/exams');
      expect(list.body).toHaveLength(1);
      expect(list.body[0]).toMatchObject({ id, title: 'Unit test 1', started: 0, submitted: 0 });

      const patched = await t.patch(`/api/exams/${id}`).send({ title: 'Renamed', maxViolations: 5 });
      expect(patched.status).toBe(200);
      expect(patched.body).toMatchObject({ title: 'Renamed', maxViolations: 5 });

      const badWindow = await t.patch(`/api/exams/${id}`).send({ closesAt: inMin(-30) });
      expect(badWindow.status).toBe(400);
      expect(badWindow.body.error.details[0].path).toBe('closesAt');

      expect((await t.delete(`/api/exams/${id}`)).status).toBe(204);
      expect((await t.get(`/api/exams/${id}`)).status).toBe(404);
    });

    it('validates input and the section', async () => {
      const t = as(world.teacher);
      expect((await t.post('/api/exams').send(examBody(world, { closesAt: inMin(-10) }))).status).toBe(400);
      expect((await t.post('/api/exams').send(examBody(world, { durationMin: 0 }))).status).toBe(400);
      expect((await t.post('/api/exams').send({ title: 'x' })).status).toBe(400);
      const notMine = await createSection(world.institution.id, { teacherIds: [world.otherTeacher.id] });
      expect((await t.post('/api/exams').send(examBody(world, { sectionId: notMine.id }))).status).toBe(403);
    });

    it('locks a published exam against edits and deletion', async () => {
      const { id } = await publishedExam(world);
      const t = as(world.teacher);
      expect((await t.patch(`/api/exams/${id}`).send({ title: 'Nope' })).status).toBe(409);
      expect((await t.delete(`/api/exams/${id}`)).status).toBe(409);
      expect(
        (await t.put(`/api/exams/${id}/questions`).send({ questionIds: [crypto.randomUUID()] })).status,
      ).toBe(409);
    });
  });

  describe('question pool', () => {
    it("offers only the teacher's own approved questions from this section, with filters", async () => {
      const { lesson, qs } = await seedLesson(world, 3);
      await seedLesson(world, 2, { status: 'draft' });
      const second = await seedLesson(world, 2);
      await db.update(questions).set({ difficulty: 'hard' }).where(eq(questions.id, second.qs[0]!.id));
      const theirs = await seedLesson(world, 2, { teacherId: world.otherTeacher.id });
      const otherSection = await createSection(world.institution.id, { teacherIds: [world.teacher.id] });
      await seedLesson(world, 2, { sectionId: otherSection.id });

      const t = as(world.teacher);
      const id = (await t.post('/api/exams').send(examBody(world))).body.id as string;
      const pool = await t.get(`/api/exams/${id}/question-pool`);
      expect(pool.status).toBe(200);
      expect(pool.body).toHaveLength(5);
      expect(pool.body[0]).toHaveProperty('correctIndex');

      const byLesson = await t.get(`/api/exams/${id}/question-pool`).query({ lessonIds: lesson.id });
      expect(byLesson.body.map((q: { questionId: string }) => q.questionId).sort()).toEqual(
        qs.map((q) => q.id).sort(),
      );
      const hard = await t.get(`/api/exams/${id}/question-pool`).query({ difficulty: 'hard' });
      expect(hard.body.map((q: { questionId: string }) => q.questionId)).toEqual([second.qs[0]!.id]);
      const topic = await t.get(`/api/exams/${id}/question-pool`).query({ topic: 'topic 3' });
      expect(topic.body).toHaveLength(1);
      expect((await t.get(`/api/exams/${id}/question-pool`).query({ lessonIds: 'nope' })).status).toBe(400);

      const foreign = await t
        .put(`/api/exams/${id}/questions`)
        .send({ questionIds: [qs[0]!.id, theirs.qs[0]!.id] });
      expect(foreign.status).toBe(400);
      const ok = await t
        .put(`/api/exams/${id}/questions`)
        .send({ questionIds: [qs[0]!.id, qs[1]!.id, qs[0]!.id] });
      expect(ok.status).toBe(200);
      expect(ok.body).toMatchObject({ poolSize: 2, questionIds: [qs[0]!.id, qs[1]!.id] });
    });
  });

  describe('publish', () => {
    it('validates the window and the question count', async () => {
      const { qs } = await seedLesson(world, 4);
      const t = as(world.teacher);
      const id = (await t.post('/api/exams').send(examBody(world, { questionsPerStudent: 5 }))).body
        .id as string;
      expect((await t.post(`/api/exams/${id}/publish`)).status).toBe(409); // no questions
      await t.put(`/api/exams/${id}/questions`).send({ questionIds: qs.map((q) => q.id) });
      const tooMany = await t.post(`/api/exams/${id}/publish`);
      expect(tooMany.status).toBe(400);
      expect(tooMany.body.error.details[0].path).toBe('questionsPerStudent');
      await t
        .patch(`/api/exams/${id}`)
        .send({ questionsPerStudent: 4, opensAt: inMin(-120), closesAt: inMin(-60) });
      const past = await t.post(`/api/exams/${id}/publish`);
      expect(past.status).toBe(400);
      expect(past.body.error.details[0].path).toBe('closesAt');
      // A selected question that is no longer approved blocks publishing.
      await t.patch(`/api/exams/${id}`).send({ closesAt: inMin(60) });
      await db.update(questions).set({ status: 'rejected' }).where(eq(questions.id, qs[0]!.id));
      expect((await t.post(`/api/exams/${id}/publish`)).status).toBe(409);
    });

    it('snapshots the pool so later lesson changes do not affect the exam', async () => {
      const { id, exam, lesson } = await publishedExam(world, { n: 6 });
      expect(exam.status).toBe('published');
      expect(exam.accessCode).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
      expect(exam.pool).toHaveLength(6);
      expect(exam.publishedAt).not.toBeNull();
      const stems = exam.pool.map((q) => q.stem);

      await db.update(questions).set({ stem: 'Changed!' }).where(eq(questions.lessonId, lesson.id));
      await db.delete(questions).where(eq(questions.lessonId, lesson.id));
      const after = (await as(world.teacher).get(`/api/exams/${id}`)).body as ExamDetail;
      expect(after.pool.map((q) => q.stem)).toEqual(stems);
      expect(after.pool.every((q) => q.sourceQuestionId === null)).toBe(true);
      expect((await start(world.student, id, exam.accessCode)).status).toBe(201);
    });
  });

  describe('starting', () => {
    it('enforces the window, enrollment and the access code', async () => {
      const e = await publishedExam(world);
      const outsider = await createUser(world.institution.id, 'student');
      expect((await start(outsider, e.id, e.exam.accessCode)).status).toBe(404);

      await db
        .update(exams)
        .set({ opensAt: new Date(Date.now() + 60_000) })
        .where(eq(exams.id, e.id));
      const early = await start(world.student, e.id, e.exam.accessCode);
      expect(early.status).toBe(409);
      expect(early.body.error.message).toMatch(/not opened/);

      await db
        .update(exams)
        .set({ opensAt: new Date(Date.now() - 120_000), closesAt: new Date(Date.now() - 60_000) })
        .where(eq(exams.id, e.id));
      expect((await start(world.student, e.id, e.exam.accessCode)).status).toBe(409);

      await db
        .update(exams)
        .set({ closesAt: new Date(Date.now() + 3_600_000) })
        .where(eq(exams.id, e.id));
      expect((await start(world.student, e.id)).status).toBe(403);
      expect((await start(world.student, e.id, 'WRONG1')).status).toBe(403);
      const ok = await start(world.student, e.id, e.exam.accessCode!.toLowerCase());
      expect(ok.status).toBe(201);
      expect(ok.body.attemptToken).toEqual(expect.any(String));
    });

    it('caps the deadline at the closing time', async () => {
      const e = await publishedExam(world, { overrides: { closesAt: inMin(10), durationMin: 60 } });
      const s = await startOk(world.student, e);
      expect(Math.abs(Date.parse(s.paper.deadlineAt) - Date.parse(e.exam.closesAt))).toBeLessThan(1000);
    });

    it('allows one attempt per student; resuming on the same device keeps the paper', async () => {
      const e = await publishedExam(world);
      const first = await startOk(world.student, e);
      const again = await start(world.student, e.id, null, first.attemptToken);
      expect(again.status).toBe(200);
      expect(again.body.paper.attemptId).toBe(first.paper.attemptId);
      expect(again.body.paper.questions).toEqual(first.paper.questions);
      expect((await submit(world.student, e.id, first.attemptToken)).status).toBe(200);
      const after = await start(world.student, e.id, e.exam.accessCode, first.attemptToken);
      expect(after.status).toBe(409);
      expect(after.body.error.message).toMatch(/already submitted/);
      expect(await db.select().from(examAttempts)).toHaveLength(1);
    });

    it('gives students their own random papers without the answer key', async () => {
      const e = await publishedExam(world, { n: 10, per: 5 });
      const students = [world.student, world.otherStudent];
      for (let i = 0; i < 4; i++) {
        const s = await createUser(world.institution.id, 'student');
        await db.insert(enrollments).values({ sectionId: world.section.id, studentId: s.id });
        students.push(s);
      }
      const papers: string[] = [];
      for (const s of students) {
        const res = await start(s, e.id, e.exam.accessCode);
        expect(res.status).toBe(201);
        const text = JSON.stringify(res.body);
        expect(text).not.toContain('correctIndex');
        expect(text).not.toContain('explanation');
        expect(text).not.toContain('Secret explanation');
        const paper = (res.body as StartExamResponse).paper;
        expect(paper.questions).toHaveLength(5);
        expect(new Set(paper.questions.map((q) => q.examQuestionId)).size).toBe(5);
        for (const q of paper.questions) expect([...q.options].sort()).toEqual(letters);
        papers.push(JSON.stringify(paper.questions.map((q) => [q.examQuestionId, q.options])));
      }
      expect(new Set(papers).size).toBeGreaterThan(1);
    });

    it('keeps pool order and option order when shuffling is off', async () => {
      const e = await publishedExam(world, {
        n: 6,
        per: 6,
        overrides: { shuffleQuestions: false, shuffleOptions: false },
      });
      const s = await startOk(world.student, e);
      expect(s.paper.questions.map((q) => q.examQuestionId)).toEqual(e.exam.pool.map((q) => q.id));
      expect(s.paper.questions.every((q) => q.options.join('') === 'ABCD')).toBe(true);
    });
  });

  describe('answering', () => {
    it('maps the shown option to the canonical one and autosaves revisions', async () => {
      const e = await publishedExam(world);
      const s = await startOk(world.student, e);
      const q = s.paper.questions[0]!;
      const shown = 2;
      const canonical = letters.indexOf(q.options[shown]!);

      expect((await save(world.student, e.id, q.examQuestionId, shown, s.attemptToken)).status).toBe(204);
      let [row] = await db.select().from(examAnswers).where(eq(examAnswers.examQuestionId, q.examQuestionId));
      expect(row).toMatchObject({ selectedIndex: canonical, revision: 1 });

      expect((await save(world.student, e.id, q.examQuestionId, 0, s.attemptToken)).status).toBe(204);
      [row] = await db.select().from(examAnswers).where(eq(examAnswers.examQuestionId, q.examQuestionId));
      expect(row).toMatchObject({ selectedIndex: letters.indexOf(q.options[0]!), revision: 2 });

      const paper = await as(world.student)
        .get(`/api/student/exams/${e.id}/attempt`)
        .set(TOKEN, s.attemptToken);
      expect(paper.status).toBe(200);
      expect(paper.body.answers[q.examQuestionId]).toBe(0);
      expect((await attemptOf(e.id, world.student.id)).lastSeenAt).not.toBeNull();

      expect((await save(world.student, e.id, q.examQuestionId, null, s.attemptToken)).status).toBe(204);
      const cleared = await as(world.student)
        .get(`/api/student/exams/${e.id}/attempt`)
        .set(TOKEN, s.attemptToken);
      expect(cleared.body.answers[q.examQuestionId]).toBeNull();
    });

    it('rejects questions outside the paper, bad indexes and missing tokens', async () => {
      const e = await publishedExam(world, { n: 6, per: 3 });
      const s = await startOk(world.student, e);
      const inPaper = new Set(s.paper.questions.map((q) => q.examQuestionId));
      const outside = e.exam.pool.find((q) => !inPaper.has(q.id))!;
      const q = s.paper.questions[0]!.examQuestionId;
      expect((await save(world.student, e.id, outside.id, 1, s.attemptToken)).status).toBe(404);
      expect((await save(world.student, e.id, q, 4, s.attemptToken)).status).toBe(400);
      expect((await save(world.student, e.id, q, 1)).status).toBe(409);
      expect((await save(world.student, e.id, q, 1, 'forged-token')).status).toBe(409);
      expect((await as(world.student).get(`/api/student/exams/${e.id}/attempt`)).status).toBe(409);
      // Another student cannot touch this attempt (they have none).
      expect((await save(world.otherStudent, e.id, q, 1, s.attemptToken)).status).toBe(404);
    });

    it('accepts saves within the grace period and rejects them after', async () => {
      const e = await publishedExam(world);
      const s = await startOk(world.student, e);
      const q = s.paper.questions[0]!.examQuestionId;
      await db
        .update(examAttempts)
        .set({ deadlineAt: new Date(Date.now() - 10_000) })
        .where(eq(examAttempts.id, s.paper.attemptId));
      expect((await save(world.student, e.id, q, 1, s.attemptToken)).status).toBe(204);
      await db
        .update(examAttempts)
        .set({ deadlineAt: new Date(Date.now() - 31_000) })
        .where(eq(examAttempts.id, s.paper.attemptId));
      const late = await save(world.student, e.id, q, 2, s.attemptToken);
      expect(late.status).toBe(409);
      const attempt = await attemptOf(e.id, world.student.id);
      expect(attempt.status).toBe('auto_submitted');
      expect(attempt.total).toBe(3);
    });
  });

  describe('integrity', () => {
    it('counts violations and auto-submits at the limit', async () => {
      const e = await publishedExam(world, { overrides: { maxViolations: 3 } });
      const s = await startOk(world.student, e);
      const r1 = await event(world.student, e.id, 'tab_hidden', s.attemptToken);
      expect(r1.body).toEqual({ violationCount: 1, autoSubmitted: false });
      const info = await event(world.student, e.id, 'context_menu', s.attemptToken);
      expect(info.body).toEqual({ violationCount: 1, autoSubmitted: false });
      expect((await event(world.student, e.id, 'second_device', s.attemptToken)).status).toBe(400);
      expect((await event(world.student, e.id, 'bogus', s.attemptToken)).status).toBe(400);
      expect((await event(world.student, e.id, 'fullscreen_exit', s.attemptToken)).body.violationCount).toBe(
        2,
      );
      const last = await event(world.student, e.id, 'copy', s.attemptToken);
      expect(last.body).toEqual({ violationCount: 3, autoSubmitted: true });

      const attempt = await attemptOf(e.id, world.student.id);
      expect(attempt).toMatchObject({ status: 'auto_submitted', violationCount: 3 });
      expect(await db.select().from(examEvents).where(eq(examEvents.attemptId, attempt.id))).toHaveLength(4);
      expect(
        (await save(world.student, e.id, s.paper.questions[0]!.examQuestionId, 1, s.attemptToken)).status,
      ).toBe(409);
    });

    it('blocks a second device until the teacher unlocks, then rebinds', async () => {
      const e = await publishedExam(world);
      const first = await startOk(world.student, e);
      const second = await start(world.student, e.id, e.exam.accessCode);
      expect(second.status).toBe(409);
      expect(second.body.error).toMatchObject({
        code: 'CONFLICT',
        message: 'This exam is open on another device. Ask your teacher to unlock it.',
      });
      const events = await db
        .select()
        .from(examEvents)
        .where(eq(examEvents.attemptId, first.paper.attemptId));
      expect(events.map((x) => x.type)).toContain('second_device');

      const t = as(world.teacher);
      const mon = (await t.get(`/api/exams/${e.id}/monitor`)).body as ExamMonitor;
      const row = mon.rows.find((r) => r.student.id === world.student.id)!;
      expect(row).toMatchObject({ deviceLocked: true, violationCount: 1, status: 'in_progress' });

      const unlocked = await t.post(`/api/exams/${e.id}/attempts/${row.attemptId}/unlock`);
      expect(unlocked.status).toBe(200);
      expect(unlocked.body.deviceLocked).toBe(false);
      expect(
        (await as(world.student).get(`/api/student/exams/${e.id}/attempt`).set(TOKEN, first.attemptToken))
          .status,
      ).toBe(409);

      expect((await start(world.student, e.id, 'WRONG1')).status).toBe(403);
      const rebound = await start(world.student, e.id, e.exam.accessCode);
      expect(rebound.status).toBe(200);
      const token = rebound.body.attemptToken as string;
      expect(token).not.toBe(first.attemptToken);
      expect(rebound.body.paper.questions).toEqual(first.paper.questions);
      expect(
        (await as(world.student).get(`/api/student/exams/${e.id}/attempt`).set(TOKEN, token)).status,
      ).toBe(200);
      expect(
        (await as(world.student).get(`/api/student/exams/${e.id}/attempt`).set(TOKEN, first.attemptToken))
          .status,
      ).toBe(409);
    });

    it('lets any of the student devices resume when one-device mode is off', async () => {
      const e = await publishedExam(world, { overrides: { singleDevice: false, useAccessCode: false } });
      const first = await startOk(world.student, e);
      const second = await start(world.student, e.id);
      expect(second.status).toBe(200);
      expect(second.body.attemptToken).toBe(first.attemptToken);
    });
  });

  describe('teacher interventions', () => {
    it('adds extra time to the deadline', async () => {
      const e = await publishedExam(world);
      const s = await startOk(world.student, e);
      const t = as(world.teacher);
      const url = `/api/exams/${e.id}/attempts/${s.paper.attemptId}/extra-time`;
      expect((await t.post(url).send({ minutes: 0 })).status).toBe(400);
      expect((await as(world.otherTeacher).post(url).send({ minutes: 10 })).status).toBe(404);
      const res = await t.post(url).send({ minutes: 10 });
      expect(res.status).toBe(200);
      expect(res.body.extraMinutes).toBe(10);
      expect(Date.parse(res.body.deadlineAt) - Date.parse(s.paper.deadlineAt)).toBe(10 * 60_000);
      const paper = await as(world.student)
        .get(`/api/student/exams/${e.id}/attempt`)
        .set(TOKEN, s.attemptToken);
      expect(paper.body.deadlineAt).toBe(res.body.deadlineAt);
    });

    it('force-submits an attempt and closes the exam (submitting running attempts)', async () => {
      const e = await publishedExam(world);
      const a = await startOk(world.student, e);
      const b = await startOk(world.otherStudent, e);
      const t = as(world.teacher);
      const forced = await t.post(`/api/exams/${e.id}/attempts/${a.paper.attemptId}/force-submit`);
      expect(forced.status).toBe(200);
      expect(forced.body).toMatchObject({ status: 'auto_submitted', scorePct: 0 });
      expect((await t.post(`/api/exams/${e.id}/attempts/${a.paper.attemptId}/force-submit`)).status).toBe(
        409,
      );
      expect(
        (await save(world.student, e.id, a.paper.questions[0]!.examQuestionId, 1, a.attemptToken)).status,
      ).toBe(409);

      const closed = await t.post(`/api/exams/${e.id}/close`);
      expect(closed.status).toBe(200);
      expect(closed.body.status).toBe('closed');
      expect((await attemptOf(e.id, world.otherStudent.id)).status).toBe('auto_submitted');
      expect((await submit(world.otherStudent, e.id, b.attemptToken)).body.status).toBe('auto_submitted');
    });

    it('rotates the access code', async () => {
      const e = await publishedExam(world);
      let code = e.exam.accessCode;
      for (let i = 0; i < 3 && code === e.exam.accessCode; i++) {
        code = (await as(world.teacher).post(`/api/exams/${e.id}/rotate-code`)).body.accessCode;
      }
      expect(code).not.toBe(e.exam.accessCode);
      expect((await start(world.student, e.id, e.exam.accessCode)).status).toBe(403);
      expect((await start(world.student, e.id, code)).status).toBe(201);
    });
  });

  describe('sweep', () => {
    it('auto-submits expired attempts and closes exams past their closing time', async () => {
      const e = await publishedExam(world);
      const a = await startOk(world.student, e);
      await startOk(world.otherStudent, e);
      const correct = correctShown(e.exam, a);
      const q0 = a.paper.questions[0]!.examQuestionId;
      await save(world.student, e.id, q0, correct.get(q0)!, a.attemptToken);
      await db
        .update(examAttempts)
        .set({ deadlineAt: new Date(Date.now() - 60_000) })
        .where(eq(examAttempts.id, a.paper.attemptId));

      expect(await sweepExams()).toEqual({ autoSubmitted: 1, closed: 0 });
      expect(await attemptOf(e.id, world.student.id)).toMatchObject({
        status: 'auto_submitted',
        correct: 1,
        total: 3,
        scorePct: 33.3,
      });

      // Closing time passes: the exam closes, but an attempt with time left keeps running.
      await db
        .update(exams)
        .set({ closesAt: new Date(Date.now() - 1000) })
        .where(eq(exams.id, e.id));
      expect(await sweepExams()).toEqual({ autoSubmitted: 0, closed: 1 });
      const [row] = await db.select().from(exams).where(eq(exams.id, e.id));
      expect(row).toMatchObject({ status: 'closed' });
      expect(row!.closedAt).not.toBeNull();
      expect((await attemptOf(e.id, world.otherStudent.id)).status).toBe('in_progress');
      expect(await sweepExams()).toEqual({ autoSubmitted: 0, closed: 0 });
    });
  });

  describe('grading and results visibility', () => {
    async function answerTwoOfThree(e: Awaited<ReturnType<typeof publishedExam>>, user: Actor) {
      const s = await startOk(user, e);
      const correct = correctShown(e.exam, s);
      const [q1, q2, q3] = s.paper.questions;
      await save(user, e.id, q1!.examQuestionId, correct.get(q1!.examQuestionId)!, s.attemptToken);
      await save(user, e.id, q2!.examQuestionId, correct.get(q2!.examQuestionId)!, s.attemptToken);
      await save(user, e.id, q3!.examQuestionId, (correct.get(q3!.examQuestionId)! + 1) % 4, s.attemptToken);
      return s;
    }

    it('grades on the server and shows results immediately when allowed', async () => {
      const e = await publishedExam(world, { n: 3, per: 3, overrides: { resultsVisibility: 'immediately' } });
      const s = await answerTwoOfThree(e, world.student);
      const res = await submit(world.student, e.id, s.attemptToken);
      expect(res.status).toBe(200);
      const result = res.body as StudentExamResult;
      expect(result).toMatchObject({ status: 'submitted', score: { correct: 2, total: 3, scorePct: 66.7 } });
      expect(result.answers).toHaveLength(3);
      expect(result.answers!.filter((x) => x.isCorrect)).toHaveLength(2);
      for (const [i, a] of result.answers!.entries()) {
        expect(a.options).toEqual(s.paper.questions[i]!.options);
        expect(a.explanation).toBe('Secret explanation');
      }
      expect(result.answers![0]!.selectedIndex).toBe(result.answers![0]!.correctIndex);

      const again = await submit(world.student, e.id, s.attemptToken);
      expect(again.body.score).toEqual(result.score);
      expect(again.body.submittedAt).toBe(result.submittedAt);

      const list = (await as(world.student).get('/api/student/exams')).body as StudentExamListItem[];
      expect(list[0]).toMatchObject({ state: 'submitted', result: { correct: 2, total: 3 } });
    });

    it('hides results until the exam closes (after_close)', async () => {
      const e = await publishedExam(world, { n: 3, per: 3 });
      const s = await answerTwoOfThree(e, world.student);
      const res = await submit(world.student, e.id, s.attemptToken);
      expect(res.body).toMatchObject({
        status: 'submitted',
        score: null,
        answers: null,
        resultsAvailableAt: e.exam.closesAt,
      });
      expect(JSON.stringify(res.body)).not.toContain('Secret explanation');
      expect(
        ((await as(world.student).get('/api/student/exams')).body as StudentExamListItem[])[0]!.result,
      ).toBeNull();

      await as(world.teacher).post(`/api/exams/${e.id}/close`);
      const after = await as(world.student).get(`/api/student/exams/${e.id}/result`);
      expect(after.body.score).toEqual({ correct: 2, total: 3, scorePct: 66.7 });
      expect(after.body.answers).toHaveLength(3);
    });

    it('never shows results when hidden', async () => {
      const e = await publishedExam(world, { n: 3, per: 3, overrides: { resultsVisibility: 'never' } });
      const s = await answerTwoOfThree(e, world.student);
      await submit(world.student, e.id, s.attemptToken);
      await as(world.teacher).post(`/api/exams/${e.id}/close`);
      const res = await as(world.student).get(`/api/student/exams/${e.id}/result`);
      expect(res.body).toMatchObject({ score: null, answers: null, resultsAvailableAt: null });
      // The teacher still sees the grade.
      const results = (await as(world.teacher).get(`/api/exams/${e.id}/results`)).body as ExamResults;
      expect(results.students.find((x) => x.student.id === world.student.id)).toMatchObject({
        correct: 2,
        scorePct: 66.7,
      });
    });

    it('returns 404 for a result without an attempt', async () => {
      const e = await publishedExam(world);
      expect((await as(world.student).get(`/api/student/exams/${e.id}/result`)).status).toBe(404);
    });
  });

  describe('student list', () => {
    it('reports upcoming, open, in-progress, submitted and missed exams', async () => {
      const open = await publishedExam(world, { overrides: { title: 'Open', useAccessCode: false } });
      const upcoming = await publishedExam(world, {
        overrides: { title: 'Upcoming', opensAt: inMin(60), closesAt: inMin(120) },
      });
      const running = await publishedExam(world, { overrides: { title: 'Running' } });
      const done = await publishedExam(world, { overrides: { title: 'Done' } });
      const missed = await publishedExam(world, { overrides: { title: 'Missed' } });
      await startOk(world.student, running);
      const d = await startOk(world.student, done);
      await submit(world.student, done.id, d.attemptToken);
      await as(world.teacher).post(`/api/exams/${missed.id}/close`);
      const draft = await as(world.teacher)
        .post('/api/exams')
        .send(examBody(world, { title: 'Draft' }));
      expect(draft.status).toBe(201);

      const list = (await as(world.student).get('/api/student/exams')).body as StudentExamListItem[];
      const state = Object.fromEntries(list.map((x) => [x.title, x.state]));
      expect(state).toEqual({
        Open: 'open',
        Upcoming: 'upcoming',
        Running: 'in_progress',
        Done: 'submitted',
        Missed: 'missed',
      });
      const item = list.find((x) => x.id === open.id)!;
      expect(item).toMatchObject({
        requiresAccessCode: false,
        requireFullscreen: true,
        questionCount: 3,
        teacherName: world.teacher.name,
      });
      expect(list.find((x) => x.id === upcoming.id)!.requiresAccessCode).toBe(true);
    });
  });

  describe('monitor and results', () => {
    it('lists every enrolled student, including those who have not started', async () => {
      const e = await publishedExam(world);
      const s = await startOk(world.student, e);
      await save(world.student, e.id, s.paper.questions[0]!.examQuestionId, 1, s.attemptToken);
      const mon = await as(world.teacher).get(`/api/exams/${e.id}/monitor`);
      expect(mon.status).toBe(200);
      const body = mon.body as ExamMonitor;
      expect(body.serverTime).toEqual(expect.any(Number));
      expect(body.exam.accessCode).toBe(e.exam.accessCode);
      expect(body.rows).toHaveLength(2);
      expect(body.rows.find((r) => r.student.id === world.student.id)).toMatchObject({
        status: 'in_progress',
        answered: 1,
        total: 3,
        deviceLocked: true,
      });
      expect(body.rows.find((r) => r.student.id === world.otherStudent.id)).toMatchObject({
        status: 'not_started',
        attemptId: null,
        answered: 0,
        total: 3,
        deviceLocked: false,
      });
    });

    it('reports scores, per-question accuracy, the integrity timeline and a CSV', async () => {
      const e = await publishedExam(world, { n: 3, per: 3 });
      await db.update(questions).set({ stem: '=cmd|calc' }).where(eq(questions.lessonId, e.lesson.id)); // after snapshot: no effect
      const s = await startOk(world.student, e);
      const correct = correctShown(e.exam, s);
      for (const q of s.paper.questions)
        await save(world.student, e.id, q.examQuestionId, correct.get(q.examQuestionId)!, s.attemptToken);
      await event(world.student, e.id, 'tab_hidden', s.attemptToken);
      await event(world.student, e.id, 'paste', s.attemptToken);
      await submit(world.student, e.id, s.attemptToken);

      const res = await as(world.teacher).get(`/api/exams/${e.id}/results`);
      expect(res.status).toBe(200);
      const r = res.body as ExamResults;
      expect(r.averageScorePct).toBe(100);
      const mine = r.students.find((x) => x.student.id === world.student.id)!;
      expect(mine).toMatchObject({ status: 'submitted', correct: 3, scorePct: 100, violationCount: 2 });
      expect(mine.events.map((x) => x.type)).toEqual(['tab_hidden', 'paste']);
      expect(r.students.find((x) => x.student.id === world.otherStudent.id)).toMatchObject({
        status: 'not_started',
        correct: null,
        events: [],
      });
      expect(r.questions).toHaveLength(3);
      for (const q of r.questions) {
        expect(q).toMatchObject({ served: 1, answered: 1, accuracyPct: 100 });
        expect(q.optionDistribution[q.correctIndex]).toBe(1);
      }

      await db.update(examAttempts).set({ violationCount: 2 }).where(eq(examAttempts.id, s.paper.attemptId));
      const csv = await as(world.teacher).get(`/api/exams/${e.id}/results.csv`);
      expect(csv.status).toBe(200);
      expect(csv.headers['content-type']).toMatch(/text\/csv/);
      expect(csv.headers['content-disposition']).toContain('unit-test-1-results.csv');
      const lines = csv.text.trim().split(/\r\n/);
      expect(lines[0]).toBe(
        'Name,Roll number,Status,Answered,Questions,Correct,Score %,Violations,Extra minutes,Started at,Submitted at',
      );
      expect(lines).toHaveLength(3);
      expect(lines.find((l) => l.startsWith(world.student.name))).toContain(',Submitted,3,3,3,100,2,0,');
      expect(lines.find((l) => l.startsWith(world.otherStudent.name))).toContain(',Not started,');
      expect((await as(world.student).get(`/api/exams/${e.id}/results.csv`)).status).toBe(403);
    });

    it('neutralises spreadsheet formulas in the CSV', async () => {
      const e = await publishedExam(world);
      const evil = await createUser(world.institution.id, 'student', { name: '=HYPERLINK("x")' });
      await db.insert(enrollments).values({ sectionId: world.section.id, studentId: evil.id });
      const csv = await as(world.teacher).get(`/api/exams/${e.id}/results.csv`);
      expect(csv.text).toContain(`"'=HYPERLINK(""x"")"`);
    });
  });
});
