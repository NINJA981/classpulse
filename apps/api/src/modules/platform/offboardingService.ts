/**
 * School offboarding (DPDP Act 2023: return and erase a school's data when the contract ends).
 * - exportSchool: streams one JSON document with all of the school's records (no password hashes, key
 *   hashes, device-token fingerprints or platform-private notes), page by page so memory stays flat.
 * - deleteSchool: hard delete of every row and stored file, only for a suspended school and only with
 *   the school code typed back. Audit entries survive (unlinked from the school) as the record of it.
 */
import { once } from 'node:events';
import type { Writable } from 'node:stream';
import { and, asc, eq, inArray, type SQL } from 'drizzle-orm';
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core';
import { z } from 'zod';
import { db } from '../../db/client.js';
import {
  appLogs,
  assignmentReminders,
  assignmentSubmissions,
  assignments,
  auditLogs,
  courses,
  devices,
  enrollments,
  examAnswers,
  examAttempts,
  examEvents,
  examQuestions,
  exams,
  guardians,
  institutions,
  lessons,
  liveAnswers,
  liveParticipants,
  liveSessions,
  modelSettings,
  notifications,
  pushSubscriptions,
  questions,
  quizAttemptAnswers,
  quizAttempts,
  recordingChunks,
  recordingSessions,
  rooms,
  sections,
  sectionTeachers,
  simulationLinks,
  submissionFiles,
  teacherMaterials,
  teachingResources,
  timetableSlots,
  units,
  users,
} from '../../db/schema/index.js';
import { badRequest, invalidState, notFound } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
import { invalidateInstitutionState } from '../../lib/platformState.js';
import { disconnectSchoolSockets } from '../../sockets/sessions.js';
import { storage } from '../../lib/storage.js';

export const SCHOOL_EXPORT_FORMAT = 'classpulse.school-export';
export const SCHOOL_EXPORT_VERSION = 1;
const PAGE = 500;

export const DeleteSchoolInput = z.object({ confirmCode: z.string().trim().min(1).max(40) });

type SchoolRow = typeof institutions.$inferSelect;

export async function getSchoolRow(id: string): Promise<SchoolRow> {
  const [row] = await db.select().from(institutions).where(eq(institutions.id, id));
  if (!row) throw notFound('School');
  return row;
}

/* ---------------------------------------------------------------- scoping subqueries */

const schoolUsers = (id: string) => db.select({ id: users.id }).from(users).where(eq(users.institutionId, id));
const schoolSections = (id: string) => db.select({ id: sections.id }).from(sections).where(eq(sections.institutionId, id));
const schoolLessons = (id: string) => db.select({ id: lessons.id }).from(lessons).where(eq(lessons.institutionId, id));
const schoolExams = (id: string) => db.select({ id: exams.id }).from(exams).where(eq(exams.institutionId, id));
const schoolAssignments = (id: string) => db.select({ id: assignments.id }).from(assignments).where(inArray(assignments.sectionId, schoolSections(id)));
const schoolSubmissions = (id: string) =>
  db.select({ id: assignmentSubmissions.id }).from(assignmentSubmissions).where(inArray(assignmentSubmissions.assignmentId, schoolAssignments(id)));
const schoolQuizAttempts = (id: string) => db.select({ id: quizAttempts.id }).from(quizAttempts).where(inArray(quizAttempts.lessonId, schoolLessons(id)));
const schoolExamAttempts = (id: string) => db.select({ id: examAttempts.id }).from(examAttempts).where(inArray(examAttempts.examId, schoolExams(id)));
const schoolLiveSessions = (id: string) => db.select({ id: liveSessions.id }).from(liveSessions).where(inArray(liveSessions.lessonId, schoolLessons(id)));
const schoolParticipants = (id: string) =>
  db.select({ id: liveParticipants.id }).from(liveParticipants).where(inArray(liveParticipants.sessionId, schoolLiveSessions(id)));
const schoolCourses = (id: string) => db.select({ id: courses.id }).from(courses).where(eq(courses.institutionId, id));
const schoolDevices = (id: string) => db.select({ id: devices.id }).from(devices).where(eq(devices.institutionId, id));
const schoolRecordings = (id: string) =>
  db.select({ id: recordingSessions.id }).from(recordingSessions).where(inArray(recordingSessions.lessonId, schoolLessons(id)));

/* ---------------------------------------------------------------- export */

