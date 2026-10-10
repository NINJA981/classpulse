import { describe, expect, it } from 'vitest';
import { asc, eq } from 'drizzle-orm';
import { db } from '../src/db/client.js';
import { questions } from '../src/db/schema/index.js';
import { anon, as, createWorld } from './helpers.js';
import { insertLesson, insertQuestions } from './fixtures/lessons.js';

async function reviewLesson(status: 'ready_for_review' | 'published' | 'generating' = 'ready_for_review') {
  const w = await createWorld();
  const lesson = await insertLesson({ institutionId: w.institution.id, teacherId: w.teacher.id, sectionId: w.section.id, status });
  const qs = await insertQuestions(lesson.id, 3);
  return { w, lesson, qs };
}

const validQuestion = {
  stem: 'What do plants release?',
  options: ['Oxygen', 'Nitrogen', 'Helium', 'Argon'],
  correctIndex: 0,
  explanation: 'Said in class',
  difficulty: 'easy',
};

describe('questions', () => {
  it('edits a question and marks it edited by teacher without resetting other fields', async () => {
    const { w, qs } = await reviewLesson();
    await db.update(questions).set({ difficulty: 'hard' }).where(eq(questions.id, qs[0]!.id));
    const res = await as(w.teacher).patch(`/api/questions/${qs[0]!.id}`).send({ stem: 'Edited stem?', correctIndex: 2 });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ stem: 'Edited stem?', correctIndex: 2, editedByTeacher: true, difficulty: 'hard', status: 'draft' });

    expect((await as(w.teacher).patch(`/api/questions/${qs[0]!.id}`).send({ options: ['a', 'b', 'c'] })).status).toBe(400);
    expect((await as(w.teacher).patch(`/api/questions/${qs[0]!.id}`).send({ correctIndex: 4 })).status).toBe(400);
    expect((await as(w.teacher).patch(`/api/questions/${qs[0]!.id}`).send({ citationStartSec: 10, citationEndSec: 5 })).status).toBe(400);
  });

  it('approves, rejects and deletes (positions stay contiguous)', async () => {
    const { w, lesson, qs } = await reviewLesson();
    expect((await as(w.teacher).post(`/api/questions/${qs[0]!.id}/approve`)).body.status).toBe('approved');
    expect((await as(w.teacher).post(`/api/questions/${qs[1]!.id}/reject`)).body.status).toBe('rejected');
    expect((await as(w.teacher).delete(`/api/questions/${qs[0]!.id}`)).status).toBe(204);
    const rest = await db.select().from(questions).where(eq(questions.lessonId, lesson.id)).orderBy(asc(questions.position));
    expect(rest.map((q) => q.position)).toEqual([1, 2]);
    expect((await as(w.teacher).delete(`/api/questions/${qs[0]!.id}`)).status).toBe(404);
  });

  it('adds a manual question (approved, edited, next position) and approves all drafts', async () => {
    const { w, lesson, qs } = await reviewLesson();
    await as(w.teacher).post(`/api/questions/${qs[2]!.id}/reject`).expect(200);
    const add = await as(w.teacher).post(`/api/lessons/${lesson.id}/questions`).send(validQuestion);
    expect(add.status).toBe(201);
    expect(add.body).toMatchObject({ position: 4, status: 'approved', editedByTeacher: true, lessonId: lesson.id });
    expect((await as(w.teacher).post(`/api/lessons/${lesson.id}/questions`).send({ ...validQuestion, correctIndex: 7 })).status).toBe(400);

    const all = await as(w.teacher).post(`/api/lessons/${lesson.id}/questions/approve-all`);
    expect(all.status).toBe(200);
    expect(all.body.map((q: { status: string }) => q.status)).toEqual(['approved', 'approved', 'rejected', 'approved']);
  });

  it('published and processing lessons are read-only (409)', async () => {
    const { w, lesson, qs } = await reviewLesson('published');
    const res = await as(w.teacher).patch(`/api/questions/${qs[0]!.id}`).send({ stem: 'Nope?' });
    expect(res.status).toBe(409);
    expect(res.body.error.message).toMatch(/unpublish/i);
    expect((await as(w.teacher).post(`/api/questions/${qs[0]!.id}/approve`)).status).toBe(409);
    expect((await as(w.teacher).delete(`/api/questions/${qs[0]!.id}`)).status).toBe(409);
    expect((await as(w.teacher).post(`/api/lessons/${lesson.id}/questions`).send(validQuestion)).status).toBe(409);
    expect((await as(w.teacher).post(`/api/lessons/${lesson.id}/questions/approve-all`)).status).toBe(409);

    const busy = await reviewLesson('generating');
    expect((await as(busy.w.teacher).patch(`/api/questions/${busy.qs[0]!.id}`).send({ stem: 'x?' })).status).toBe(409);
  });

  it('enforces ownership and roles', async () => {
    const { w, lesson, qs } = await reviewLesson();
    const id = qs[0]!.id;
    expect((await anon().post(`/api/questions/${id}/approve`)).status).toBe(401);
    expect((await as(w.student).post(`/api/questions/${id}/approve`)).status).toBe(403);
    expect((await as(w.admin).post(`/api/questions/${id}/approve`)).status).toBe(403);
    expect((await as(w.otherTeacher).post(`/api/questions/${id}/approve`)).status).toBe(404);
    expect((await as(w.otherTeacher).patch(`/api/questions/${id}`).send({ stem: 'x?' })).status).toBe(404);
    expect((await as(w.otherTeacher).post(`/api/lessons/${lesson.id}/questions`).send(validQuestion)).status).toBe(404);
    expect((await as(w.admin).post(`/api/lessons/${lesson.id}/questions`).send(validQuestion)).status).toBe(403);
    expect((await as(w.teacher).post('/api/questions/not-a-uuid/approve')).status).toBe(400);
  });
});
