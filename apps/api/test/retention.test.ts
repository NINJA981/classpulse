/**
 * Data retention (M12): stuck lessons fail and their audio becomes subject to retention, old
 * transcripts are deleted without touching published quizzes, and orphaned storage objects are swept.
 */
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import { eq, sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { db } from '../src/db/client.js';
import { assignments, assignmentSubmissions, lessons, questions, submissionFiles } from '../src/db/schema/index.js';
import { failStuckLessons, purgeExpiredAudio, purgeOldTranscripts, STUCK_LESSON_HOURS } from '../src/jobs/retention.js';
import { ORPHAN_MIN_AGE_MS, sweepOrphanedObjects } from '../src/jobs/storageSweep.js';
import { storage } from '../src/lib/storage.js';
import { as, createWorld } from './helpers.js';
import { insertLesson, insertQuestions } from './fixtures/lessons.js';

const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000);

async function age(key: string, ms: number) {
  const when = new Date(Date.now() - ms);
  await fs.utimes(storage.localPath(key), when, when);
}

describe('stuck lessons', () => {
  it('fails lessons processing for too long and lets retention delete their audio', async () => {
    const w = await createWorld();
    const base = { institutionId: w.institution.id, teacherId: w.teacher.id, sectionId: w.section.id, withAudio: true };
    const stuck = await insertLesson({ ...base, status: 'transcribing', audioExpiresAt: hoursAgo(1) });
    const busy = await insertLesson({ ...base, status: 'generating', audioExpiresAt: hoursAgo(1) });
    // Bypass $onUpdate: set updated_at directly.
    await db.execute(sql`update lessons set updated_at = ${hoursAgo(STUCK_LESSON_HOURS + 1)} where id = ${stuck.id}`);

    // While processing, retention never touches the audio.
    expect(await purgeExpiredAudio()).toBe(0);

    expect(await failStuckLessons()).toBe(1);
    const [failed] = await db.select().from(lessons).where(eq(lessons.id, stuck.id));
    expect(failed).toMatchObject({ status: 'failed' });
    expect(failed!.failureReason).toMatch(/did not finish/);
    const [still] = await db.select().from(lessons).where(eq(lessons.id, busy.id));
    expect(still!.status).toBe('generating');

    expect(await purgeExpiredAudio()).toBe(1);
    expect(await storage.stat(stuck.audioObjectKey!)).toBeNull();
    expect(await storage.stat(busy.audioObjectKey!)).not.toBeNull();
  });
});

describe('transcript retention', () => {
  it('deletes old transcripts but keeps the lesson and its published quiz', async () => {
    const w = await createWorld();
    const base = { institutionId: w.institution.id, teacherId: w.teacher.id, sectionId: w.section.id };
    const old = await insertLesson({ ...base, status: 'published' });
    const recent = await insertLesson({ ...base, status: 'published' });
    const transcript = { transcript: 'Plants make food from light.', transcriptSegments: [{ startSec: 0, endSec: 3, text: 'Plants make food from light.' }] };
    await db.update(lessons).set(transcript).where(eq(lessons.id, old.id));
    await db.update(lessons).set(transcript).where(eq(lessons.id, recent.id));
    await db.execute(sql`update lessons set created_at = ${new Date(Date.now() - 400 * 86400_000)} where id = ${old.id}`);
    await insertQuestions(old.id, 3, 'approved');

    expect(await purgeOldTranscripts(new Date(), 365)).toBe(1);
    const [o] = await db.select().from(lessons).where(eq(lessons.id, old.id));
    expect(o).toMatchObject({ status: 'published', transcript: null, transcriptSegments: null });
    const [r] = await db.select().from(lessons).where(eq(lessons.id, recent.id));
    expect(r!.transcript).toBe(transcript.transcript);
    expect(await db.select().from(questions).where(eq(questions.lessonId, old.id))).toHaveLength(3);

    // Students can still take the quiz.
    const quiz = await as(w.student).get(`/api/student/quizzes/${old.id}`);
    expect(quiz.status).toBe(200);
    expect(quiz.body.questions).toHaveLength(3);
  });
});

describe('orphaned storage objects', () => {
  it('deletes old files with no row, and keeps referenced or recent ones', async () => {
    const w = await createWorld();
    const [a] = await db
      .insert(assignments)
      .values({ sectionId: w.section.id, teacherId: w.teacher.id, title: 'Essay', prompt: 'Write', status: 'published' })
      .returning();
    const [sub] = await db.insert(assignmentSubmissions).values({ assignmentId: a!.id, studentId: w.student.id }).returning();
    const referenced = `submissions/${a!.id}/${w.student.id}/${randomUUID()}.pdf`;
    const orphan = `submissions/${a!.id}/${w.student.id}/${randomUUID()}.pdf`;
    const fresh = `submissions/${a!.id}/${w.student.id}/${randomUUID()}.pdf`;
    const orphanAudio = `audio/${randomUUID()}/${randomUUID()}.wav`;
    for (const key of [referenced, orphan, fresh, orphanAudio]) await storage.put(key, Buffer.from('data'));
    await db.insert(submissionFiles).values({ submissionId: sub!.id, objectKey: referenced, originalName: 'a.pdf', mime: 'application/pdf', sizeBytes: 4 });
    for (const key of [referenced, orphan, orphanAudio]) await age(key, ORPHAN_MIN_AGE_MS + 3600_000);
    // Recording chunks of an unknown session, long ago.
    const chunk = `recordings/${randomUUID()}/00000.pcm`;
    await storage.put(chunk, Buffer.from('pcm'));
    await age(chunk, ORPHAN_MIN_AGE_MS + 3600_000);
    const chunkDir = storage.localPath(chunk).replace(/[\\/]00000\.pcm$/, '');
    const old = new Date(Date.now() - ORPHAN_MIN_AGE_MS - 3600_000);
    await fs.utimes(chunkDir, old, old);

    expect(await sweepOrphanedObjects()).toBeGreaterThanOrEqual(3);
    expect(await storage.stat(referenced)).not.toBeNull();
    expect(await storage.stat(fresh)).not.toBeNull();
    expect(await storage.stat(orphan)).toBeNull();
    expect(await storage.stat(orphanAudio)).toBeNull();
    expect(await storage.stat(chunk)).toBeNull();
  });
});
