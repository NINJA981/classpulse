import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../src/db/client.js';
import { assignments, lessons, questions, sections } from '../src/db/schema/index.js';
import { as, createInstitution, createSection, createUser, createWorld } from './helpers.js';

type World = Awaited<ReturnType<typeof createWorld>>;

async function createLesson(world: World, sectionId: string, status: 'published' | 'draft' = 'published') {
  const [lesson] = await db
    .insert(lessons)
    .values({
      institutionId: world.institution.id,
      teacherId: world.teacher.id,
      sectionId,
      title: `Lesson ${Math.floor(Math.random() * 1e6)}`,
      subject: 'Science',
      status,
      publishedAt: status === 'published' ? new Date() : null,
    })
    .returning();
  await db.insert(questions).values({
    lessonId: lesson!.id,
    position: 1,
    stem: 'Q?',
    options: ['A', 'B', 'C', 'D'],
    correctIndex: 1,
    status: 'approved',
  });
  return lesson!;
}

async function createAssignment(
  lessonId: string,
  opts: { status?: 'draft' | 'published' | 'closed'; dueAt?: Date | null; latePolicy?: 'allow_late' | 'closed' } = {},
) {
  const lesson = await db.query.lessons.findFirst({ where: eq(lessons.id, lessonId) });
  const [row] = await db
    .insert(assignments)
    .values({
      lessonId,
      sectionId: lesson!.sectionId,
      teacherId: lesson!.teacherId,
      isPrimary: true,
      latePolicy: opts.latePolicy ?? 'allow_late',
      title: 'Write a summary',
      prompt: 'Summarise the lesson',
      rubric: [{ criterion: 'Clarity', marks: 5, descriptor: 'Clear writing' }],
      status: opts.status ?? 'published',
      dueAt: opts.dueAt === undefined ? new Date(Date.now() + 86_400_000) : opts.dueAt,
    })
    .returning();
  return row!;
}

describe('student: sections & enrollment', () => {
  let world: World;
  beforeEach(async () => {
    world = await createWorld();
  });

  it('lists my sections with teacher names', async () => {
    const res = await as(world.student).get('/api/student/sections');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      expect.objectContaining({ id: world.section.id, name: world.section.name, teachers: [world.teacher.name] }),
    ]);
  });

  it('previews and joins a section by code (case-insensitive)', async () => {
    const newcomer = await createUser(world.institution.id, 'student');
    const code = world.section.joinCode.toLowerCase();
    const preview = await as(newcomer).get(`/api/student/sections/preview/${code}`);
    expect(preview.status).toBe(200);
    expect(preview.body).toMatchObject({ id: world.section.id, alreadyEnrolled: false, teachers: [world.teacher.name] });
    expect(preview.body.joinCode).toBeUndefined();

    const join = await as(newcomer).post('/api/student/enrollments').send({ joinCode: code });
    expect(join.status).toBe(201);
    expect(join.body).toMatchObject({ id: world.section.id, name: world.section.name });

    const again = await as(newcomer).post('/api/student/enrollments').send({ joinCode: code });
    expect(again.status).toBe(200);
    expect(again.body.id).toBe(world.section.id);

    const after = await as(newcomer).get(`/api/student/sections/preview/${code}`);
    expect(after.body.alreadyEnrolled).toBe(true);
  });

  it('rejects expired codes with 409 INVALID_STATE', async () => {
    const newcomer = await createUser(world.institution.id, 'student');
    await db.update(sections).set({ joinCodeExpiresAt: new Date(Date.now() - 1000) }).where(eq(sections.id, world.section.id));
    const join = await as(newcomer).post('/api/student/enrollments').send({ joinCode: world.section.joinCode });
    expect(join.status).toBe(409);
    expect(join.body.error.code).toBe('INVALID_STATE');
    const preview = await as(newcomer).get(`/api/student/sections/preview/${world.section.joinCode}`);
    expect(preview.status).toBe(409);
  });

  it('does not resolve codes from another institution, and validates the code', async () => {
    const other = await createInstitution();
    const foreign = await createSection(other.id);
    expect((await as(world.student).post('/api/student/enrollments').send({ joinCode: foreign.joinCode })).status).toBe(404);
    expect((await as(world.student).get(`/api/student/sections/preview/${foreign.joinCode}`)).status).toBe(404);
    expect((await as(world.student).post('/api/student/enrollments').send({ joinCode: 'bad' })).status).toBe(400);
  });
});

