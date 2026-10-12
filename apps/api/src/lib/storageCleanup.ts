/**
 * Storage clean-up after database deletes. Callers collect the object keys *before* deleting the
 * rows (cascades remove the rows that reference them), delete the rows, then call this. A failed
 * delete is only logged: the periodic orphan sweep (jobs/storageSweep.ts) removes what is left.
 */
import { eq, inArray } from 'drizzle-orm';
import type { DbOrTx } from '../db/client.js';
import { assignments, assignmentSubmissions, submissionFiles, teacherMaterials } from '../db/schema/index.js';
import { logger } from './logger.js';
import { storage } from './storage.js';

export async function deleteStorageObjects(keys: Iterable<string | null | undefined>, context: Record<string, unknown> = {}): Promise<number> {
  let deleted = 0;
  for (const key of new Set([...keys].filter((k): k is string => !!k))) {
    try {
      await storage.delete(key);
      deleted++;
    } catch (err) {
      logger.warn({ err: (err as Error).message, ...context }, 'Failed to delete a storage object');
    }
  }
  return deleted;
}

/** Keys of the files a student attached to submissions. */
export async function studentSubmissionKeys(dbx: DbOrTx, studentId: string): Promise<string[]> {
  const rows = await dbx
    .select({ key: submissionFiles.objectKey })
    .from(submissionFiles)
    .innerJoin(assignmentSubmissions, eq(assignmentSubmissions.id, submissionFiles.submissionId))
    .where(eq(assignmentSubmissions.studentId, studentId));
  return rows.map((r) => r.key);
}

/** Keys of the submission files of every assignment attached to a lesson. */
export async function lessonSubmissionKeys(dbx: DbOrTx, lessonId: string): Promise<string[]> {
  const rows = await dbx
    .select({ key: submissionFiles.objectKey })
    .from(submissionFiles)
    .innerJoin(assignmentSubmissions, eq(assignmentSubmissions.id, submissionFiles.submissionId))
    .where(inArray(assignmentSubmissions.assignmentId, dbx.select({ id: assignments.id }).from(assignments).where(eq(assignments.lessonId, lessonId))));
  return rows.map((r) => r.key);
}

/** Keys of the submission files of every assignment of a section. */
export async function sectionSubmissionKeys(dbx: DbOrTx, sectionId: string): Promise<string[]> {
  const rows = await dbx
    .select({ key: submissionFiles.objectKey })
    .from(submissionFiles)
    .innerJoin(assignmentSubmissions, eq(assignmentSubmissions.id, submissionFiles.submissionId))
    .innerJoin(assignments, eq(assignments.id, assignmentSubmissions.assignmentId))
    .where(eq(assignments.sectionId, sectionId));
  return rows.map((r) => r.key);
}

/** Keys of a teacher's uploaded materials (notes, textbook chapters). */
export async function teacherMaterialKeys(dbx: DbOrTx, teacherId: string): Promise<string[]> {
  const rows = await dbx.select({ key: teacherMaterials.objectKey }).from(teacherMaterials).where(eq(teacherMaterials.teacherId, teacherId));
  return rows.flatMap((r) => (r.key ? [r.key] : []));
}
