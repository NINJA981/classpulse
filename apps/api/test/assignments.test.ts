import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import type { Assignment } from '@classiq/shared';
import { db } from '../src/db/client.js';
import { assignmentReminders, assignments, enrollments, lessons, sectionTeachers, users } from '../src/db/schema/index.js';
import { processLessonJob } from '../src/jobs/lessonGeneration.js';
import { setMailerForTests, type MailMessage } from '../src/lib/mailer.js';
import { sendAssignmentReminders } from '../src/modules/assignments/reminders.js';
import { PipelineError } from '../src/pipeline/errors.js';
import { setPipelineProvidersForTests } from '../src/pipeline/providers.js';
import type { GradeInput } from '../src/pipeline/types.js';
import { setLocalEmitter } from '../src/realtime/notify.js';
import { anon, as, createInstitution, createSection, createUser, createWorld } from './helpers.js';
import { insertLesson, insertQuestions, mockGenerate, mockGenerateQuestions, mockTranscription } from './fixtures/lessons.js';

type World = Awaited<ReturnType<typeof createWorld>>;
type User = World['teacher'];

/** A valid 1x1 PNG. */
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
const PDF = Buffer.from('%PDF-1.4\n%fake\n');
const DAY = 86_400_000;
const inDays = (d: number) => new Date(Date.now() + d * DAY).toISOString();

const RUBRIC = [
  { criterion: 'Clarity', marks: 5, descriptor: 'Clear writing' },
  { criterion: 'Accuracy', marks: 10, descriptor: '' },
];

async function create(w: World, overrides: Record<string, unknown> = {}): Promise<Assignment> {
  const res = await as(w.teacher)
    .post('/api/assignments')
    .send({ sectionId: w.section.id, title: 'Leaf essay', prompt: 'Describe a leaf', rubric: RUBRIC, dueAt: inDays(3), ...overrides });
  expect(res.status).toBe(201);
  return res.body as Assignment;
}

async function published(w: World, overrides: Record<string, unknown> = {}): Promise<Assignment> {
  const a = await create(w, overrides);
  await as(w.teacher).post(`/api/assignments/${a.id}/publish`).expect(200);
  return a;
}

const submit = (user: User, id: string) => as(user).post(`/api/student/assignments/${id}/submission`);
const tracker = async (w: World, id: string) =>
  (await as(w.teacher).get(`/api/assignments/${id}/submissions`)).body as { student: { id: string }; status: string; submissionId: string | null }[];

let mail: MailMessage[] = [];
beforeEach(() => {
  mail = [];
  setMailerForTests(async (m) => {
    mail.push(m);
  });
  setLocalEmitter(() => undefined);
});
afterEach(() => {
  setMailerForTests(null);
  setPipelineProvidersForTests(null);
});

