import { and, count, desc, eq, inArray, or } from 'drizzle-orm';
import { DAYS, type Day, type Section, type TeacherDashboard, type TimetableSlot } from '@classiq/shared';
import { db } from '../../db/client.js';
import { institutions, lessons, sections, sectionTeachers, timetableSlots } from '../../db/schema/index.js';
import { findSections, sectionStudentCountSql, sectionsTaughtBy } from '../sections/repo.js';
import { findSlots } from '../timetable/repo.js';

const RECENT_LESSONS = 5;

/** Current weekday in the given IANA time zone, or null on Sunday (no timetable day). */
export function weekdayIn(timeZone: string, now = new Date()): Day | null {
  let short: string;
  try {
    short = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' }).format(now);
  } catch {
    short = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', weekday: 'short' }).format(now);
  }
  const day = short.toLowerCase().slice(0, 3);
  return (DAYS as readonly string[]).includes(day) ? (day as Day) : null;
}

/** Slots taught by the teacher, plus every slot of a section they teach. */
const mySlots = (teacherId: string) =>
  or(
    eq(timetableSlots.teacherId, teacherId),
    inArray(
      timetableSlots.sectionId,
      db.select({ id: sectionTeachers.sectionId }).from(sectionTeachers).where(eq(sectionTeachers.teacherId, teacherId)),
    ),
  );

export function mySections(teacherId: string): Promise<Section[]> {
  return findSections(db, sectionsTaughtBy(db, teacherId));
}

export function myTimetable(teacherId: string): Promise<TimetableSlot[]> {
  return findSlots(db, mySlots(teacherId));
}

export async function dashboard(teacherId: string, institutionId: string): Promise<TeacherDashboard> {
  const [inst] = await db
    .select({ timezone: institutions.timezone })
    .from(institutions)
    .where(eq(institutions.id, institutionId));
  const today = weekdayIn(inst?.timezone ?? 'Asia/Kolkata');

  const [sectionRows, todaySlots, statusRows, recentRows] = await Promise.all([
    db
      .select({ id: sections.id, name: sections.name, studentCount: sectionStudentCountSql })
      .from(sections)
      .where(sectionsTaughtBy(db, teacherId))
      .orderBy(sections.name),
    today ? findSlots(db, and(eq(timetableSlots.day, today), mySlots(teacherId))) : Promise.resolve([]),
    db
      .select({ status: lessons.status, n: count() })
      .from(lessons)
      .where(eq(lessons.teacherId, teacherId))
      .groupBy(lessons.status),
    db
      .select({ id: lessons.id, title: lessons.title, status: lessons.status, createdAt: lessons.createdAt })
      .from(lessons)
      .where(eq(lessons.teacherId, teacherId))
      .orderBy(desc(lessons.createdAt))
      .limit(RECENT_LESSONS),
  ]);

  const lessonsByStatus: Record<string, number> = {};
  for (const row of statusRows) lessonsByStatus[row.status] = row.n;

  return {
    sections: sectionRows,
    todaySlots: todaySlots
      .sort((a, b) => a.startTime.localeCompare(b.startTime))
      .map((s) => ({
        sectionName: s.sectionName,
        subject: s.subject,
        startTime: s.startTime,
        endTime: s.endTime,
        room: s.room?.name ?? null,
      })),
    lessonsByStatus,
    recentLessons: recentRows.map((r) => ({
      id: r.id,
      title: r.title,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
    })),
    needsReview: lessonsByStatus.ready_for_review ?? 0,
  };
}