describe('student: assignments', () => {
  let world: World;
  beforeEach(async () => {
    world = await createWorld();
  });

  it('lists published and closed assignments of published lessons in my sections', async () => {
    const lesson = await createLesson(world, world.section.id);
    const visible = await createAssignment(lesson.id);
    const closed = await createAssignment((await createLesson(world, world.section.id)).id, { status: 'closed' });
    await createAssignment((await createLesson(world, world.section.id)).id, { status: 'draft' });
    await createAssignment((await createLesson(world, world.section.id, 'draft')).id);
    const otherSection = await createSection(world.institution.id);
    await createAssignment((await createLesson(world, otherSection.id)).id);

    const res = await as(world.student).get('/api/student/assignments');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    const byId = new Map(res.body.map((a: { id: string }) => [a.id, a]));
    expect(byId.get(visible.id)).toMatchObject({
      lessonId: lesson.id,
      lessonTitle: lesson.title,
      sectionName: world.section.name,
      rubric: [{ criterion: 'Clarity', marks: 5, descriptor: 'Clear writing' }],
      latePolicy: 'allow_late',
      allowFiles: true,
      maxFiles: 5,
      state: 'todo',
      submission: null,
    });
    expect(byId.get(closed.id)).toMatchObject({ state: 'closed', submission: null });
  });

  it('creates and updates a submission (JSON text) until it is returned', async () => {
    const lesson = await createLesson(world, world.section.id);
    const assignment = await createAssignment(lesson.id);
    const first = await as(world.student).post(`/api/student/assignments/${assignment.id}/submission`).send({ text: 'Draft one' });
    expect(first.status).toBe(200);
    expect(first.body.state).toBe('submitted');
    expect(first.body.submission).toMatchObject({ text: 'Draft one', files: [], isLate: false, status: 'submitted', maxMarks: 5 });
    const second = await as(world.student).post(`/api/student/assignments/${assignment.id}/submission`).send({ text: 'Final' });
    expect(second.body.submission).toMatchObject({ id: first.body.submission.id, text: 'Final' });

    // Other students do not see my submission.
    const theirs = await as(world.otherStudent).get('/api/student/assignments');
    expect(theirs.body[0].submission).toBeNull();

    // Needs an answer or a file.
    expect((await as(world.otherStudent).post(`/api/student/assignments/${assignment.id}/submission`).send({ text: '' })).status).toBe(400);
    expect((await as(world.otherStudent).post(`/api/student/assignments/${assignment.id}/submission`).send({})).status).toBe(400);
  });

  it('flags late work (allow late) and refuses it (closed policy or closed assignment)', async () => {
    const lesson = await createLesson(world, world.section.id);
    const lateOk = await createAssignment(lesson.id, { dueAt: new Date(Date.now() - 60_000) });
    const res = await as(world.student).post(`/api/student/assignments/${lateOk.id}/submission`).send({ text: 'Late' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ state: 'late', submission: { isLate: true } });

    const strict = await createAssignment((await createLesson(world, world.section.id)).id, {
      dueAt: new Date(Date.now() - 60_000),
      latePolicy: 'closed',
    });
    expect((await as(world.student).post(`/api/student/assignments/${strict.id}/submission`).send({ text: 'x' })).status).toBe(409);
    const closed = await createAssignment((await createLesson(world, world.section.id)).id, { status: 'closed' });
    expect((await as(world.student).post(`/api/student/assignments/${closed.id}/submission`).send({ text: 'x' })).status).toBe(409);

    const otherSection = await createSection(world.institution.id);
    const hidden = await createAssignment((await createLesson(world, otherSection.id)).id);
    expect((await as(world.student).post(`/api/student/assignments/${hidden.id}/submission`).send({ text: 'x' })).status).toBe(404);
  });
});

describe('student: guardians', () => {
  let world: World;
  beforeEach(async () => {
    world = await createWorld();
  });

  const guardian = { name: 'Sunita', relation: 'mother', phone: '+91 98765 43210', email: 'Sunita@Mail.com' };

  it('adds, lists and removes own guardians', async () => {
    const created = await as(world.student).post('/api/student/guardians').send(guardian);
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ name: 'Sunita', relation: 'mother', email: 'sunita@mail.com', receiveUpdates: true });

    expect((await as(world.student).post('/api/student/guardians').send(guardian)).status).toBe(409);
    expect((await as(world.student).post('/api/student/guardians').send({ ...guardian, phone: 'abc' })).status).toBe(400);

    const list = await as(world.student).get('/api/student/guardians');
    expect(list.body).toHaveLength(1);
    expect((await as(world.otherStudent).get('/api/student/guardians')).body).toEqual([]);

    // Another student cannot delete it.
    expect((await as(world.otherStudent).delete(`/api/student/guardians/${created.body.id}`)).status).toBe(404);
    expect((await as(world.student).delete(`/api/student/guardians/${created.body.id}`)).status).toBe(204);
    expect((await as(world.student).delete(`/api/student/guardians/${created.body.id}`)).status).toBe(404);
  });
});

describe('student: profile & dashboard', () => {
  let world: World;
  beforeEach(async () => {
    world = await createWorld();
  });

  it('updates email with uniqueness checks', async () => {
    const res = await as(world.student).patch('/api/student/profile').send({ email: 'Me@School.in' });
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ id: world.student.id, email: 'me@school.in', role: 'student' });
    expect((await as(world.otherStudent).patch('/api/student/profile').send({ email: 'me@school.in' })).status).toBe(409);
    const cleared = await as(world.student).patch('/api/student/profile').send({ email: null });
    expect(cleared.body.user.email).toBeNull();
  });

  it('summarises sections, quizzes, attempts and assignments', async () => {
    const done = await createLesson(world, world.section.id);
    const pending = await createLesson(world, world.section.id);
    await createAssignment(done.id);
    const [q] = await db.select().from(questions).where(eq(questions.lessonId, done.id));
    await as(world.student)
      .post(`/api/student/quizzes/${done.id}/attempts`)
      .send({ idempotencyKey: randomUUID(), answers: [{ questionId: q!.id, selectedIndex: 1 }] });

    const res = await as(world.student).get('/api/student/dashboard');
    expect(res.status).toBe(200);
    expect(res.body.sections).toHaveLength(1);
    expect(res.body.pendingQuizzes.map((p: { lessonId: string }) => p.lessonId)).toEqual([pending.id]);
    expect(res.body.recentAttempts).toEqual([expect.objectContaining({ lessonId: done.id, title: done.title, scorePct: 100 })]);
    expect(res.body.upcomingAssignments).toEqual([expect.objectContaining({ title: 'Write a summary', submitted: false })]);
    expect(res.body.averageScorePct).toBe(100);
  });

  it('returns an empty dashboard for a student with no sections', async () => {
    const loner = await createUser(world.institution.id, 'student');
    const res = await as(loner).get('/api/student/dashboard');
    expect(res.body).toEqual({ sections: [], pendingQuizzes: [], recentAttempts: [], upcomingAssignments: [], averageScorePct: null });
  });
});
