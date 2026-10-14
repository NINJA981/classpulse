/** Question paper → secure exam: copies the paper's objective questions into a DRAFT exam. */
import { and, eq } from 'drizzle-orm';
import {
  QuestionPaperContent,
  type PaperQuestion,
  type PublishPaperExamInput,
  type PublishPaperExamResult,
  type SessionUser,
} from '@classiq/shared';
import { db } from '../../db/client.js';
import { teachingResources } from '../../db/schema/index.js';
import { badRequest, invalidState, notFound } from '../../lib/errors.js';
import { createExamFromQuestions, type ExamQuestionData } from '../exams/service.js';

/** An objective paper question usable as an exam MCQ (4 distinct non-empty options, valid correct index). */
export function toExamQuestion(q: PaperQuestion): ExamQuestionData | null {
  if (q.type !== 'mcq' && q.type !== 'assertion_reason') return null;
  const options = q.options.map((o) => o.trim());
  if (options.length !== 4 || options.some((o) => !o || o.length > 300)) return null;
  if (new Set(options.map((o) => o.toLowerCase())).size !== 4) return null;
  if (!Number.isInteger(q.correctIndex) || q.correctIndex < 0 || q.correctIndex > 3) return null;
  return {
    stem: q.text.trim(),
    options,
    correctIndex: q.correctIndex,
    explanation: q.answer.trim() || null,
    difficulty: q.difficulty,
    topicTag: (q.unit.trim() || q.competency.trim() || null)?.slice(0, 120) ?? null,
  };
}

export async function publishPaperAsExam(user: SessionUser, resourceId: string, input: PublishPaperExamInput): Promise<PublishPaperExamResult> {
  // Only the owner may turn their paper into an exam (a shared paper is copied first); others get 404.
  const [resource] = await db
    .select()
    .from(teachingResources)
    .where(
      and(
        eq(teachingResources.id, resourceId),
        eq(teachingResources.teacherId, user.id),
        eq(teachingResources.institutionId, user.institutionId),
      ),
    );
  if (!resource) throw notFound('Resource');
  if (resource.type !== 'question_paper') throw badRequest('Only question papers can be published as an exam.');
  const parsed = QuestionPaperContent.safeParse(resource.content);
  if (resource.status !== 'ready' || !parsed.success) throw invalidState('This question paper is not ready yet.');

  const all = parsed.data.sections.flatMap((s) => s.questions);
  const mcqs = all.map(toExamQuestion).filter((q): q is ExamQuestionData => q !== null);
  if (!mcqs.length) throw invalidState('This paper has no multiple-choice questions to put in an exam.');

  const header = parsed.data.header;
  const exam = await createExamFromQuestions(
    user,
    {
      title: input.title ?? (header.examName ? `${header.examName}${header.subject ? ` · ${header.subject}` : ''}` : resource.title),
      sectionId: input.sectionId,
      instructions: input.instructions ?? `Multiple-choice questions from the question paper "${resource.title}".`,
      opensAt: input.opensAt,
      closesAt: input.closesAt,
      durationMin: input.durationMin,
      questionsPerStudent: input.questionsPerStudent,
    },
    mcqs,
  );
  return { examId: exam.id, mcqCount: mcqs.length, skipped: all.length - mcqs.length };
}
