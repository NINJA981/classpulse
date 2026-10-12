/**
 * Read-only, paged and searchable views of one school for the platform console. Each view maps
 * its rows to the generic PlatformViewRow (title, subtitle, status, labelled facts) so the console
 * renders them all with one table.
 */
import { and, count, desc, eq, ilike, or, sql, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { Request } from 'express';
import type { Paginated, PlatformSchoolView, PlatformViewQuery, PlatformViewRow } from '@classpulse/shared';
import { db } from '../../db/client.js';
import { audit } from '../../lib/audit.js';
import {
  assignments,
  assignmentSubmissions,
  devices,
  enrollments,
  examAttempts,
  exams,
  lessons,
  liveParticipants,
  liveSessions,
  questions,
  rooms,
  sections,
  sectionTeachers,
  users,
} from '../../db/schema/index.js';

const teacher = alias(users, 'teacher');

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);
const like = (q: string | undefined, ...cols: Parameters<typeof ilike>[0][]): SQL | undefined =>
  q ? or(...cols.map((c) => ilike(c, `%${escapeLike(q)}%`))) : undefined;

const iso = (d: Date | null | undefined) => d?.toISOString() ?? null;

interface Page {
  limit: number;
  offset: number;
}

type ViewFn = (schoolId: string, q: string | undefined, page: Page) => Promise<{ items: PlatformViewRow[]; total: number }>;

const people = (role: 'teacher' | 'student'): ViewFn => async (schoolId, q, page) => {
  const where = and(
    eq(users.institutionId, schoolId),
    eq(users.role, role),
    like(q, users.name, users.email, users.rollNumber),
  );
  const [rows, [total]] = await Promise.all([
    db.select().from(users).where(where).orderBy(users.name).limit(page.limit).offset(page.offset),
    db.select({ n: count() }).from(users).where(where),
  ]);
  return {
    total: total?.n ?? 0,
    items: rows.map((u) => ({
      id: u.id,
      title: u.name,
      subtitle: role === 'student' ? u.rollNumber : u.email,
      status: u.status,
      facts:
        role === 'student'
          ? [
              { label: 'Email', value: u.email },
              { label: 'Last sign-in', value: iso(u.lastLoginAt) },
            ]
          : [
              { label: 'Department', value: u.department },
              { label: 'Last sign-in', value: iso(u.lastLoginAt) },
            ],
      at: iso(u.createdAt),
    })),
  };
};

const sectionsView: ViewFn = async (schoolId, q, page) => {
  const where = and(eq(sections.institutionId, schoolId), like(q, sections.name, sections.subject));
  const [rows, [total]] = await Promise.all([
    db
      .select({
        s: sections,
        teachers: sql<number>`(select count(*)::int from ${sectionTeachers} st where st.section_id = "sections"."id")`,
        students: sql<number>`(select count(*)::int from ${enrollments} e where e.section_id = "sections"."id")`,
      })
      .from(sections)
      .where(where)
      .orderBy(sections.name)
      .limit(page.limit)
      .offset(page.offset),
    db.select({ n: count() }).from(sections).where(where),
  ]);
  return {
    total: total?.n ?? 0,
    items: rows.map(({ s, teachers, students }) => ({
      id: s.id,
      title: s.name,
      subtitle: [s.grade, s.subject].filter(Boolean).join(' · ') || null,
      status: null,
      facts: [
        { label: 'Teachers', value: teachers },
        { label: 'Students', value: students },
      ],
      at: iso(s.createdAt),
    })),
  };
};

const lessonsView: ViewFn = async (schoolId, q, page) => {
  const where = and(eq(lessons.institutionId, schoolId), like(q, lessons.title));
  const [rows, [total]] = await Promise.all([
    db
      .select({
        l: lessons,
        teacherName: teacher.name,
        sectionName: sections.name,
        questions: sql<number>`(select count(*)::int from ${questions} qq where qq.lesson_id = ${lessons.id})`,
      })
      .from(lessons)
      .innerJoin(teacher, eq(teacher.id, lessons.teacherId))
      .innerJoin(sections, eq(sections.id, lessons.sectionId))
      .where(where)
      .orderBy(desc(lessons.createdAt))
      .limit(page.limit)
      .offset(page.offset),
    db.select({ n: count() }).from(lessons).where(where),
  ]);
  return {
    total: total?.n ?? 0,
    items: rows.map(({ l, teacherName, sectionName, questions: n }) => ({
      id: l.id,
      title: l.title,
      subtitle: `${teacherName} · ${sectionName}`,
      status: l.status,
      facts: [
        { label: 'Questions', value: n },
        { label: 'Published', value: iso(l.publishedAt) },
      ],
      at: iso(l.createdAt),
    })),
  };
};

const examsView: ViewFn = async (schoolId, q, page) => {
  const where = and(eq(exams.institutionId, schoolId), like(q, exams.title));
  const [rows, [total]] = await Promise.all([
    db
      .select({
        e: exams,
        teacherName: teacher.name,
        sectionName: sections.name,
        attempts: sql<number>`(select count(*)::int from ${examAttempts} ea where ea.exam_id = ${exams.id})`,
      })
      .from(exams)
      .innerJoin(teacher, eq(teacher.id, exams.teacherId))
      .innerJoin(sections, eq(sections.id, exams.sectionId))
      .where(where)
      .orderBy(desc(exams.createdAt))
      .limit(page.limit)
      .offset(page.offset),
    db.select({ n: count() }).from(exams).where(where),
  ]);
  return {
    total: total?.n ?? 0,
    items: rows.map(({ e, teacherName, sectionName, attempts }) => ({
      id: e.id,
      title: e.title,
      subtitle: `${teacherName} · ${sectionName}`,
      status: e.status,
      facts: [
        { label: 'Attempts', value: attempts },
        { label: 'Published', value: iso(e.publishedAt) },
      ],
      at: iso(e.createdAt),
    })),
  };
};

