/** Curriculum: courses, units, the syllabus catalog, AI unit drafts and teacher materials. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import type { CatalogEntry, Course, CourseDetail, Material, Unit, UnitDraft } from '@classpulse/shared';
import { env } from '../src/config/env.js';
import { CATALOG } from '../src/modules/curriculum/catalog.js';
import { normalizeText } from '../src/modules/curriculum/extract.js';
import { llmRetryPolicy } from '../src/pipeline/llm.js';
import { anon, as, createInstitution, createUser, createWorld } from './helpers.js';

type World = Awaited<ReturnType<typeof createWorld>>;
let w: World;

beforeEach(async () => {
  w = await createWorld();
});

const newCourse = async (user = w.teacher, title = 'Class 8 Science') => {
  const res = await as(user).post('/api/curriculum/courses').send({ title, level: 'Class 8', board: 'CBSE', subject: 'Science' });
  expect(res.status).toBe(201);
  return res.body as CourseDetail;
};

const addUnit = async (courseId: string, title: string, user = w.teacher) => {
  const res = await as(user).post(`/api/curriculum/courses/${courseId}/units`).send({ title });
  expect(res.status).toBe(201);
  return res.body as Unit;
};

describe('courses', () => {
  it('requires a teacher session', async () => {
    expect((await anon().get('/api/curriculum/courses')).status).toBe(401);
    expect((await as(w.student).get('/api/curriculum/courses')).status).toBe(403);
    expect((await as(w.admin).get('/api/curriculum/courses')).status).toBe(403);
  });

  it('creates, lists, updates and deletes; colleagues see but cannot edit; other schools get 404', async () => {
    const course = await newCourse();
    expect(course).toMatchObject({ title: 'Class 8 Science', level: 'Class 8', unitCount: 0, units: [], createdBy: { id: w.teacher.id } });

    const list = await as(w.otherTeacher).get('/api/curriculum/courses');
    expect(list.status).toBe(200);
    expect((list.body as Course[]).map((c) => c.id)).toEqual([course.id]);
    expect((await as(w.otherTeacher).get('/api/curriculum/courses?mine=true')).body).toEqual([]);
    expect((await as(w.otherTeacher).patch(`/api/curriculum/courses/${course.id}`).send({ title: 'Mine now' })).status).toBe(403);
    expect((await as(w.otherTeacher).delete(`/api/curriculum/courses/${course.id}`)).status).toBe(403);

    const school2 = await createInstitution();
    const outsider = await createUser(school2.id, 'teacher');
    expect((await as(outsider).get(`/api/curriculum/courses/${course.id}`)).status).toBe(404);
    expect((await as(outsider).get('/api/curriculum/courses')).body).toEqual([]);

    const updated = await as(w.teacher).patch(`/api/curriculum/courses/${course.id}`).send({ title: 'Class 8 Science (A)', board: '' });
    expect(updated.status).toBe(200);
    expect(updated.body).toMatchObject({ title: 'Class 8 Science (A)', board: null });

    expect((await as(w.teacher).post('/api/curriculum/courses').send({ title: '' })).status).toBe(400);
    expect((await as(w.teacher).delete(`/api/curriculum/courses/${course.id}`)).status).toBe(204);
    expect((await as(w.teacher).get(`/api/curriculum/courses/${course.id}`)).status).toBe(404);
  });

  it('adds, edits, reorders and deletes units (positions stay 1..n)', async () => {
    const course = await newCourse();
    const a = await addUnit(course.id, 'Crop production');
    const b = await addUnit(course.id, 'Microorganisms');
    const c = await addUnit(course.id, 'Coal and petroleum');
    expect([a.position, b.position, c.position]).toEqual([1, 2, 3]);

    const edit = await as(w.teacher).patch(`/api/curriculum/units/${b.id}`).send({ summary: 'Bacteria, fungi.', objectives: ['Name microbes'] });
    expect(edit.body).toMatchObject({ summary: 'Bacteria, fungi.', objectives: ['Name microbes'] });
    expect((await as(w.otherTeacher).patch(`/api/curriculum/units/${b.id}`).send({ title: 'x' })).status).toBe(403);

    const bad = await as(w.teacher).put(`/api/curriculum/courses/${course.id}/units/order`).send({ unitIds: [a.id, b.id] });
    expect(bad.status).toBe(400);
    const order = await as(w.teacher).put(`/api/curriculum/courses/${course.id}/units/order`).send({ unitIds: [c.id, a.id, b.id] });
    expect(order.status).toBe(200);
    expect((order.body as CourseDetail).units.map((u) => [u.title, u.position])).toEqual([
      ['Coal and petroleum', 1],
      ['Crop production', 2],
      ['Microorganisms', 3],
    ]);

    expect((await as(w.teacher).delete(`/api/curriculum/units/${c.id}`)).status).toBe(204);
    const after = (await as(w.teacher).get(`/api/curriculum/courses/${course.id}`)).body as CourseDetail;
    expect(after.units.map((u) => [u.title, u.position])).toEqual([
      ['Crop production', 1],
      ['Microorganisms', 2],
    ]);
    expect(after.unitCount).toBe(2);
  });
});

describe('catalog', () => {
  it('lists entries with filters and imports one as a course with units', async () => {
    expect(CATALOG.length).toBeGreaterThan(20);
    expect(new Set(CATALOG.map((e) => e.key)).size).toBe(CATALOG.length);

    const all = await as(w.teacher).get('/api/curriculum/catalog');
    expect(all.status).toBe(200);
    const science = await as(w.teacher).get('/api/curriculum/catalog?level=Class 10&subject=Science');
    const entries = science.body as CatalogEntry[];
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.every((e) => e.level === 'Class 10' && /science/i.test(e.subject))).toBe(true);

    const entry = entries[0]!;
    const imported = await as(w.teacher).post(`/api/curriculum/catalog/${entry.key}/import`).send({ sectionId: w.section.id });
    expect(imported.status).toBe(201);
    const course = imported.body as CourseDetail;
    expect(course).toMatchObject({ title: entry.title, catalogKey: entry.key, section: { id: w.section.id }, unitCount: entry.units.length });
    expect(course.units.map((u) => u.title)).toEqual(entry.units);

    expect((await as(w.teacher).post('/api/curriculum/catalog/no-such-entry/import').send({})).status).toBe(404);
  });
});

describe('AI unit draft', () => {
  const saved = { key: env.OPENAI_API_KEY };
  const savedPolicy = { ...llmRetryPolicy };
  beforeEach(() => Object.assign(llmRetryPolicy, { attempts: 1, baseDelayMs: 1, maxDelayMs: 1 }));
  afterEach(() => {
    vi.unstubAllGlobals();
    env.OPENAI_API_KEY = saved.key;
    Object.assign(llmRetryPolicy, savedPolicy);
  });

  it('drafts a summary + objectives from the unit and its materials (not saved)', async () => {
    env.OPENAI_API_KEY = 'test-key';
    const course = await newCourse();
    const unit = await addUnit(course.id, 'Microorganisms');
    await as(w.teacher)
      .post('/api/curriculum/materials')
      .field('unitId', unit.id)
      .attach('file', Buffer.from('Yeast is used in baking. Lactobacillus turns milk into curd.'), 'notes.txt');

    const bodies: string[] = [];
    vi.stubGlobal('fetch', async (_url: string, init?: RequestInit) => {
      bodies.push(String(init?.body));
      const content = JSON.stringify({ summary: 'Microbes in daily life.', objectives: ['Name two useful microbes', 'Explain fermentation'] });
      return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content, refusal: null } }] }), { status: 200 });
    });
    const res = await as(w.teacher).post(`/api/curriculum/units/${unit.id}/draft-summary`);
    expect(res.status).toBe(200);
    expect(res.body as UnitDraft).toEqual({ summary: 'Microbes in daily life.', objectives: ['Name two useful microbes', 'Explain fermentation'] });
    expect(bodies[0]).toContain('Lactobacillus');
    const stored = (await as(w.teacher).get(`/api/curriculum/courses/${course.id}`)).body as CourseDetail;
    expect(stored.units[0]!.summary).toBeNull();
  });

  it('turns provider failures into a 502 with a readable message', async () => {
    env.OPENAI_API_KEY = 'test-key';
    const course = await newCourse();
    const unit = await addUnit(course.id, 'Microorganisms');
    vi.stubGlobal('fetch', async () => new Response('{}', { status: 401 }));
    const res = await as(w.teacher).post(`/api/curriculum/units/${unit.id}/draft-summary`);
    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('UPSTREAM_FAILED');
  });
});

describe('materials', () => {
  it('uploads a text file, extracts its text and keeps it private to the teacher', async () => {
    const course = await newCourse();
    const res = await as(w.teacher)
      .post('/api/curriculum/materials')
      .field('title', 'Chapter notes')
      .field('courseId', course.id)
      .attach('file', Buffer.from('Photosynthesis   makes food.\r\n\r\n\r\nChlorophyll is green.'), 'notes.txt');
    expect(res.status).toBe(201);
    const m = res.body as Material;
    expect(m).toMatchObject({ title: 'Chapter notes', kind: 'text', course: { id: course.id }, unit: null });
    expect(m.textLength).toBe('Photosynthesis makes food.\n\nChlorophyll is green.'.length);

    expect(((await as(w.teacher).get('/api/curriculum/materials')).body as Material[]).map((x) => x.id)).toEqual([m.id]);
    expect((await as(w.otherTeacher).get('/api/curriculum/materials')).body).toEqual([]);
    expect((await as(w.otherTeacher).delete(`/api/curriculum/materials/${m.id}`)).status).toBe(404);

    const unit = await addUnit(course.id, 'Plants');
    const moved = await as(w.teacher).patch(`/api/curriculum/materials/${m.id}`).send({ unitId: unit.id, title: 'Renamed' });
    expect(moved.body).toMatchObject({ title: 'Renamed', course: { id: course.id }, unit: { id: unit.id } });
    expect(((await as(w.teacher).get(`/api/curriculum/materials?unitId=${unit.id}`)).body as Material[]).length).toBe(1);

    expect((await as(w.teacher).delete(`/api/curriculum/materials/${m.id}`)).status).toBe(204);
    expect((await as(w.teacher).get('/api/curriculum/materials')).body).toEqual([]);
  });

  it('extracts text from a Word document', async () => {
    const doc = new Document({ sections: [{ children: [new Paragraph({ children: [new TextRun('Newton’s laws of motion')] })] }] });
    const buffer = await Packer.toBuffer(doc);
    const res = await as(w.teacher).post('/api/curriculum/materials').attach('file', buffer, 'Laws of motion.docx');
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ title: 'Laws of motion', kind: 'docx', textLength: 'Newton’s laws of motion'.length });
  });

  it('rejects unsupported, fake and empty files and foreign courses', async () => {
    expect((await as(w.teacher).post('/api/curriculum/materials').attach('file', Buffer.from('MZ'), 'setup.exe')).status).toBe(400);
    expect((await as(w.teacher).post('/api/curriculum/materials').attach('file', Buffer.from('not a pdf'), 'fake.pdf')).status).toBe(415);
    expect((await as(w.teacher).post('/api/curriculum/materials').attach('file', Buffer.from('   \n  '), 'blank.txt')).status).toBe(400);
    expect((await as(w.teacher).post('/api/curriculum/materials')).status).toBe(400);

    const school2 = await createInstitution();
    const outsider = await createUser(school2.id, 'teacher');
    const foreign = await newCourse(outsider, 'Other school course');
    const res = await as(w.teacher).post('/api/curriculum/materials').field('courseId', foreign.id).attach('file', Buffer.from('text'), 'a.txt');
    expect(res.status).toBe(404);
  });

  it('normalises whitespace and control characters', () => {
    expect(normalizeText('a\u0000b   c\t\n\n\n\nd ')).toBe('a b c\n\nd');
  });
});