describe('assignments: standalone lifecycle', () => {
  it('creates, edits, publishes, closes and re-opens a standalone assignment', async () => {
    const w = await createWorld();
    const a = await create(w, { latePolicy: 'closed', allowFiles: false, reminders: false });
    expect(a).toMatchObject({ lessonId: null, sectionId: w.section.id, status: 'draft', latePolicy: 'closed', allowFiles: false, maxFiles: 5, reminders: false, publishedAt: null });

    // Partial edit keeps the rubric.
    const patched = await as(w.teacher).patch(`/api/assignments/${a.id}`).send({ title: 'Leaf essay v2', maxFiles: 3 });
    expect(patched.status).toBe(200);
    expect(patched.body).toMatchObject({ title: 'Leaf essay v2', maxFiles: 3, rubric: RUBRIC });
    expect((await as(w.teacher).patch(`/api/assignments/${a.id}`).send({ maxFiles: 0 })).status).toBe(400);

    // Drafts are invisible to students and cannot be closed.
    expect((await as(w.student).get('/api/student/assignments')).body).toEqual([]);
    expect((await as(w.teacher).post(`/api/assignments/${a.id}/close`)).status).toBe(409);

    const pub = await as(w.teacher).post(`/api/assignments/${a.id}/publish`);
    expect(pub.body).toMatchObject({ status: 'published', publishedAt: expect.any(String) });
    expect((await as(w.student).get('/api/student/assignments')).body).toEqual([
      expect.objectContaining({ id: a.id, lessonId: null, lessonTitle: null, state: 'todo', sectionName: w.section.name }),
    ]);

    const closed = await as(w.teacher).post(`/api/assignments/${a.id}/close`);
    expect(closed.body.status).toBe('closed');
    expect((await as(w.student).get('/api/student/assignments')).body[0].state).toBe('closed');
    expect((await submit(w.student, a.id).send({ text: 'Too late' })).status).toBe(409);

    // Publishing again re-opens it and keeps the first publish time.
    const reopened = await as(w.teacher).post(`/api/assignments/${a.id}/publish`);
    expect(reopened.body).toMatchObject({ status: 'published', publishedAt: pub.body.publishedAt });
    expect((await as(w.teacher).get(`/api/assignments/${a.id}`)).body.title).toBe('Leaf essay v2');
  });

  it('lists with filters and counts of enrolled students', async () => {
    const w = await createWorld();
    const a = await published(w);
    await create(w, { title: 'Draft one' });
    const other = await createSection(w.institution.id, { teacherIds: [w.teacher.id] });
    await create(w, { sectionId: other.id, title: 'Other section' });
    await submit(w.student, a.id).send({ text: 'Answer' }).expect(200);

    const all = await as(w.teacher).get('/api/assignments');
    expect(all.status).toBe(200);
    expect(all.body).toHaveLength(3);
    const filtered = await as(w.teacher).get(`/api/assignments?sectionId=${w.section.id}&status=published`);
    expect(filtered.body).toEqual([
      expect.objectContaining({
        id: a.id,
        section: { id: w.section.id, name: w.section.name },
        lesson: null,
        status: 'published',
        enrolled: 2,
        submitted: 1,
        late: 0,
        returned: 0,
      }),
    ]);
    expect((await as(w.teacher).get('/api/assignments?status=bogus')).status).toBe(400);
    expect((await as(w.otherTeacher).get('/api/assignments')).body).toEqual([]);
  });

  it('enforces section teaching and roles', async () => {
    const w = await createWorld();
    const a = await create(w);
    const body = { sectionId: w.section.id, title: 'X', prompt: 'Y' };
    expect((await as(w.otherTeacher).post('/api/assignments').send(body)).status).toBe(403);
    const foreign = await createSection((await createInstitution()).id);
    expect((await as(w.teacher).post('/api/assignments').send({ ...body, sectionId: foreign.id })).status).toBe(404);
    expect((await as(w.teacher).post('/api/assignments').send({ ...body, title: '' })).status).toBe(400);
    expect((await as(w.student).post('/api/assignments').send(body)).status).toBe(403);
    expect((await as(w.admin).get('/api/assignments')).status).toBe(403);
    expect((await anon().get('/api/assignments')).status).toBe(401);

    // Other teachers' assignments do not exist for them.
    for (const res of [
      await as(w.otherTeacher).get(`/api/assignments/${a.id}`),
      await as(w.otherTeacher).patch(`/api/assignments/${a.id}`).send({ title: 'Mine' }),
      await as(w.otherTeacher).post(`/api/assignments/${a.id}/publish`),
      await as(w.otherTeacher).get(`/api/assignments/${a.id}/submissions`),
      await as(w.otherTeacher).delete(`/api/assignments/${a.id}`),
    ]) {
      expect(res.status).toBe(404);
    }

    // A co-teacher of the section can manage it.
    await db.insert(sectionTeachers).values({ sectionId: w.section.id, teacherId: w.otherTeacher.id });
    expect((await as(w.otherTeacher).get(`/api/assignments/${a.id}`)).status).toBe(200);
  });

  it('deletes only assignments without submissions', async () => {
    const w = await createWorld();
    const empty = await create(w);
    expect((await as(w.teacher).delete(`/api/assignments/${empty.id}`)).status).toBe(204);
    expect((await as(w.teacher).get(`/api/assignments/${empty.id}`)).status).toBe(404);

    const a = await published(w);
    await submit(w.student, a.id).send({ text: 'Answer' }).expect(200);
    expect((await as(w.teacher).delete(`/api/assignments/${a.id}`)).status).toBe(409);
  });
});

