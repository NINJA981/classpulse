import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../src/db/client.js';
import { lessons, questions, quizAttemptAnswers, quizAttempts } from '../src/db/schema/index.js';
import { as, createSection, createWorld } from './helpers.js';

type World = Awaited<ReturnType<typeof createWorld>>;

/** Lessons module is owned elsewhere — insert fixtures directly. */
async function createLessonWithQuestions(
  world: World,
  opts: { sectionId?: string; status?: 'published' | 'ready_for_review' } = {},
) {
  const [lesson] = await db
    .insert(lessons)
    .values({
      institutionId: world.institution.id,
      teacherId: world.teacher.id,
      sectionId: opts.sectionId ?? world.section.id,
      title: 'Photosynthesis',
      subject: 'Science',
      status: opts.status ?? 'published',
      publishedAt: new Date(),
      summary: 'Plants make food.',
      keyTakeaways: ['Chlorophyll absorbs light'],
    })
    .returning();
  const q = (position: number, correctIndex: number, status: 'approved' | 'draft' | 'rejected' = 'approved') => ({
    lessonId: lesson!.id,
    position,
    stem: `Question ${position}?`,
    options: ['A', 'B', 'C', 'D'],
    correctIndex,
    explanation: `Because ${position}`,
    citationStartSec: position * 10,
    citationEndSec: position * 10 + 5,
    status,
  });
  const qs = await db
    .insert(questions)
    .values([q(2, 1), q(1, 0), q(3, 3), q(4, 2, 'draft'), q(5, 2, 'rejected')])
    .returning();
  const byPos = (p: number) => qs.find((x) => x.position === p)!;
  return { lesson: lesson!, q1: byPos(1), q2: byPos(2), q3: byPos(3), draft: byPos(4), rejected: byPos(5) };
}

