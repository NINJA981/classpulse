import { afterEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '../src/db/client.js';
import { lessons } from '../src/db/schema/index.js';
import { PipelineError } from '../src/pipeline/errors.js';
import { setPipelineProvidersForTests } from '../src/pipeline/providers.js';
import { as, createUser, createWorld } from './helpers.js';
import { insertAttempt, insertLesson, insertQuestions } from './fixtures/lessons.js';

afterEach(() => setPipelineProvidersForTests(null));

async function publishedWithAttempts() {
  const w = await createWorld();
  const third = await createUser(w.institution.id, 'student', { name: 'Zed' });
  const lesson = await insertLesson({ institutionId: w.institution.id, teacherId: w.teacher.id, sectionId: w.section.id, status: 'published' });
  // correctIndex: q1=0, q2=1
  const qs = await insertQuestions(lesson.id, 2, 'approved');
  await insertQuestions(lesson.id, 1, 'rejected');
  const t0 = Date.now() - 60_000;
  // student: first attempt 0/2, latest attempt 2/2 -> only the latest counts
  await insertAttempt(lesson.id, w.student.id, qs, [3, 3], new Date(t0));
  await insertAttempt(lesson.id, w.student.id, qs, [0, 1], new Date(t0 + 10_000));
  // otherStudent: 1/2 (q1 correct, q2 picked option 2)
  await insertAttempt(lesson.id, w.otherStudent.id, qs, [0, 2], new Date(t0 + 20_000));
  // third (not enrolled but attempted): 0/2, q2 skipped
  await insertAttempt(lesson.id, third.id, qs, [1, null], new Date(t0 + 30_000));
  return { w, lesson, qs };
}

describe('lesson analytics', () => {
  it('uses each student latest attempt for accuracy, distribution and averages', async () => {
    const { w, lesson, qs } = await publishedWithAttempts();
    const res = await as(w.teacher).get(`/api/lessons/${lesson.id}/analytics`);
    expect(res.status).toBe(200);
    const a = res.body;
    expect(a.enrolledStudents).toBe(2);
    expect(a.studentsAttempted).toBe(3);
    expect(a.averageScorePct).toBeCloseTo((100 + 50 + 0) / 3, 1);
    expect(a.questions).toHaveLength(2); // rejected question excluded
    expect(a.questions[0]).toMatchObject({
      questionId: qs[0]!.id,
      attempts: 3,
      correct: 2,
      accuracyPct: 66.7,
      band: 'moderate',
      optionDistribution: [2, 1, 0, 0],
    });
    expect(a.questions[1]).toMatchObject({ attempts: 3, correct: 1, accuracyPct: 33.3, band: 'critical', optionDistribution: [0, 1, 1, 0] });
    expect(a.students.map((s: { scorePct: number }) => s.scorePct).sort()).toEqual([0, 100, 50].sort());
    expect(a.remedial).toBeNull();

    expect((await as(w.admin).get(`/api/lessons/${lesson.id}/analytics`)).status).toBe(200);
    expect((await as(w.otherTeacher).get(`/api/lessons/${lesson.id}/analytics`)).status).toBe(404);
    expect((await as(w.student).get(`/api/lessons/${lesson.id}/analytics`)).status).toBe(403);
  });

  it('lists every attempt', async () => {
    const { w, lesson } = await publishedWithAttempts();
    const res = await as(w.teacher).get(`/api/lessons/${lesson.id}/attempts`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(4);
    expect(res.body[0]).toMatchObject({ studentName: 'Zed', correct: 0, total: 2 });
  });

  it('generates and caches a remedial plan; 409 without attempts; upstream errors are sanitized', async () => {
    const { w, lesson } = await publishedWithAttempts();
    let received: number | null = null;
    setPipelineProvidersForTests({
      remedial: async (input) => {
        received = input.analytics.studentsAttempted;
        return { generatedAt: new Date().toISOString(), summary: 'Reteach products', actions: [{ topic: 'Topic 2', recommendation: 'Demo' }] };
      },
    });
    const res = await as(w.teacher).post(`/api/lessons/${lesson.id}/analytics/remedial`);
    expect(res.status).toBe(200);
    expect(res.body.summary).toBe('Reteach products');
    expect(received).toBe(3);
    const row = await db.query.lessons.findFirst({ where: eq(lessons.id, lesson.id) });
    expect(row!.remedial?.summary).toBe('Reteach products');
    expect((await as(w.teacher).get(`/api/lessons/${lesson.id}/analytics`)).body.remedial.summary).toBe('Reteach products');
    expect((await as(w.admin).post(`/api/lessons/${lesson.id}/analytics/remedial`)).status).toBe(403);

    setPipelineProvidersForTests({
      remedial: async () => {
        throw new PipelineError('openai:chat failed with HTTP 500 body=secret', { retryable: true, userMessage: 'AI is unavailable' });
      },
    });
    const failed = await as(w.teacher).post(`/api/lessons/${lesson.id}/analytics/remedial`);
    expect(failed.status).toBe(502);
    expect(failed.body.error.message).toBe('AI is unavailable');

    const empty = await insertLesson({ institutionId: w.institution.id, teacherId: w.teacher.id, sectionId: w.section.id, status: 'published' });
    expect((await as(w.teacher).post(`/api/lessons/${empty.id}/analytics/remedial`)).status).toBe(409);
  });
});
