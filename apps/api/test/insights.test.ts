/** GET /api/insights/sections/:sectionId — Bloom-level and topic mastery per student and for the class. */
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import type { SectionInsights } from '@classiq/shared';
import { db } from '../src/db/client.js';
import { examAnswers, examAttempts, examQuestions, exams, questions } from '../src/db/schema/index.js';
import { anon, as, createSection, createUser, createWorld } from './helpers.js';
import { insertAttempt, insertLesson, insertQuestions } from './fixtures/lessons.js';

type World = Awaited<ReturnType<typeof createWorld>>;

async function taggedLesson(world: World, sectionId = world.section.id) {
  const lesson = await insertLesson({ institutionId: world.institution.id, teacherId: world.teacher.id, sectionId, status: 'published' });
  const qs = await insertQuestions(lesson.id, 4, 'approved');
  const tags = [
    { bloomLevel: 'remember', topicTag: 'Products', competency: 'Naming products' },
    { bloomLevel: 'remember', topicTag: 'Products', competency: 'Naming products' },
    { bloomLevel: 'apply', topicTag: 'Light', competency: 'Using light' },
    // No topic tag: the competency is used as the topic.
    { bloomLevel: 'analyze', topicTag: null, competency: 'Comparing ideas' },
  ] as const;
  for (const [i, q] of qs.entries()) await db.update(questions).set(tags[i]!).where(eq(questions.id, q.id));
  return { lesson, qs };
}

/** Answer indices: correct = q.correctIndex, wrong = the next option. */
const pick = (qs: { correctIndex: number }[], right: boolean[]) => qs.map((q, i) => (right[i] ? q.correctIndex : (q.correctIndex + 1) % 4));

async function publishedExamWithAttempt(world: World, studentId: string, answers: (number | null)[]) {
  const [exam] = await db
    .insert(exams)
    .values({
      institutionId: world.institution.id,
      teacherId: world.teacher.id,
      sectionId: world.section.id,
      title: 'Exam',
      opensAt: new Date(Date.now() - 3600_000),
      closesAt: new Date(Date.now() + 3600_000),
      durationMin: 30,
      questionsPerStudent: 2,
      status: 'published',
    })
    .returning();
  const eqs = await db
    .insert(examQuestions)
    .values([
      { examId: exam!.id, position: 1, stem: 'E1', options: ['a', 'b', 'c', 'd'], correctIndex: 2, difficulty: 'easy', topicTag: 'light' },
      { examId: exam!.id, position: 2, stem: 'E2', options: ['a', 'b', 'c', 'd'], correctIndex: 1, difficulty: 'hard', topicTag: 'Optics' },
    ])
    .returning();
  const [attempt] = await db
    .insert(examAttempts)
    .values({
      examId: exam!.id,
      studentId,
      status: 'submitted',
      deadlineAt: new Date(Date.now() + 1800_000),
      submittedAt: new Date(),
      paper: eqs.map((q) => ({ examQuestionId: q.id, optionOrder: [0, 1, 2, 3] })),
    })
    .returning();
  const rows = eqs
    .map((q, i) => ({ attemptId: attempt!.id, examQuestionId: q.id, selectedIndex: answers[i] ?? null }))
    .filter((r) => r.selectedIndex !== null);
  if (rows.length) await db.insert(examAnswers).values(rows);
}

describe('competency insights', () => {
  it('aggregates latest quiz attempts and exam answers by Bloom level and topic', async () => {
    const world = await createWorld();
    const { lesson, qs } = await taggedLesson(world);
    const a = world.student;
    const b = world.otherStudent;
    // A's first attempt (all wrong) is superseded by the latest one.
    await insertAttempt(lesson.id, a.id, qs, pick(qs, [false, false, false, false]), new Date(Date.now() - 86400_000));
    await insertAttempt(lesson.id, a.id, qs, pick(qs, [true, false, true, false]));
    await insertAttempt(lesson.id, b.id, qs, pick(qs, [true, true, false, false]));
    // Exam: A gets E1 right and leaves E2 unanswered (counts as wrong).
    await publishedExamWithAttempt(world, a.id, [2, null]);
    // Noise: a student who is not enrolled any more, and another section's lesson.
    const leaver = await createUser(world.institution.id, 'student');
    await insertAttempt(lesson.id, leaver.id, qs, pick(qs, [true, true, true, true]));
    const otherSection = await createSection(world.institution.id, { teacherIds: [world.teacher.id], studentIds: [a.id] });
    const other = await taggedLesson(world, otherSection.id);
    await insertAttempt(other.lesson.id, a.id, other.qs, pick(other.qs, [true, true, true, true]));

    const res = await as(world.teacher).get(`/api/insights/sections/${world.section.id}`);
    expect(res.status).toBe(200);
    const body = res.body as SectionInsights;
    expect(body.section).toEqual({ id: world.section.id, name: world.section.name });

    expect(body.byBloom).toEqual({ remember: 75, understand: null, apply: 50, analyze: 0, evaluate: null, create: null });
    // Weakest first; "light" (exam) merges into "Light" (quiz).
    expect(body.byTopic).toEqual([
      { topic: 'Comparing ideas', accuracyPct: 0, answered: 2 },
      { topic: 'Optics', accuracyPct: 0, answered: 1 },
      { topic: 'Light', accuracyPct: 66.7, answered: 3 },
      { topic: 'Products', accuracyPct: 75, answered: 4 },
    ]);

    expect(body.students).toHaveLength(2);
    const rowA = body.students.find((s) => s.student.id === a.id)!;
    const rowB = body.students.find((s) => s.student.id === b.id)!;
    expect(rowA.byBloom).toMatchObject({ remember: 50, apply: 100, analyze: 0, understand: null });
    expect(rowA.byTopic).toEqual({ 'Comparing ideas': 0, Optics: 0, Light: 100, Products: 50 });
    expect(rowA.overallPct).toBe(50); // 2/4 quiz + 1/2 exam
    expect(rowB.byBloom).toMatchObject({ remember: 100, apply: 0, analyze: 0 });
    expect(rowB.byTopic).toEqual({ 'Comparing ideas': 0, Optics: null, Light: 0, Products: 100 });
    expect(rowB.overallPct).toBe(50);
  });

  it('lists enrolled students with no data as nulls', async () => {
    const world = await createWorld();
    const res = await as(world.teacher).get(`/api/insights/sections/${world.section.id}`);
    expect(res.status).toBe(200);
    const body = res.body as SectionInsights;
    expect(body.byTopic).toEqual([]);
    expect(body.students).toHaveLength(2);
    expect(body.students[0]).toMatchObject({ overallPct: null, byTopic: {} });
    expect(body.students[0]!.byBloom.remember).toBeNull();
  });

  it('only shows sections the teacher teaches', async () => {
    const world = await createWorld();
    const url = `/api/insights/sections/${world.section.id}`;
    expect((await anon().get(url)).status).toBe(401);
    expect((await as(world.student).get(url)).status).toBe(403);
    expect((await as(world.admin).get(url)).status).toBe(403);
    expect((await as(world.otherTeacher).get(url)).status).toBe(404);
    expect((await as(world.teacher).get('/api/insights/sections/not-a-uuid')).status).toBe(400);
  });
});