/** Columns never exported: secrets, fingerprints and storage internals. */
const OMIT: Record<string, ReadonlySet<string>> = {
  users: new Set(['passwordHash', 'tokenVersion']),
  devices: new Set(['apiKeyHash']),
  examAttempts: new Set(['deviceTokenHash']),
  exams: new Set(['accessCode']),
  lessons: new Set(['audioObjectKey']),
  submissionFiles: new Set(['objectKey']),
  teacherMaterials: new Set(['objectKey']),
  recordingChunks: new Set(['objectKey']),
};

interface ExportTable {
  name: string;
  table: PgTable;
  where: (schoolId: string) => SQL | undefined;
  /** Stable order for paging (a primary key or unique column set). */
  order: PgColumn[];
}

const EXPORT_TABLES: ExportTable[] = [
  { name: 'users', table: users, where: (id) => eq(users.institutionId, id), order: [users.id] },
  { name: 'guardians', table: guardians, where: (id) => inArray(guardians.studentId, schoolUsers(id)), order: [guardians.id] },
  { name: 'rooms', table: rooms, where: (id) => eq(rooms.institutionId, id), order: [rooms.id] },
  { name: 'sections', table: sections, where: (id) => eq(sections.institutionId, id), order: [sections.id] },
  {
    name: 'sectionTeachers',
    table: sectionTeachers,
    where: (id) => inArray(sectionTeachers.sectionId, schoolSections(id)),
    order: [sectionTeachers.sectionId, sectionTeachers.teacherId],
  },
  {
    name: 'enrollments',
    table: enrollments,
    where: (id) => inArray(enrollments.sectionId, schoolSections(id)),
    order: [enrollments.sectionId, enrollments.studentId],
  },
  { name: 'timetableSlots', table: timetableSlots, where: (id) => inArray(timetableSlots.sectionId, schoolSections(id)), order: [timetableSlots.id] },
  { name: 'modelSettings', table: modelSettings, where: (id) => eq(modelSettings.institutionId, id), order: [modelSettings.institutionId] },
  { name: 'lessons', table: lessons, where: (id) => eq(lessons.institutionId, id), order: [lessons.id] },
  { name: 'questions', table: questions, where: (id) => inArray(questions.lessonId, schoolLessons(id)), order: [questions.id] },
  { name: 'quizAttempts', table: quizAttempts, where: (id) => inArray(quizAttempts.lessonId, schoolLessons(id)), order: [quizAttempts.id] },
  {
    name: 'quizAttemptAnswers',
    table: quizAttemptAnswers,
    where: (id) => inArray(quizAttemptAnswers.attemptId, schoolQuizAttempts(id)),
    order: [quizAttemptAnswers.id],
  },
  { name: 'assignments', table: assignments, where: (id) => inArray(assignments.sectionId, schoolSections(id)), order: [assignments.id] },
  {
    name: 'assignmentSubmissions',
    table: assignmentSubmissions,
    where: (id) => inArray(assignmentSubmissions.assignmentId, schoolAssignments(id)),
    order: [assignmentSubmissions.id],
  },
  {
    name: 'submissionFiles',
    table: submissionFiles,
    where: (id) => inArray(submissionFiles.submissionId, schoolSubmissions(id)),
    order: [submissionFiles.id],
  },
  {
    name: 'assignmentReminders',
    table: assignmentReminders,
    where: (id) => inArray(assignmentReminders.assignmentId, schoolAssignments(id)),
    order: [assignmentReminders.assignmentId, assignmentReminders.studentId],
  },
  { name: 'liveSessions', table: liveSessions, where: (id) => inArray(liveSessions.lessonId, schoolLessons(id)), order: [liveSessions.id] },
  {
    name: 'liveParticipants',
    table: liveParticipants,
    where: (id) => inArray(liveParticipants.sessionId, schoolLiveSessions(id)),
    order: [liveParticipants.id],
  },
  { name: 'liveAnswers', table: liveAnswers, where: (id) => inArray(liveAnswers.participantId, schoolParticipants(id)), order: [liveAnswers.id] },
  { name: 'exams', table: exams, where: (id) => eq(exams.institutionId, id), order: [exams.id] },
  { name: 'examQuestions', table: examQuestions, where: (id) => inArray(examQuestions.examId, schoolExams(id)), order: [examQuestions.id] },
  { name: 'examAttempts', table: examAttempts, where: (id) => inArray(examAttempts.examId, schoolExams(id)), order: [examAttempts.id] },
  { name: 'examAnswers', table: examAnswers, where: (id) => inArray(examAnswers.attemptId, schoolExamAttempts(id)), order: [examAnswers.id] },
  { name: 'examEvents', table: examEvents, where: (id) => inArray(examEvents.attemptId, schoolExamAttempts(id)), order: [examEvents.id] },
  { name: 'devices', table: devices, where: (id) => eq(devices.institutionId, id), order: [devices.id] },
  { name: 'recordingSessions', table: recordingSessions, where: (id) => inArray(recordingSessions.lessonId, schoolLessons(id)), order: [recordingSessions.id] },
  { name: 'courses', table: courses, where: (id) => eq(courses.institutionId, id), order: [courses.id] },
  { name: 'units', table: units, where: (id) => inArray(units.courseId, schoolCourses(id)), order: [units.id] },
  { name: 'teacherMaterials', table: teacherMaterials, where: (id) => eq(teacherMaterials.institutionId, id), order: [teacherMaterials.id] },
  { name: 'teachingResources', table: teachingResources, where: (id) => eq(teachingResources.institutionId, id), order: [teachingResources.id] },
  { name: 'simulationLinks', table: simulationLinks, where: (id) => eq(simulationLinks.institutionId, id), order: [simulationLinks.id] },
  // In-app notifications of the school's people. Push subscriptions are not exported: their endpoints and
  // keys are device credentials, not school records.
  {
    name: 'notifications',
    table: notifications,
    where: (id) => eq(notifications.institutionId, id),
    order: [notifications.id],
  },
  { name: 'auditLogs', table: auditLogs, where: (id) => eq(auditLogs.institutionId, id), order: [auditLogs.id] },
];