describe('student quizzes', () => {
  let world: World;
  beforeEach(async () => {
    world = await createWorld();
  });

  it('lists published quizzes of my sections only', async () => {
    const { lesson } = await createLessonWithQuestions(world);
    await createLessonWithQuestions(world, { status: 'ready_for_review' });
    const otherSection = await createSection(world.institution.id, { teacherIds: [world.teacher.id] });
    await createLessonWithQuestions(world, { sectionId: otherSection.id });

    const res = await as(world.student).get('/api/student/quizzes');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({
      lessonId: lesson.id,
      section: { id: world.section.id },
      teacherName: world.teacher.name,
      questionCount: 3,
      latestAttempt: null,
    });
  });

  it('serves the quiz without an answer key, approved questions only, in order', async () => {
    const { lesson } = await createLessonWithQuestions(world);
    const res = await as(world.student).get(`/api/student/quizzes/${lesson.id}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ lessonId: lesson.id, summary: 'Plants make food.', keyTakeaways: ['Chlorophyll absorbs light'] });
    expect(res.body.questions.map((q: { position: number }) => q.position)).toEqual([1, 2, 3]);
    const text = JSON.stringify(res.body);
    expect(text).not.toContain('correctIndex');
    expect(text).not.toContain('explanation');
    expect(text).not.toContain('citation');
    expect(Object.keys(res.body.questions[0]).sort()).toEqual(
      ['difficulty', 'id', 'options', 'optionsLocal', 'position', 'stem', 'stemLocal'].sort(),
    );
  });

  it('hides unpublished lessons and lessons of other sections (404)', async () => {
    const draft = await createLessonWithQuestions(world, { status: 'ready_for_review' });
    const otherSection = await createSection(world.institution.id, { teacherIds: [world.teacher.id] });
    const foreign = await createLessonWithQuestions(world, { sectionId: otherSection.id });
    for (const id of [draft.lesson.id, foreign.lesson.id, randomUUID()]) {
      expect((await as(world.student).get(`/api/student/quizzes/${id}`)).status).toBe(404);
      const submit = await as(world.student)
        .post(`/api/student/quizzes/${id}/attempts`)
        .send({ idempotencyKey: randomUUID(), answers: [{ questionId: draft.q1.id, selectedIndex: 0 }] });
      expect(submit.status).toBe(404);
    }
    expect((await as(world.student).get('/api/student/quizzes/not-a-uuid')).status).toBe(400);
  });

  it('grades server-side, counting missing answers as wrong, and stores snapshots', async () => {
    const { lesson, q1, q2, q3 } = await createLessonWithQuestions(world);
    const res = await as(world.student)
      .post(`/api/student/quizzes/${lesson.id}/attempts`)
      .send({
        idempotencyKey: randomUUID(),
        answers: [
          { questionId: q1.id, selectedIndex: 0 }, // correct
          { questionId: q2.id, selectedIndex: 3 }, // wrong
          // q3 omitted -> unanswered
        ],
      });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ lessonId: lesson.id, correct: 1, total: 3, scorePct: 33.3 });
    expect(res.body.answers).toHaveLength(3);
    expect(res.body.answers[0]).toMatchObject({
      questionId: q1.id,
      selectedIndex: 0,
      correctIndex: 0,
      isCorrect: true,
      explanation: 'Because 1',
      citationStartSec: 10,
      citationEndSec: 15,
      difficulty: 'medium',
    });
    expect(res.body.answers[1]).toMatchObject({ questionId: q2.id, selectedIndex: 3, correctIndex: 1, isCorrect: false });
    expect(res.body.answers[2]).toMatchObject({ questionId: q3.id, selectedIndex: null, correctIndex: 3, isCorrect: false });

    const stored = await db.select().from(quizAttemptAnswers).where(eq(quizAttemptAnswers.attemptId, res.body.id));
    expect(stored).toHaveLength(3);
    expect(stored.every((a) => a.stemSnapshot.startsWith('Question'))).toBe(true);

    const latest = await as(world.student).get(`/api/student/quizzes/${lesson.id}/attempts/latest`);
    expect(latest.status).toBe(200);
    expect(latest.body).toEqual(res.body);

    const list = await as(world.student).get('/api/student/quizzes');
    expect(list.body[0].latestAttempt).toMatchObject({ id: res.body.id, scorePct: 33.3 });
  });

  it('rejects unknown, draft and duplicate question ids', async () => {
    const { lesson, q1, draft } = await createLessonWithQuestions(world);
    const send = (answers: { questionId: string; selectedIndex: number | null }[]) =>
      as(world.student).post(`/api/student/quizzes/${lesson.id}/attempts`).send({ idempotencyKey: randomUUID(), answers });
    expect((await send([{ questionId: randomUUID(), selectedIndex: 0 }])).status).toBe(400);
    expect((await send([{ questionId: draft.id, selectedIndex: 0 }])).status).toBe(400);
    expect((await send([{ questionId: q1.id, selectedIndex: 0 }, { questionId: q1.id, selectedIndex: 1 }])).status).toBe(400);
    expect((await send([{ questionId: q1.id, selectedIndex: 7 }])).status).toBe(400);
    expect(await db.select().from(quizAttempts)).toHaveLength(0);
  });

  it('is idempotent per key, including concurrent double-submits', async () => {
    const { lesson, q1, q2 } = await createLessonWithQuestions(world);
    const key = randomUUID();
    const body = { idempotencyKey: key, answers: [{ questionId: q1.id, selectedIndex: 0 }] };
    const url = `/api/student/quizzes/${lesson.id}/attempts`;

    const [a, b] = await Promise.all([as(world.student).post(url).send(body), as(world.student).post(url).send(body)]);
    expect([a.status, b.status].sort()).toEqual([200, 201]);
    expect(a.body).toEqual(b.body);

    // A resubmission with different answers still returns the original result.
    const again = await as(world.student)
      .post(url)
      .send({ idempotencyKey: key, answers: [{ questionId: q2.id, selectedIndex: 1 }] });
    expect(again.status).toBe(200);
    expect(again.body).toEqual(a.body);
    expect(await db.select().from(quizAttempts)).toHaveLength(1);

    // The same key from another student is independent.
    const other = await as(world.otherStudent).post(url).send(body);
    expect(other.status).toBe(201);
    expect(other.body.id).not.toBe(a.body.id);
  });

  it('latest attempt is 404 before any attempt and per-student', async () => {
    const { lesson, q1 } = await createLessonWithQuestions(world);
    expect((await as(world.student).get(`/api/student/quizzes/${lesson.id}/attempts/latest`)).status).toBe(404);
    await as(world.otherStudent)
      .post(`/api/student/quizzes/${lesson.id}/attempts`)
      .send({ idempotencyKey: randomUUID(), answers: [{ questionId: q1.id, selectedIndex: 0 }] });
    expect((await as(world.student).get(`/api/student/quizzes/${lesson.id}/attempts/latest`)).status).toBe(404);
  });
});
