/**
 * Competency insights for a section: accuracy per Bloom level and per topic, for the class and for every
 * enrolled student.
 *
 * Sources:
 * - Lesson quizzes: each student's LATEST attempt per lesson; answers are joined to the live question row
 *   (question_id) for its tags (bloom_level; topic = topic_tag, else competency). Answers whose question was
 *   deleted carry no tags and are left out.
 * - Secure exams (submitted attempts): every question on the student's paper counts (unanswered = wrong);
 *   exam questions have a topic but no Bloom level, so they add to topics and the overall figure only.
 */
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { BLOOM_LEVELS, type BloomLevel, type CompetencyInsightRow, type SectionInsights, type SessionUser } from '@classiq/shared';
import { db } from '../../db/client.js';
import { enrollments, lessons, questions, quizAttemptAnswers, quizAttempts, sections, sectionTeachers, users } from '../../db/schema/index.js';
import { notFound } from '../../lib/errors.js';

const GENERAL = 'General';
const round1 = (n: number) => Math.round(n * 10) / 10;

interface Tally {
  n: number;
  correct: number;
}
const pct = (t: Tally | undefined) => (t && t.n ? round1((t.correct / t.n) * 100) : null);
const add = (map: Map<string, Tally>, key: string, n: number, correct: number) => {
  const t = map.get(key) ?? { n: 0, correct: 0 };
  t.n += n;
  t.correct += correct;
  map.set(key, t);
};

/** The section, if this teacher teaches it in their school; 404 otherwise (no existence leak). */
async function taughtSection(user: SessionUser, sectionId: string) {
  const [row] = await db
    .select({ id: sections.id, name: sections.name })
    .from(sections)
    .innerJoin(sectionTeachers, and(eq(sectionTeachers.sectionId, sections.id), eq(sectionTeachers.teacherId, user.id)))
    .where(and(eq(sections.id, sectionId), eq(sections.institutionId, user.institutionId)));
  if (!row) throw notFound('Section');
  return row;
}

type TagRow = { studentId: string; bloom: BloomLevel | null; topic: string | null; n: number; correct: number };

async function quizTallies(sectionId: string): Promise<TagRow[]> {
  const latest = db
    .selectDistinctOn([quizAttempts.studentId, quizAttempts.lessonId], { id: quizAttempts.id, studentId: quizAttempts.studentId })
    .from(quizAttempts)
    .innerJoin(lessons, eq(lessons.id, quizAttempts.lessonId))
    .where(eq(lessons.sectionId, sectionId))
    .orderBy(quizAttempts.studentId, quizAttempts.lessonId, desc(quizAttempts.submittedAt), desc(quizAttempts.id))
    .as('latest');
  const topic = sql<string | null>`coalesce(nullif(btrim(${questions.topicTag}), ''), nullif(btrim(${questions.competency}), ''))`;
  return db
    .select({
      studentId: latest.studentId,
      bloom: questions.bloomLevel,
      topic,
      n: sql<number>`count(*)::int`,
      correct: sql<number>`(count(*) filter (where ${quizAttemptAnswers.isCorrect}))::int`,
    })
    .from(quizAttemptAnswers)
    .innerJoin(latest, eq(latest.id, quizAttemptAnswers.attemptId))
    .innerJoin(questions, eq(questions.id, quizAttemptAnswers.questionId))
    .groupBy(latest.studentId, questions.bloomLevel, topic);
}

async function examTallies(sectionId: string): Promise<TagRow[]> {
  const res = await db.execute<{ student_id: string; topic: string | null; n: number; correct: number }>(sql`
    select a.student_id, nullif(btrim(q.topic_tag), '') as topic,
           count(*)::int as n,
           (count(*) filter (where ans.selected_index = q.correct_index))::int as correct
    from exam_attempts a
    join exams e on e.id = a.exam_id
    cross join lateral jsonb_array_elements(a.paper) as p(item)
    join exam_questions q on q.id = (p.item ->> 'examQuestionId')::uuid
    left join exam_answers ans on ans.attempt_id = a.id and ans.exam_question_id = q.id
    where e.section_id = ${sectionId} and a.status <> 'in_progress'
    group by a.student_id, nullif(btrim(q.topic_tag), '')`);
  return res.rows.map((r) => ({ studentId: r.student_id, bloom: null, topic: r.topic, n: Number(r.n), correct: Number(r.correct) }));
}

export async function sectionInsights(user: SessionUser, sectionId: string): Promise<SectionInsights> {
  const section = await taughtSection(user, sectionId);
  const [students, quiz, exam] = await Promise.all([
    db
      .select({ id: users.id, name: users.name, rollNumber: users.rollNumber })
      .from(enrollments)
      .innerJoin(users, eq(users.id, enrollments.studentId))
      .where(eq(enrollments.sectionId, sectionId))
      .orderBy(asc(users.name)),
    quizTallies(sectionId),
    examTallies(sectionId),
  ]);

  const enrolled = new Set(students.map((s) => s.id));
  // Topics merge case-insensitively; the first spelling seen is shown.
  const topicLabel = new Map<string, string>();
  const keyOf = (topic: string | null) => {
    const label = topic?.trim() || GENERAL;
    const key = label.toLowerCase();
    if (!topicLabel.has(key)) topicLabel.set(key, label);
    return key;
  };

  const classBloom = new Map<string, Tally>();
  const classTopic = new Map<string, Tally>();
  const perStudent = new Map<string, { bloom: Map<string, Tally>; topic: Map<string, Tally>; all: Tally }>();
  for (const r of [...quiz, ...exam]) {
    if (!enrolled.has(r.studentId) || !r.n) continue;
    const s = perStudent.get(r.studentId) ?? { bloom: new Map(), topic: new Map(), all: { n: 0, correct: 0 } };
    perStudent.set(r.studentId, s);
    const key = keyOf(r.topic);
    add(s.topic, key, r.n, r.correct);
    add(classTopic, key, r.n, r.correct);
    if (r.bloom) {
      add(s.bloom, r.bloom, r.n, r.correct);
      add(classBloom, r.bloom, r.n, r.correct);
    }
    s.all.n += r.n;
    s.all.correct += r.correct;
  }

  const bloomRecord = (m: Map<string, Tally> | undefined) =>
    Object.fromEntries(BLOOM_LEVELS.map((b) => [b, pct(m?.get(b))])) as Record<BloomLevel, number | null>;

  const byTopic = [...classTopic.entries()]
    .map(([key, t]) => ({ key, topic: topicLabel.get(key)!, accuracyPct: pct(t), answered: t.n }))
    .sort((a, b) => (a.accuracyPct ?? 101) - (b.accuracyPct ?? 101) || b.answered - a.answered || a.topic.localeCompare(b.topic));

  const rows: CompetencyInsightRow[] = students.map((st) => {
    const s = perStudent.get(st.id);
    return {
      student: { id: st.id, name: st.name, rollNumber: st.rollNumber },
      byBloom: bloomRecord(s?.bloom),
      byTopic: Object.fromEntries(byTopic.map((t) => [t.topic, pct(s?.topic.get(t.key))])),
      overallPct: pct(s?.all),
    };
  });

  return {
    section,
    byBloom: bloomRecord(classBloom),
    byTopic: byTopic.map(({ topic, accuracyPct, answered }) => ({ topic, accuracyPct, answered })),
    students: rows,
  };
}