function clean(name: string, row: Record<string, unknown>): Record<string, unknown> {
  const omit = OMIT[name];
  if (!omit) return row;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) if (!omit.has(k)) out[k] = v;
  if (name === 'lessons') out.hasAudio = row.audioObjectKey !== null && row.audioObjectKey !== undefined;
  return out;
}

async function write(out: Writable, chunk: string): Promise<void> {
  if (!out.write(chunk)) await once(out, 'drain');
}

/** Write the school's export as one JSON document to `out` (does not end it). Returns row counts. */
export async function writeSchoolExport(school: SchoolRow, out: Writable): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  // Platform-private notes are not the school's data.
  const { notes: _notes, ...profile } = school;
  await write(
    out,
    `{"format":${JSON.stringify(SCHOOL_EXPORT_FORMAT)},"version":${SCHOOL_EXPORT_VERSION},"generatedAt":${JSON.stringify(new Date().toISOString())},` +
      `"school":${JSON.stringify(profile)},"tables":{`,
  );
  for (const [i, t] of EXPORT_TABLES.entries()) {
    await write(out, `${i ? ',' : ''}${JSON.stringify(t.name)}:[`);
    let n = 0;
    for (let offset = 0; ; offset += PAGE) {
      const rows = (await db
        .select()
        .from(t.table)
        .where(t.where(school.id))
        .orderBy(...t.order.map((c) => asc(c)))
        .limit(PAGE)
        .offset(offset)) as Record<string, unknown>[];
      for (const row of rows) await write(out, `${n++ ? ',' : ''}${JSON.stringify(clean(t.name, row))}`);
      if (rows.length < PAGE) break;
    }
    counts[t.name] = n;
    await write(out, ']');
  }
  await write(out, '}}');
  return counts;
}

/* ---------------------------------------------------------------- hard delete */

export interface SchoolDeleteResult {
  code: string;
  name: string;
  counts: Record<string, number>;
  /** Stored files and per-lesson/assignment/recording folders removed after commit; failures are logged. */
  storage: { objects: number; folders: number; failed: number };
}

/**
 * Delete every row and stored file of a suspended school. Rows go in one transaction, children before
 * the parents that RESTRICT them (exams, assignments and lessons before users and sections; devices
 * before rooms); files are removed after commit (best effort, failures logged).
 */