describe('assignments: lesson-attached', () => {
  it('keeps the primary assignment and extra ones; lesson publishing couples all of them', async () => {
    const w = await createWorld();
    const lesson = await insertLesson({ institutionId: w.institution.id, teacherId: w.teacher.id, sectionId: w.section.id, status: 'ready_for_review' });
    await insertQuestions(lesson.id, 1, 'approved');

    const primary = await as(w.teacher).put(`/api/lessons/${lesson.id}/assignment`).send({ title: 'Primary', prompt: 'P', rubric: RUBRIC });
    expect(primary.status).toBe(200);
    // Written like the migration backfill: primary, with the lesson's section and teacher.
    const [row] = await db.select().from(assignments).where(eq(assignments.id, primary.body.id));
    expect(row).toMatchObject({ isPrimary: true, sectionId: w.section.id, teacherId: w.teacher.id, lessonId: lesson.id });

    const extra1 = await as(w.teacher).post(`/api/lessons/${lesson.id}/assignments`).send({ title: 'Extra 1', prompt: 'E1' });
    const extra2 = await as(w.teacher).post(`/api/lessons/${lesson.id}/assignments`).send({ title: 'Extra 2', prompt: 'E2' });
    expect(extra1.status).toBe(201);
    expect(extra1.body).toMatchObject({ lessonId: lesson.id, sectionId: w.section.id, status: 'draft' });
    expect((await as(w.otherTeacher).post(`/api/lessons/${lesson.id}/assignments`).send({ title: 'X', prompt: 'Y' })).status).toBe(404);
    expect((await as(w.teacher).post(`/api/lessons/${lesson.id}/assignments`).send({ title: '' })).status).toBe(400);

    // The lesson detail still shows the primary one.
    expect((await as(w.teacher).get(`/api/lessons/${lesson.id}`)).body.assignment).toMatchObject({ id: primary.body.id, title: 'Primary' });
    expect((await as(w.teacher).get(`/api/assignments?lessonId=${lesson.id}`)).body).toHaveLength(3);

    // Extra ones cannot go out before their lesson.
    const early = await as(w.teacher).post(`/api/assignments/${extra1.body.id}/publish`);
    expect(early.status).toBe(409);
    expect(early.body.error.message).toMatch(/publish the lesson/i);

    await as(w.teacher).post(`/api/lessons/${lesson.id}/publish`).expect(200);
    let rows = await db.select().from(assignments).where(eq(assignments.lessonId, lesson.id));
    expect(rows.every((r) => r.status === 'published' && r.publishedAt !== null)).toBe(true);
    const visible = await as(w.student).get('/api/student/assignments');
    expect(visible.body.map((a: { title: string }) => a.title).sort()).toEqual(['Extra 1', 'Extra 2', 'Primary']);
    expect(visible.body[0]).toMatchObject({ lessonId: lesson.id, lessonTitle: lesson.title });

    // Closed ones stay closed across unpublish/publish; the others follow the lesson.
    await as(w.teacher).post(`/api/assignments/${extra2.body.id}/close`).expect(200);
    await as(w.teacher).post(`/api/lessons/${lesson.id}/unpublish`).expect(200);
    rows = await db.select().from(assignments).where(eq(assignments.lessonId, lesson.id));
    expect(Object.fromEntries(rows.map((r) => [r.title, r.status]))).toEqual({ Primary: 'draft', 'Extra 1': 'draft', 'Extra 2': 'closed' });
    expect(rows.find((r) => r.title === 'Primary')!.publishedAt).toBeNull();
    expect((await as(w.student).get('/api/student/assignments')).body).toEqual([]);

    await as(w.teacher).post(`/api/lessons/${lesson.id}/publish`).expect(200);
    rows = await db.select().from(assignments).where(eq(assignments.lessonId, lesson.id));
    expect(Object.fromEntries(rows.map((r) => [r.title, r.status]))).toEqual({ Primary: 'published', 'Extra 1': 'published', 'Extra 2': 'closed' });

    // Adding one to a published lesson: it starts as a draft and can be published on its own.
    const late = await as(w.teacher).post(`/api/lessons/${lesson.id}/assignments`).send({ title: 'Extra 3', prompt: 'E3' });
    expect(late.body.status).toBe('draft');
    expect((await as(w.teacher).post(`/api/assignments/${late.body.id}/publish`)).body.status).toBe('published');
  });

  it('validates the lesson when creating through /assignments', async () => {
    const w = await createWorld();
    const lesson = await insertLesson({ institutionId: w.institution.id, teacherId: w.teacher.id, sectionId: w.section.id });
    const other = await createSection(w.institution.id, { teacherIds: [w.teacher.id] });
    const base = { title: 'X', prompt: 'Y', lessonId: lesson.id };
    expect((await as(w.teacher).post('/api/assignments').send({ ...base, sectionId: other.id })).status).toBe(400);
    const ok = await as(w.teacher).post('/api/assignments').send({ ...base, sectionId: w.section.id });
    expect(ok.status).toBe(201);
    expect(ok.body.lessonId).toBe(lesson.id);

    // A lesson of another teacher (even in a shared section) is not attachable.
    const theirs = await insertLesson({ institutionId: w.institution.id, teacherId: w.otherTeacher.id, sectionId: w.section.id });
    expect((await as(w.teacher).post('/api/assignments').send({ ...base, lessonId: theirs.id, sectionId: w.section.id })).status).toBe(404);
  });

  it('regeneration rewrites only the primary assignment', async () => {
    setPipelineProvidersForTests({ transcribe: async () => mockTranscription(), generate: mockGenerate, generateQuestions: mockGenerateQuestions });
    const w = await createWorld();
    const lesson = await insertLesson({
      institutionId: w.institution.id,
      teacherId: w.teacher.id,
      sectionId: w.section.id,
      withAudio: true,
      status: 'queued',
      generationAttempt: 1,
      quizRequest: { questionCount: 3, difficulty: 'mixed', mode: 'replace_all' },
    });
    const extra = await as(w.teacher).post(`/api/lessons/${lesson.id}/assignments`).send({ title: 'Extra', prompt: 'Mine', rubric: RUBRIC });
    expect(extra.status).toBe(201);

    await processLessonJob({ lessonId: lesson.id, attempt: 1 }, { attemptNumber: 1, maxAttempts: 3 });
    const primary = await db.query.assignments.findFirst({ where: and(eq(assignments.lessonId, lesson.id), eq(assignments.isPrimary, true)) });
    expect(primary).toMatchObject({ title: 'Leaf experiment', sectionId: w.section.id, teacherId: w.teacher.id });

    // Start over: the primary is rewritten in place, the extra one is untouched.
    await db.update(assignments).set({ title: 'Edited primary' }).where(eq(assignments.id, primary!.id));
    await db.update(lessons).set({ status: 'queued', generationAttempt: 2, quizRequest: { questionCount: 3, difficulty: 'mixed', mode: 'replace_all' } }).where(eq(lessons.id, lesson.id));
    await processLessonJob({ lessonId: lesson.id, attempt: 2 }, { attemptNumber: 1, maxAttempts: 3 });
    const rows = await db.select().from(assignments).where(eq(assignments.lessonId, lesson.id));
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.isPrimary)).toMatchObject({ id: primary!.id, title: 'Leaf experiment' });
    expect(rows.find((r) => !r.isPrimary)).toMatchObject({ id: extra.body.id, title: 'Extra', prompt: 'Mine', rubric: RUBRIC });
    expect((await as(w.teacher).get(`/api/lessons/${lesson.id}`)).body.assignment.id).toBe(primary!.id);
  });
});