const assignmentsView: ViewFn = async (schoolId, q, page) => {
  const where = and(eq(sections.institutionId, schoolId), like(q, assignments.title));
  const base = () =>
    db
      .select({
        a: assignments,
        teacherName: teacher.name,
        sectionName: sections.name,
        submissions: sql<number>`(select count(*)::int from ${assignmentSubmissions} sub where sub.assignment_id = ${assignments.id})`,
      })
      .from(assignments)
      .innerJoin(sections, eq(sections.id, assignments.sectionId))
      .innerJoin(teacher, eq(teacher.id, assignments.teacherId));
  const [rows, [total]] = await Promise.all([
    base().where(where).orderBy(desc(assignments.createdAt)).limit(page.limit).offset(page.offset),
    db
      .select({ n: count() })
      .from(assignments)
      .innerJoin(sections, eq(sections.id, assignments.sectionId))
      .where(where),
  ]);
  return {
    total: total?.n ?? 0,
    items: rows.map(({ a, teacherName, sectionName, submissions }) => ({
      id: a.id,
      title: a.title,
      subtitle: `${teacherName} · ${sectionName}`,
      status: a.status,
      facts: [
        { label: 'Submissions', value: submissions },
        { label: 'Due', value: iso(a.dueAt) },
      ],
      at: iso(a.createdAt),
    })),
  };
};

const devicesView: ViewFn = async (schoolId, q, page) => {
  const where = and(eq(devices.institutionId, schoolId), like(q, devices.name, devices.deviceId));
  const [rows, [total]] = await Promise.all([
    db
      .select({ d: devices, roomName: rooms.name })
      .from(devices)
      .innerJoin(rooms, eq(rooms.id, devices.roomId))
      .where(where)
      .orderBy(devices.name)
      .limit(page.limit)
      .offset(page.offset),
    db.select({ n: count() }).from(devices).where(where),
  ]);
  return {
    total: total?.n ?? 0,
    items: rows.map(({ d, roomName }) => ({
      id: d.id,
      title: d.name,
      subtitle: `${d.deviceId} · ${roomName}`,
      status: d.revokedAt ? 'revoked' : d.status,
      facts: [
        { label: 'Agent', value: d.agentVersion },
        { label: 'Last heartbeat', value: iso(d.lastHeartbeatAt) },
      ],
      at: iso(d.createdAt),
    })),
  };
};

const liveView: ViewFn = async (schoolId, q, page) => {
  const where = and(eq(lessons.institutionId, schoolId), like(q, lessons.title));
  const [rows, [total]] = await Promise.all([
    db
      .select({
        s: liveSessions,
        lessonTitle: lessons.title,
        teacherName: teacher.name,
        players: sql<number>`(select count(*)::int from ${liveParticipants} p where p.session_id = ${liveSessions.id})`,
      })
      .from(liveSessions)
      .innerJoin(lessons, eq(lessons.id, liveSessions.lessonId))
      .innerJoin(teacher, eq(teacher.id, liveSessions.hostTeacherId))
      .where(where)
      .orderBy(desc(liveSessions.createdAt))
      .limit(page.limit)
      .offset(page.offset),
    db
      .select({ n: count() })
      .from(liveSessions)
      .innerJoin(lessons, eq(lessons.id, liveSessions.lessonId))
      .where(where),
  ]);
  return {
    total: total?.n ?? 0,
    items: rows.map(({ s, lessonTitle, teacherName, players }) => ({
      id: s.id,
      title: lessonTitle,
      subtitle: teacherName,
      status: s.status,
      facts: [
        { label: 'Players', value: players },
        { label: 'Ended', value: iso(s.endedAt) },
      ],
      at: iso(s.createdAt),
    })),
  };
};

const VIEWS: Record<PlatformSchoolView, ViewFn> = {
  teachers: people('teacher'),
  students: people('student'),
  sections: sectionsView,
  lessons: lessonsView,
  exams: examsView,
  assignments: assignmentsView,
  devices: devicesView,
  'live-sessions': liveView,
};

/** A super admin reading a school's data: every view (and search) is audited when `req` is given. */
export async function schoolView(
  schoolId: string,
  view: PlatformSchoolView,
  query: PlatformViewQuery,
  req: Request | null = null,
): Promise<Paginated<PlatformViewRow>> {
  const { items, total } = await VIEWS[view](schoolId, query.q, {
    limit: query.pageSize,
    offset: (query.page - 1) * query.pageSize,
  });
  if (req) {
    await audit(req, {
      action: 'platform.school.view',
      institutionId: schoolId,
      targetType: 'institution',
      targetId: schoolId,
      metadata: { view, q: query.q ?? null, page: query.page, rows: items.length },
    });
  }
  return { items, total, page: query.page, pageSize: query.pageSize };
}
