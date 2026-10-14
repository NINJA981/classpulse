/**
 * Right of access (DPDP Act 2023): everything ClassIQ holds about one student, as a JSON document the
 * school admin can hand to the student or their parent. Password hashes, session versions and device-token
 * fingerprints are never included. Submission files are listed with an admin download path (see
 * exportRoutes.ts) instead of being embedded.
 */
import { and, asc, eq, inArray, or } from 'drizzle-orm';
import { db } from '../../db/client.js';
import {
  assignmentReminders,
  assignmentSubmissions,
  assignments,
  auditLogs,
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
  notifications,
  passwordTokens,
  pushSubscriptions,
  questions,
  quizAttemptAnswers,
  quizAttempts,
  sections,
  submissionFiles,
  users,
} from '../../db/schema/index.js';
import { notFound } from '../../lib/errors.js';
import { studentScope } from './service.js';

export const STUDENT_EXPORT_FORMAT = 'classpulse.student-export';
export const STUDENT_EXPORT_VERSION = 1;

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

/** Admin download path of one submission file inside an export. */
export const exportFilePath = (studentId: string, fileId: string) => `/api/admin/students/${studentId}/export/files/${fileId}`;

export async function exportStudentData(institutionId: string, studentId: string) {
  const [student] = await db
    .select({
      id: users.id,
      role: users.role,
      name: users.name,
      email: users.email,
      rollNumber: users.rollNumber,
      status: users.status,
      mustChangePassword: users.mustChangePassword,
      lastLoginAt: users.lastLoginAt,
      notificationPrefs: users.notificationPrefs,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    })
    .from(users)
    .where(and(studentScope(institutionId), eq(users.id, studentId)));
  if (!student) throw notFound('Student');

  const [
    [school],
    enrolmentRows,
    guardianRows,
    linkRows,
    quizRows,
    examRows,
    submissionRows,
    reminderRows,
    liveRows,
    auditRows,
    notificationRows,
    pushRows,
  ] = await Promise.all([
    db.select({ id: institutions.id, name: institutions.name, code: institutions.code }).from(institutions).where(eq(institutions.id, institutionId)),
    db
      .select({ sectionId: sections.id, name: sections.name, grade: sections.grade, subject: sections.subject, enrolledAt: enrollments.createdAt })
      .from(enrollments)
      .innerJoin(sections, eq(sections.id, enrollments.sectionId))
      .where(eq(enrollments.studentId, studentId))
      .orderBy(asc(sections.name)),
    db.select().from(guardians).where(eq(guardians.studentId, studentId)).orderBy(asc(guardians.createdAt)),
    db
      .select({
        purpose: passwordTokens.purpose,
        createdAt: passwordTokens.createdAt,
        expiresAt: passwordTokens.expiresAt,
        usedAt: passwordTokens.usedAt,
        revokedAt: passwordTokens.revokedAt,
        emailStatus: passwordTokens.emailStatus,
        emailSentAt: passwordTokens.emailSentAt,
      })
      .from(passwordTokens)
      .where(eq(passwordTokens.userId, studentId))
      .orderBy(asc(passwordTokens.createdAt)),
    db
      .select({ attempt: quizAttempts, lessonTitle: lessons.title, subject: lessons.subject })
      .from(quizAttempts)
      .innerJoin(lessons, eq(lessons.id, quizAttempts.lessonId))
      .where(eq(quizAttempts.studentId, studentId))
      .orderBy(asc(quizAttempts.submittedAt)),
    db
      .select({ attempt: examAttempts, examTitle: exams.title })
      .from(examAttempts)
      .innerJoin(exams, eq(exams.id, examAttempts.examId))
      .where(eq(examAttempts.studentId, studentId))
      .orderBy(asc(examAttempts.startedAt)),
    db
      .select({ submission: assignmentSubmissions, assignmentTitle: assignments.title, dueAt: assignments.dueAt })
      .from(assignmentSubmissions)
      .innerJoin(assignments, eq(assignments.id, assignmentSubmissions.assignmentId))
      .where(eq(assignmentSubmissions.studentId, studentId))
      .orderBy(asc(assignmentSubmissions.submittedAt)),
    db
      .select({ assignmentId: assignmentReminders.assignmentId, assignmentTitle: assignments.title, sentAt: assignmentReminders.sentAt })
      .from(assignmentReminders)
      .innerJoin(assignments, eq(assignments.id, assignmentReminders.assignmentId))
      .where(eq(assignmentReminders.studentId, studentId)),
    db
      .select({ participant: liveParticipants, lessonTitle: lessons.title, startedAt: liveSessions.startedAt, endedAt: liveSessions.endedAt })
      .from(liveParticipants)
      .innerJoin(liveSessions, eq(liveSessions.id, liveParticipants.sessionId))
      .innerJoin(lessons, eq(lessons.id, liveSessions.lessonId))
      .where(eq(liveParticipants.studentId, studentId))
      .orderBy(asc(liveParticipants.joinedAt)),
    db
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.institutionId, institutionId), or(eq(auditLogs.actorId, studentId), eq(auditLogs.targetId, studentId))))
      .orderBy(asc(auditLogs.at)),
    db
      .select()
      .from(notifications)
      .where(and(eq(notifications.institutionId, institutionId), eq(notifications.userId, studentId)))
      .orderBy(asc(notifications.createdAt)),
    // Devices only (browser and dates): endpoints and keys are device credentials.
    db
      .select({ userAgent: pushSubscriptions.userAgent, createdAt: pushSubscriptions.createdAt, lastSuccessAt: pushSubscriptions.lastSuccessAt })
      .from(pushSubscriptions)
      .where(and(eq(pushSubscriptions.institutionId, institutionId), eq(pushSubscriptions.userId, studentId)))
      .orderBy(asc(pushSubscriptions.createdAt)),
  ]);

  const quizIds = quizRows.map((r) => r.attempt.id);
  const examIds = examRows.map((r) => r.attempt.id);
  const submissionIds = submissionRows.map((r) => r.submission.id);
  const participantIds = liveRows.map((r) => r.participant.id);

  const [quizAnswerRows, examAnswerRows, examEventRows, fileRows, liveAnswerRows] = await Promise.all([
    quizIds.length
      ? db.select().from(quizAttemptAnswers).where(inArray(quizAttemptAnswers.attemptId, quizIds)).orderBy(asc(quizAttemptAnswers.position))
      : Promise.resolve([]),
    examIds.length
      ? db
          .select({ answer: examAnswers, stem: examQuestions.stem, options: examQuestions.options, correctIndex: examQuestions.correctIndex })
          .from(examAnswers)
          .innerJoin(examQuestions, eq(examQuestions.id, examAnswers.examQuestionId))
          .where(inArray(examAnswers.attemptId, examIds))
          .orderBy(asc(examQuestions.position))
      : Promise.resolve([]),
    examIds.length ? db.select().from(examEvents).where(inArray(examEvents.attemptId, examIds)).orderBy(asc(examEvents.at)) : Promise.resolve([]),
    submissionIds.length
      ? db.select().from(submissionFiles).where(inArray(submissionFiles.submissionId, submissionIds)).orderBy(asc(submissionFiles.createdAt))
      : Promise.resolve([]),
    participantIds.length
      ? db
          .select({ answer: liveAnswers, stem: questions.stem })
          .from(liveAnswers)
          .innerJoin(questions, eq(questions.id, liveAnswers.questionId))
          .where(inArray(liveAnswers.participantId, participantIds))
          .orderBy(asc(liveAnswers.answeredAt))
      : Promise.resolve([]),
  ]);

  const byKey = <T, K>(rows: T[], key: (r: T) => K) => {
    const m = new Map<K, T[]>();
    for (const r of rows) m.set(key(r), [...(m.get(key(r)) ?? []), r]);
    return m;
  };
  const quizAnswers = byKey(quizAnswerRows, (r) => r.attemptId);
  const examAnswersBy = byKey(examAnswerRows, (r) => r.answer.attemptId);
  const examEventsBy = byKey(examEventRows, (r) => r.attemptId);
  const filesBy = byKey(fileRows, (r) => r.submissionId);
  const liveAnswersBy = byKey(liveAnswerRows, (r) => r.answer.participantId);

  return {
    format: STUDENT_EXPORT_FORMAT,
    version: STUDENT_EXPORT_VERSION,
    generatedAt: new Date().toISOString(),
    school: school ?? null,
    student: {
      ...student,
      lastLoginAt: iso(student.lastLoginAt),
      createdAt: iso(student.createdAt),
      updatedAt: iso(student.updatedAt),
    },
    enrolments: enrolmentRows.map((r) => ({ ...r, enrolledAt: iso(r.enrolledAt) })),
    guardians: guardianRows.map((g) => ({
      id: g.id,
      name: g.name,
      relation: g.relation,
      phone: g.phone,
      email: g.email,
      receiveUpdates: g.receiveUpdates,
      createdAt: iso(g.createdAt),
      updatedAt: iso(g.updatedAt),
    })),
    accountLinks: linkRows.map((l) => ({
      purpose: l.purpose,
      createdAt: iso(l.createdAt),
      expiresAt: iso(l.expiresAt),
      usedAt: iso(l.usedAt),
      revokedAt: iso(l.revokedAt),
      emailStatus: l.emailStatus,
      emailSentAt: iso(l.emailSentAt),
    })),
    quizAttempts: quizRows.map(({ attempt: a, lessonTitle, subject }) => ({
      id: a.id,
      lessonId: a.lessonId,
      lessonTitle,
      subject,
      correct: a.correct,
      total: a.total,
      scorePct: a.scorePct,
      submittedAt: iso(a.submittedAt),
      answers: (quizAnswers.get(a.id) ?? []).map((x) => ({
        position: x.position,
        question: x.stemSnapshot,
        options: x.optionsSnapshot,
        correctIndex: x.correctIndexSnapshot,
        selectedIndex: x.selectedIndex,
        isCorrect: x.isCorrect,
      })),
    })),
    examAttempts: examRows.map(({ attempt: a, examTitle }) => ({
      id: a.id,
      examId: a.examId,
      examTitle,
      status: a.status,
      startedAt: iso(a.startedAt),
      deadlineAt: iso(a.deadlineAt),
      submittedAt: iso(a.submittedAt),
      extraMinutes: a.extraMinutes,
      lastSeenAt: iso(a.lastSeenAt),
      violationCount: a.violationCount,
      correct: a.correct,
      total: a.total,
      scorePct: a.scorePct,
      answers: (examAnswersBy.get(a.id) ?? []).map(({ answer, stem, options, correctIndex }) => ({
        question: stem,
        options,
        correctIndex,
        selectedIndex: answer.selectedIndex,
        revision: answer.revision,
        answeredAt: iso(answer.answeredAt),
      })),
      integrityEvents: (examEventsBy.get(a.id) ?? []).map((e) => ({ type: e.type, at: iso(e.at), detail: e.detail })),
    })),
    assignmentSubmissions: submissionRows.map(({ submission: s, assignmentTitle, dueAt }) => ({
      id: s.id,
      assignmentId: s.assignmentId,
      assignmentTitle,
      dueAt: iso(dueAt),
      text: s.text,
      submittedAt: iso(s.submittedAt),
      status: s.status,
      isLate: s.isLate,
      rubricMarks: s.rubricMarks,
      totalMarks: s.totalMarks,
      feedback: s.feedback,
      gradedAt: iso(s.gradedAt),
      returnedAt: iso(s.returnedAt),
      aiSuggestion: s.aiSuggestion,
      files: (filesBy.get(s.id) ?? []).map((f) => ({
        id: f.id,
        name: f.originalName,
        mime: f.mime,
        sizeBytes: f.sizeBytes,
        uploadedAt: iso(f.createdAt),
        downloadPath: exportFilePath(studentId, f.id),
      })),
    })),
    assignmentReminders: reminderRows.map((r) => ({ ...r, sentAt: iso(r.sentAt) })),
    liveQuizzes: liveRows.map(({ participant: p, lessonTitle, startedAt, endedAt }) => ({
      sessionId: p.sessionId,
      lessonTitle,
      startedAt: iso(startedAt),
      endedAt: iso(endedAt),
      joinedAt: iso(p.joinedAt),
      score: p.score,
      correct: p.correct,
      answers: (liveAnswersBy.get(p.id) ?? []).map(({ answer, stem }) => ({
        question: stem,
        selectedIndex: answer.selectedIndex,
        isCorrect: answer.isCorrect,
        pointsAwarded: answer.pointsAwarded,
        answeredAt: iso(answer.answeredAt),
      })),
    })),
    // Staff names, IP addresses and browsers are shown only for the student's own actions.
    auditEntries: auditRows.map((a) => {
      const own = a.actorId === studentId;
      return {
        at: iso(a.at),
        action: a.action,
        actor: own ? 'student' : (a.actorRole ?? a.actorType),
        targetType: a.targetType,
        metadata: a.metadata,
        ...(own && { ip: a.ip, userAgent: a.userAgent }),
      };
    }),
    // Operational "your job finished" messages (kept 90 days once read, 180 days at most).
    notifications: notificationRows.map((n) => ({
      kind: n.kind,
      title: n.title,
      body: n.body,
      link: n.link,
      createdAt: iso(n.createdAt),
      readAt: iso(n.readAt),
    })),
    pushDevices: pushRows.map((d) => ({ userAgent: d.userAgent, subscribedAt: iso(d.createdAt), lastDeliveredAt: iso(d.lastSuccessAt) })),
    notes: [
      'Classroom audio and transcripts belong to lessons, not to individual students, and are not part of this export.',
      'Operational logs (kept 14 days) and encrypted backups (kept about 5 weeks) are not included.',
      'Submission files can be downloaded by a school admin from each downloadPath while signed in.',
    ],
  };
}

export type StudentDataExport = Awaited<ReturnType<typeof exportStudentData>>;

/** One submission file of this student, for the admin export download (404 for anything else). */
export async function getExportFile(institutionId: string, studentId: string, fileId: string) {
  const [row] = await db
    .select({ file: submissionFiles })
    .from(submissionFiles)
    .innerJoin(assignmentSubmissions, eq(assignmentSubmissions.id, submissionFiles.submissionId))
    .innerJoin(users, eq(users.id, assignmentSubmissions.studentId))
    .where(and(eq(submissionFiles.id, fileId), eq(assignmentSubmissions.studentId, studentId), studentScope(institutionId)));
  if (!row) throw notFound('File');
  return row.file;
}
