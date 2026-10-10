import { count, desc, eq, sql } from 'drizzle-orm';
import type { AdminOverview } from '@classpulse/shared';
import { db } from '../../db/client.js';
import { devices, institutions, lessons, quizAttempts, rooms, sections, users } from '../../db/schema/index.js';

const RECENT_LESSONS = 8;

export async function getOverview(institutionId: string): Promise<AdminOverview> {
  const inst = institutionId;
  const [countsRows, statusRows, recentRows, institutionRow] = await Promise.all([
    db.execute<{
      teachers: number;
      students: number;
      sections: number;
      rooms: number;
      devices_online: number;
      devices_total: number;
      avg_score: number | null;
    }>(sql`
      select
        (select count(*)::int from ${users} where institution_id = ${inst} and role = 'teacher') as teachers,
        (select count(*)::int from ${users} where institution_id = ${inst} and role = 'student') as students,
        (select count(*)::int from ${sections} where institution_id = ${inst}) as sections,
        (select count(*)::int from ${rooms} where institution_id = ${inst}) as rooms,
        (select count(*)::int from ${devices} where institution_id = ${inst} and revoked_at is null
           and status in ('online', 'recording')) as devices_online,
        (select count(*)::int from ${devices} where institution_id = ${inst} and revoked_at is null) as devices_total,
        (select avg(qa.score_pct)::float8 from ${quizAttempts} qa join ${lessons} l on l.id = qa.lesson_id
           where l.institution_id = ${inst}) as avg_score
    `),
    db
      .select({ status: lessons.status, n: count() })
      .from(lessons)
      .where(eq(lessons.institutionId, inst))
      .groupBy(lessons.status),
    db
      .select({
        id: lessons.id,
        title: lessons.title,
        status: lessons.status,
        teacherName: users.name,
        createdAt: lessons.createdAt,
      })
      .from(lessons)
      .innerJoin(users, eq(users.id, lessons.teacherId))
      .where(eq(lessons.institutionId, inst))
      .orderBy(desc(lessons.createdAt))
      .limit(RECENT_LESSONS),
    db
      .select({ id: institutions.id, name: institutions.name, code: institutions.code })
      .from(institutions)
      .where(eq(institutions.id, inst)),
  ]);

  const c = countsRows.rows[0];
  const lessonsByStatus: Record<string, number> = {};
  let totalLessons = 0;
  for (const row of statusRows) {
    lessonsByStatus[row.status] = row.n;
    totalLessons += row.n;
  }
  const avg = c?.avg_score;

  return {
    institution: institutionRow[0] ?? null,
    counts: {
      teachers: c?.teachers ?? 0,
      students: c?.students ?? 0,
      sections: c?.sections ?? 0,
      rooms: c?.rooms ?? 0,
      lessons: totalLessons,
      publishedLessons: lessonsByStatus.published ?? 0,
      devicesOnline: c?.devices_online ?? 0,
      devicesTotal: c?.devices_total ?? 0,
    },
    lessonsByStatus,
    recentLessons: recentRows.map((r) => ({
      id: r.id,
      title: r.title,
      status: r.status,
      teacherName: r.teacherName,
      createdAt: r.createdAt.toISOString(),
    })),
    averageQuizScorePct: avg === null || avg === undefined ? null : Math.round(avg * 10) / 10,
  };
}