describe('assignments: student submissions with files', () => {
  it('accepts text + PNG via multipart, enforces types, maxFiles and allowFiles, and removes own files', async () => {
    const w = await createWorld();
    const a = await published(w, { maxFiles: 2 });

    const res = await submit(w.student, a.id).field('text', 'My answer').attach('files', PNG, { filename: 'work.png', contentType: 'image/png' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ state: 'submitted', submission: { text: 'My answer', isLate: false } });
    expect(res.body.submission.files).toEqual([
      { id: expect.any(String), name: 'work.png', mime: 'image/png', sizeBytes: PNG.length, url: expect.stringMatching(/^\/api\/assignment-files\//) },
    ]);

    // Wrong type (by MIME or by extension) is refused.
    const exe = await submit(w.student, a.id).attach('files', Buffer.from('MZ'), { filename: 'virus.exe', contentType: 'application/octet-stream' });
    expect(exe.status).toBe(415);
    const disguised = await submit(w.student, a.id).attach('files', Buffer.from('MZ'), { filename: 'virus.exe', contentType: 'image/png' });
    expect(disguised.status).toBe(415);

    // Files are added (text kept when not sent) up to maxFiles.
    const second = await submit(w.student, a.id).attach('files', PDF, { filename: 'notes.pdf', contentType: 'application/pdf' });
    expect(second.status).toBe(200);
    expect(second.body.submission).toMatchObject({ text: 'My answer' });
    expect(second.body.submission.files.map((f: { name: string }) => f.name)).toEqual(['work.png', 'notes.pdf']);
    const third = await submit(w.student, a.id).attach('files', PNG, { filename: 'more.png', contentType: 'image/png' });
    expect(third.status).toBe(400);
    expect(third.body.error.message).toMatch(/at most 2/);

    // Remove one of my files; others cannot.
    const fileId = second.body.submission.files[0].id;
    expect((await as(w.otherStudent).delete(`/api/student/assignments/${a.id}/files/${fileId}`)).status).toBe(404);
    const removed = await as(w.student).delete(`/api/student/assignments/${a.id}/files/${fileId}`);
    expect(removed.status).toBe(200);
    expect(removed.body.submission.files.map((f: { name: string }) => f.name)).toEqual(['notes.pdf']);

    // Files-only submission; removing the last file withdraws it.
    const filesOnly = await submit(w.otherStudent, a.id).attach('files', PNG, { filename: 'photo.png', contentType: 'image/png' });
    expect(filesOnly.body.submission).toMatchObject({ text: null });
    const last = await as(w.otherStudent).delete(`/api/student/assignments/${a.id}/files/${filesOnly.body.submission.files[0].id}`);
    expect(last.body).toMatchObject({ state: 'todo', submission: null });

    // No uploads when the assignment does not take files.
    const noFiles = await published(w, { allowFiles: false });
    expect((await submit(w.student, noFiles.id).attach('files', PNG, { filename: 'a.png', contentType: 'image/png' })).status).toBe(400);
  });

  it('serves files to the owner and the section teachers only', async () => {
    const w = await createWorld();
    const a = await published(w);
    const res = await submit(w.student, a.id).attach('files', PNG, { filename: 'work.png', contentType: 'image/png' });
    const url = res.body.submission.files[0].url as string;

    const own = await as(w.student).get(url).buffer(true);
    expect(own.status).toBe(200);
    expect(own.headers['content-type']).toBe('image/png');
    expect(own.headers['cache-control']).toBe('private, no-store');
    expect(own.headers['content-disposition']).toMatch(/^inline; filename="work.png"/);
    expect(Buffer.compare(own.body as Buffer, PNG)).toBe(0);

    expect((await as(w.teacher).get(url)).status).toBe(200);
    expect((await as(w.otherStudent).get(url)).status).toBe(404);
    expect((await as(w.otherTeacher).get(url)).status).toBe(404);
    expect((await as(w.admin).get(url)).status).toBe(404);
    expect((await anon().get(url)).status).toBe(401);
    expect((await as(w.student).get('/api/assignment-files/not-a-uuid')).status).toBe(400);
  });
});

describe('assignments: tracker, grading and returning', () => {
  it('tracks missing / submitted / late / returned and locks returned work', async () => {
    const w = await createWorld();
    const third = await createUser(w.institution.id, 'student');
    await db.insert(enrollments).values({ sectionId: w.section.id, studentId: third.id });
    const a = await published(w);

    await submit(w.student, a.id).send({ text: 'On time' }).expect(200);
    await db.update(assignments).set({ dueAt: new Date(Date.now() - 60_000) }).where(eq(assignments.id, a.id));
    const late = await submit(w.otherStudent, a.id).send({ text: 'Late work' });
    expect(late.body).toMatchObject({ state: 'late', submission: { isLate: true } });

    let rows = await tracker(w, a.id);
    expect(rows).toHaveLength(3);
    const statusOf = (id: string) => rows.find((r) => r.student.id === id)!.status;
    expect([statusOf(w.student.id), statusOf(w.otherStudent.id), statusOf(third.id)]).toEqual(['submitted', 'late', 'missing']);
    expect(rows.find((r) => r.student.id === third.id)).toMatchObject({ submissionId: null, fileCount: 0, totalMarks: null, maxMarks: 15 });

    const sid = rows.find((r) => r.student.id === w.student.id)!.submissionId!;
    // Returning needs a grade first.
    expect((await as(w.teacher).post(`/api/assignments/${a.id}/submissions/${sid}/return`)).status).toBe(409);

    const graded = await as(w.teacher)
      .put(`/api/assignments/${a.id}/submissions/${sid}/grade`)
      .send({ rubricMarks: [{ criterion: 'Clarity', marks: 9 }, { criterion: 'accuracy', marks: 7.5 }], feedback: 'Well argued.' });
    expect(graded.status).toBe(200);
    expect(graded.body).toMatchObject({
      rubricMarks: [{ criterion: 'Clarity', marks: 5 }, { criterion: 'Accuracy', marks: 7.5 }],
      totalMarks: 12.5,
      maxMarks: 15,
      feedback: 'Well argued.',
      status: 'submitted',
      gradedAt: expect.any(String),
    });
    expect((await as(w.teacher).put(`/api/assignments/${a.id}/submissions/${sid}/grade`).send({ rubricMarks: [{ criterion: 'Style', marks: 1 }] })).status).toBe(400);
    expect((await as(w.teacher).put(`/api/assignments/${a.id}/submissions/${sid}/grade`).send({ rubricMarks: [{ criterion: 'Clarity', marks: -1 }] })).status).toBe(400);
    expect((await as(w.otherTeacher).put(`/api/assignments/${a.id}/submissions/${sid}/grade`).send({ rubricMarks: [] })).status).toBe(404);

    // Marks stay hidden from the student until returned.
    let mine = (await as(w.student).get('/api/student/assignments')).body[0];
    expect(mine.submission).toMatchObject({ rubricMarks: null, totalMarks: null, feedback: null, status: 'submitted' });

    const returned = await as(w.teacher).post(`/api/assignments/${a.id}/submissions/${sid}/return`);
    expect(returned.body).toMatchObject({ status: 'returned', returnedAt: expect.any(String) });
    mine = (await as(w.student).get('/api/student/assignments')).body[0];
    expect(mine).toMatchObject({
      state: 'returned',
      submission: { rubricMarks: [{ criterion: 'Clarity', marks: 5 }, { criterion: 'Accuracy', marks: 7.5 }], totalMarks: 12.5, maxMarks: 15, feedback: 'Well argued.' },
    });

    // Returned work is locked for the student.
    await db.update(assignments).set({ dueAt: new Date(Date.now() + DAY) }).where(eq(assignments.id, a.id));
    expect((await submit(w.student, a.id).send({ text: 'Changed' })).status).toBe(409);

    rows = await tracker(w, a.id);
    expect(statusOf(w.student.id)).toBe('returned');
    const summary = (await as(w.teacher).get('/api/assignments')).body[0];
    expect(summary).toMatchObject({ enrolled: 3, submitted: 2, late: 1, returned: 1 });

    const detail = await as(w.teacher).get(`/api/assignments/${a.id}/submissions/${sid}`);
    expect(detail.body).toMatchObject({ id: sid, student: { id: w.student.id, name: w.student.name }, text: 'On time', files: [] });
    expect((await as(w.teacher).get(`/api/assignments/${a.id}/submissions/${late.body.submission.id}x`)).status).toBe(400);
  });

  it('return-all returns graded, unreturned work and emails students who have an email', async () => {
    const w = await createWorld();
    await db.update(users).set({ email: 'kid@school.test' }).where(eq(users.id, w.student.id));
    const third = await createUser(w.institution.id, 'student');
    await db.insert(enrollments).values({ sectionId: w.section.id, studentId: third.id });
    const a = await published(w, { title: 'Volcano poster' });
    for (const s of [w.student, w.otherStudent, third]) await submit(s, a.id).send({ text: 'Work' }).expect(200);
    const rows = await tracker(w, a.id);
    const sidOf = (id: string) => rows.find((r) => r.student.id === id)!.submissionId!;
    for (const s of [w.student, w.otherStudent]) {
      await as(w.teacher).put(`/api/assignments/${a.id}/submissions/${sidOf(s.id)}/grade`).send({ rubricMarks: [{ criterion: 'Clarity', marks: 4 }], feedback: 'Good' }).expect(200);
    }

    const res = await as(w.teacher).post(`/api/assignments/${a.id}/return-all`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ returned: 2 });
    expect((await as(w.teacher).post(`/api/assignments/${a.id}/return-all`)).body).toEqual({ returned: 0 });
    const statuses = (await tracker(w, a.id)).map((r) => [r.student.id, r.status]);
    expect(Object.fromEntries(statuses)).toEqual({ [w.student.id]: 'returned', [w.otherStudent.id]: 'returned', [third.id]: 'submitted' });

    expect(mail).toHaveLength(1);
    expect(mail[0]).toMatchObject({ to: 'kid@school.test', subject: 'Your work on Volcano poster was returned' });
    expect(mail[0]!.text).toContain('http://localhost:3000/student/assignments');
  });

  it('suggests a grade with AI (clamped, stored, never returned automatically)', async () => {
    const w = await createWorld();
    const a = await published(w);
    const sub = await submit(w.student, a.id)
      .field('text', 'Leaves make food.')
      .attach('files', PNG, { filename: 'page1.png', contentType: 'image/png' })
      .attach('files', PDF, { filename: 'notes.pdf', contentType: 'application/pdf' });
    const sid = sub.body.submission.id as string;

    const seen: GradeInput[] = [];
    setPipelineProvidersForTests({
      gradeSubmission: async (input) => {
        seen.push(input);
        return {
          rubricMarks: [{ criterion: 'Clarity', marks: 50 }, { criterion: 'Accuracy', marks: 6 }, { criterion: 'Made up', marks: 3 }],
          feedback: 'Nice work on the leaf structure. Add a labelled diagram next time.',
          note: 'Not read by the AI: notes.pdf (only JPEG and PNG photos are read).',
          model: input.model,
        };
      },
    });
    const res = await as(w.teacher).post(`/api/assignments/${a.id}/submissions/${sid}/ai-suggest`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      rubricMarks: [{ criterion: 'Clarity', marks: 5 }, { criterion: 'Accuracy', marks: 6 }],
      feedback: expect.stringContaining('leaf'),
      note: expect.stringContaining('notes.pdf'),
      createdAt: expect.any(String),
    });
    expect(seen[0]).toMatchObject({ title: 'Leaf essay', text: 'Leaves make food.', rubric: RUBRIC });
    expect(seen[0]!.images.map((i) => [i.name, i.mime, i.data.length])).toEqual([['page1.png', 'image/png', PNG.length]]);
    expect(seen[0]!.skippedFiles).toEqual([expect.stringContaining('notes.pdf')]);

    const detail = await as(w.teacher).get(`/api/assignments/${a.id}/submissions/${sid}`);
    expect(detail.body).toMatchObject({ aiSuggestion: { rubricMarks: res.body.rubricMarks }, rubricMarks: null, gradedAt: null, status: 'submitted' });
    expect((await as(w.student).get('/api/student/assignments')).body[0].submission.feedback).toBeNull();

    // Upstream failures surface as 502 with a friendly message.
    setPipelineProvidersForTests({
      gradeSubmission: async () => {
        throw new PipelineError('boom', { retryable: false, userMessage: 'The AI returned an invalid grading suggestion. Please try again.' });
      },
    });
    const failed = await as(w.teacher).post(`/api/assignments/${a.id}/submissions/${sid}/ai-suggest`);
    expect(failed.status).toBe(502);
    expect(failed.body.error.message).toMatch(/invalid grading suggestion/);
    expect((await as(w.otherTeacher).post(`/api/assignments/${a.id}/submissions/${sid}/ai-suggest`)).status).toBe(404);
    expect((await as(w.student).post(`/api/assignments/${a.id}/submissions/${sid}/ai-suggest`)).status).toBe(403);
  });
});

