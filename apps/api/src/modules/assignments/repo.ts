/** Assignment queries and mappers shared by the teacher routes, the student portal and the file download route. */
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import type { RubricItem, RubricMark, SessionUser, SubmissionFile } from '@classpulse/shared';
import { db, type DbOrTx } from '../../db/client.js';
import { assignments, sectionTeachers, submissionFiles, type assignmentSubmissions } from '../../db/schema/index.js';
import { badRequest, notFound } from '../../lib/errors.js';
import type { AssignmentRow } from '../lessons/mappers.js';

export type SubmissionRow = typeof assignmentSubmissions.$inferSelect;
export type SubmissionFileRow = typeof submissionFiles.$inferSelect;

/** Same-origin download URL of a submission file (see fileRoutes.ts). */
export const submissionFileUrl = (fileId: string) => `/api/assignment-files/${fileId}`;

export function toSubmissionFile(f: SubmissionFileRow): SubmissionFile {
  return { id: f.id, name: f.originalName, mime: f.mime, sizeBytes: f.sizeBytes, url: submissionFileUrl(f.id) };
}

export const maxMarksOf = (rubric: RubricItem[]) => rubric.reduce((sum, r) => sum + r.marks, 0);

/** Files of several submissions, grouped by submission id (oldest first). */
export async function filesBySubmission(submissionIds: string[], dbx: DbOrTx = db): Promise<Map<string, SubmissionFileRow[]>> {
  const out = new Map<string, SubmissionFileRow[]>();
  if (!submissionIds.length) return out;
  const rows = await dbx
    .select()
    .from(submissionFiles)
    .where(inArray(submissionFiles.submissionId, submissionIds))
    .orderBy(asc(submissionFiles.createdAt), asc(submissionFiles.id));
  for (const row of rows) out.set(row.submissionId, [...(out.get(row.submissionId) ?? []), row]);
  return out;
}

/** True when `teacherId` teaches the section (section_teachers). */
export const teachesSectionSql = (teacherId: string, sectionColumn = assignments.sectionId) =>
  sql<boolean>`exists (select 1 from ${sectionTeachers} st where st.section_id = ${sectionColumn} and st.teacher_id = ${teacherId})`;

/** An assignment of a section the teacher teaches; anything else is 404 (existence is not revealed). */
export async function getTeacherAssignment(user: SessionUser, id: string, dbx: DbOrTx = db): Promise<AssignmentRow> {
  const [row] = await dbx
    .select()
    .from(assignments)
    .where(and(eq(assignments.id, id), teachesSectionSql(user.id)));
  if (!row) throw notFound('Assignment');
  return row;
}

/**
 * Map marks to the rubric (rubric order, clamped to 0..criterion max). `strict` rejects criteria that are not
 * in the rubric (teacher input); otherwise they are dropped (AI output).
 */
export function clampToRubric(rubric: RubricItem[], marks: RubricMark[], strict: boolean): RubricMark[] {
  const byName = new Map(marks.map((m) => [m.criterion.trim().toLowerCase(), m.marks]));
  if (strict) {
    const known = new Set(rubric.map((r) => r.criterion.trim().toLowerCase()));
    const unknown = marks.filter((m) => !known.has(m.criterion.trim().toLowerCase()));
    if (unknown.length) throw badRequest(`Not a rubric criterion: ${unknown.map((m) => m.criterion).join(', ')}`);
  }
  return rubric.flatMap((r) => {
    const value = byName.get(r.criterion.trim().toLowerCase());
    return value === undefined ? [] : [{ criterion: r.criterion, marks: Math.min(r.marks, Math.max(0, value)) }];
  });
}
