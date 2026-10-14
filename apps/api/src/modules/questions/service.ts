/** Question review: edit, approve, reject, delete. Ownership comes from the parent lesson. */
import { and, eq, gt, sql } from 'drizzle-orm';
import { QUESTION_OPTION_COUNT, type Question, type SessionUser, type UpdateQuestionInput } from '@classiq/shared';
import { db } from '../../db/client.js';
import { lessons, questions } from '../../db/schema/index.js';
import { badRequest, notFound } from '../../lib/errors.js';
import { toQuestion, type QuestionRow } from '../lessons/mappers.js';
import { assertContentEditable } from '../lessons/repo.js';
import { assertCitationRange } from '../lessons/service.js';

/** Load a question whose lesson the teacher owns and may edit; 404 otherwise (no existence leak). */
async function loadEditableQuestion(user: SessionUser, id: string): Promise<QuestionRow> {
  const [row] = await db
    .select({ question: questions, lesson: lessons })
    .from(questions)
    .innerJoin(lessons, eq(lessons.id, questions.lessonId))
    .where(eq(questions.id, id));
  if (!row || row.lesson.teacherId !== user.id) throw notFound('Question');
  assertContentEditable(row.lesson);
  return row.question;
}

export async function updateQuestion(user: SessionUser, id: string, input: UpdateQuestionInput): Promise<Question> {
  const current = await loadEditableQuestion(user, id);
  const patch = Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined)) as UpdateQuestionInput;
  const merged = { ...current, ...patch };
  if (merged.options.length !== QUESTION_OPTION_COUNT) throw badRequest(`A question needs exactly ${QUESTION_OPTION_COUNT} options`);
  if (merged.optionsLocal && merged.optionsLocal.length !== QUESTION_OPTION_COUNT) {
    throw badRequest(`Translated options must have exactly ${QUESTION_OPTION_COUNT} entries`);
  }
  if (merged.correctIndex < 0 || merged.correctIndex >= QUESTION_OPTION_COUNT) throw badRequest('correctIndex is out of range');
  assertCitationRange(merged.citationStartSec, merged.citationEndSec);

  const [row] = await db
    .update(questions)
    .set({ ...patch, editedByTeacher: true })
    .where(eq(questions.id, id))
    .returning();
  return toQuestion(row!);
}

export async function setQuestionStatus(user: SessionUser, id: string, status: 'approved' | 'rejected'): Promise<Question> {
  await loadEditableQuestion(user, id);
  const [row] = await db.update(questions).set({ status }).where(eq(questions.id, id)).returning();
  return toQuestion(row!);
}

export async function deleteQuestion(user: SessionUser, id: string): Promise<void> {
  const q = await loadEditableQuestion(user, id);
  await db.transaction(async (tx) => {
    await tx.delete(questions).where(eq(questions.id, id));
    // Keep positions contiguous (1..N).
    await tx
      .update(questions)
      .set({ position: sql`${questions.position} - 1` })
      .where(and(eq(questions.lessonId, q.lessonId), gt(questions.position, q.position)));
  });
}