describe('assignments: due-date reminders', () => {
  it('emails each student with an email and no submission once, 24 h before the due date', async () => {
    const w = await createWorld();
    await db.update(users).set({ email: 'a@school.test' }).where(eq(users.id, w.student.id));
    await db.update(users).set({ email: 'b@school.test' }).where(eq(users.id, w.otherStudent.id));
    const noEmail = await createUser(w.institution.id, 'student');
    await db.insert(enrollments).values({ sectionId: w.section.id, studentId: noEmail.id });

    const soon = await published(w, { title: 'Soon', dueAt: new Date(Date.now() + 12 * 3600_000).toISOString() });
    await published(w, { title: 'Later', dueAt: inDays(3) });
    await published(w, { title: 'Quiet', dueAt: new Date(Date.now() + 6 * 3600_000).toISOString(), reminders: false });
    await published(w, { title: 'Past', dueAt: new Date(Date.now() - 3600_000).toISOString() });
    await create(w, { title: 'Draft', dueAt: new Date(Date.now() + 6 * 3600_000).toISOString() });
    await submit(w.otherStudent, soon.id).send({ text: 'Done already' }).expect(200);

    expect(await sendAssignmentReminders()).toBe(1);
    expect(mail).toHaveLength(1);
    expect(mail[0]).toMatchObject({ to: 'a@school.test', subject: expect.stringMatching(/^Reminder: Soon is due /) });
    expect(mail[0]!.html).toContain('http://localhost:3000/student/assignments');

    // Only once.
    expect(await sendAssignmentReminders()).toBe(0);
    expect(mail).toHaveLength(1);
    const sent = await db.select().from(assignmentReminders);
    expect(sent).toEqual([expect.objectContaining({ assignmentId: soon.id, studentId: w.student.id })]);

    // A new due date earns a new reminder.
    await as(w.teacher).patch(`/api/assignments/${soon.id}`).send({ dueAt: new Date(Date.now() + 20 * 3600_000).toISOString() }).expect(200);
    expect(await sendAssignmentReminders()).toBe(1);
  });

  it('sends nothing when email is not configured', async () => {
    setMailerForTests(null);
    const w = await createWorld();
    await db.update(users).set({ email: 'a@school.test' }).where(eq(users.id, w.student.id));
    await published(w, { dueAt: new Date(Date.now() + 3600_000).toISOString() });
    expect(await sendAssignmentReminders()).toBe(0);
    expect(await db.select().from(assignmentReminders)).toEqual([]);
  });
});