export async function deleteSchool(id: string, confirmCode: string): Promise<SchoolDeleteResult> {
  const school = await getSchoolRow(id);
  if (school.status !== 'suspended') throw invalidState('Suspend the school before deleting it');
  if (confirmCode !== school.code) throw badRequest('The school code does not match', [{ path: 'confirmCode', message: 'Type the school code exactly' }]);

  const result = await db.transaction(async (tx) => {
    // Storage keys and prefixes first: the rows that name them are about to go.
    // (Sequential: a transaction is one connection.)
    const lessonRows = await tx.select({ id: lessons.id, key: lessons.audioObjectKey }).from(lessons).where(eq(lessons.institutionId, id));
    const assignmentRows = await tx.select({ id: assignments.id }).from(assignments).where(inArray(assignments.sectionId, schoolSections(id)));
    const recordingRows = await tx
      .select({ id: recordingSessions.id })
      .from(recordingSessions)
      .where(inArray(recordingSessions.lessonId, schoolLessons(id)));
    const fileRows = await tx
      .select({ key: submissionFiles.objectKey })
      .from(submissionFiles)
      .where(inArray(submissionFiles.submissionId, schoolSubmissions(id)));
    const materialRows = await tx.select({ key: teacherMaterials.objectKey }).from(teacherMaterials).where(eq(teacherMaterials.institutionId, id));
    const chunkRows = await tx
      .select({ key: recordingChunks.objectKey })
      .from(recordingChunks)
      .where(inArray(recordingChunks.sessionId, schoolRecordings(id)));
    const keys = new Set<string>();
    for (const r of [...lessonRows, ...fileRows, ...materialRows, ...chunkRows]) if (r.key) keys.add(r.key);
    const prefixes = [
      ...lessonRows.map((l) => `audio/${l.id}`),
      ...recordingRows.map((r) => `recordings/${r.id}`),
      ...assignmentRows.map((a) => `submissions/${a.id}`),
      `materials/${id}`,
    ];

    const count = async (p: Promise<unknown[]>) => (await p).length;
    const people = (role: 'admin' | 'teacher' | 'student') => tx.$count(users, and(eq(users.institutionId, id), eq(users.role, role)));
    const counts: Record<string, number> = {
      admins: await people('admin'),
      teachers: await people('teacher'),
      students: await people('student'),
    };
    // exam_* rows cascade from exams; submissions, files and reminders from assignments.
    counts.exams = await count(tx.delete(exams).where(eq(exams.institutionId, id)).returning({ id: exams.id }));
    counts.assignments = await count(
      tx.delete(assignments).where(inArray(assignments.sectionId, schoolSections(id))).returning({ id: assignments.id }),
    );
    // questions, quiz attempts, live sessions and recording sessions cascade from lessons.
    counts.lessons = await count(tx.delete(lessons).where(eq(lessons.institutionId, id)).returning({ id: lessons.id }));
    counts.devices = await count(tx.delete(devices).where(inArray(devices.id, schoolDevices(id))).returning({ id: devices.id }));
    counts.teacherMaterials = await count(
      tx.delete(teacherMaterials).where(eq(teacherMaterials.institutionId, id)).returning({ id: teacherMaterials.id }),
    );
    counts.teachingResources = await count(
      tx.delete(teachingResources).where(eq(teachingResources.institutionId, id)).returning({ id: teachingResources.id }),
    );
    // Notifications and push subscriptions would cascade from users too; deleted explicitly for the counts.
    counts.notifications = await count(tx.delete(notifications).where(eq(notifications.institutionId, id)).returning({ id: notifications.id }));
    counts.pushSubscriptions = await count(
      tx.delete(pushSubscriptions).where(eq(pushSubscriptions.institutionId, id)).returning({ id: pushSubscriptions.id }),
    );
    // enrolments, guardians, password links and section membership cascade from users.
    await tx.delete(users).where(eq(users.institutionId, id));
    counts.sections = await count(tx.delete(sections).where(eq(sections.institutionId, id)).returning({ id: sections.id }));
    counts.rooms = await count(tx.delete(rooms).where(eq(rooms.institutionId, id)).returning({ id: rooms.id }));
    // Application log lines that name the school (kept 14 days anyway).
    counts.appLogs = await count(tx.delete(appLogs).where(eq(appLogs.institutionId, id)).returning({ id: appLogs.id }));
    // Everything else (courses, units, links, model settings, enrolment tokens) cascades from the school.
    // audit_logs and ai_usage keep their rows with institution_id set to null.
    await tx.delete(institutions).where(eq(institutions.id, id));
    return { counts, keys: [...keys], prefixes };
  });

  invalidateInstitutionState(id);
  disconnectSchoolSockets(id);

  let failed = 0;
  const attempt = async (fn: () => Promise<void>, what: string) => {
    try {
      await fn();
    } catch (err) {
      failed++;
      logger.warn({ err: (err as Error).message, what }, 'School delete: could not remove a stored file');
    }
  };
  for (const key of result.keys) await attempt(() => storage.delete(key), 'object');
  for (const prefix of result.prefixes) await attempt(() => storage.deletePrefix(prefix), 'prefix');

  return {
    code: school.code,
    name: school.name,
    counts: result.counts,
    storage: { objects: result.keys.length, folders: result.prefixes.length, failed },
  };
}
