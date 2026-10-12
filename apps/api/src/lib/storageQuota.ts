/**
 * Per-school storage limit (institution.limits.storageGb; null = unlimited). Usage is the sum of stored
 * lesson audio, submission files and teacher materials, the same files the platform console counts.
 * Checked before an upload is moved into storage; refused uploads get 409 CONFLICT with a clear message.
 */
import { sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { assignmentSubmissions, assignments, lessons, sections, submissionFiles, teacherMaterials } from '../db/schema/index.js';
import { conflict } from './errors.js';
import { institutionState } from './platformState.js';

const GB = 1024 ** 3;

/** Bytes of stored files that belong to a school. */
export async function institutionStorageBytes(institutionId: string): Promise<number> {
  const res = await db.execute<{ bytes: number | string | null }>(sql`
    select coalesce((
      select sum(l.audio_size_bytes) from ${lessons} l
       where l.institution_id = ${institutionId} and l.audio_object_key is not null
    ), 0)::float8
    + coalesce((
      select sum(sf.size_bytes) from ${submissionFiles} sf
        join ${assignmentSubmissions} sub on sub.id = sf.submission_id
        join ${assignments} asg on asg.id = sub.assignment_id
        join ${sections} s on s.id = asg.section_id
       where s.institution_id = ${institutionId}
    ), 0)::float8
    + coalesce((
      select sum(m.size_bytes) from ${teacherMaterials} m
       where m.institution_id = ${institutionId} and m.object_key is not null
    ), 0)::float8 as bytes
  `);
  return Number(res.rows[0]?.bytes ?? 0);
}

export const STORAGE_FULL_MESSAGE = (limitGb: number) =>
  `This school has used its ${limitGb} GB of file storage. Delete old recordings or files, or ask your administrator to raise the limit.`;

/**
 * Throws CONFLICT (409) when storing `addingBytes` more (after freeing `freeingBytes`, e.g. audio being
 * replaced) would take the school over its storage limit.
 */
export async function assertStorageAvailable(institutionId: string, addingBytes: number, freeingBytes = 0): Promise<void> {
  const limitGb = (await institutionState(institutionId))?.limits.storageGb;
  if (limitGb === null || limitGb === undefined) return;
  const used = await institutionStorageBytes(institutionId);
  if (used - Math.max(0, freeingBytes) + Math.max(0, addingBytes) > limitGb * GB) throw conflict(STORAGE_FULL_MESSAGE(limitGb));
}
