/** Question paper generator (stubbed fetch), Word export, publish-as-exam and Bloom tags on lesson quizzes. */
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExamDetail, QuestionPaperContent, ResourceOptions } from '@classiq/shared';
import { env } from '../src/config/env.js';
import { db } from '../src/db/client.js';
import { examQuestions, teachingResources } from '../src/db/schema/index.js';
import { exportFile } from '../src/modules/resources/exporters/questionPaper.js';
import {
  generate,
  isCollegeLevel,
  sectionTotal,
  standardSections,
  type RawPaper,
} from '../src/modules/resources/generators/questionPaper.js';
import type { GenerationContext } from '../src/modules/resources/generators/types.js';
import { PipelineError } from '../src/pipeline/errors.js';
import { llmRetryPolicy, parseGenerationOutput, promptBlocks } from '../src/pipeline/llm.js';
import { anon, as, createSection, createWorld } from './helpers.js';
import { MOCK_SEGMENTS, rawModelOutput } from './fixtures/lessons.js';

const chatResponse = (content: unknown) =>
  new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(content), refusal: null } }] }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

let bodies: { messages: { role: string; content: string }[] }[] = [];
function stubChat(...responses: unknown[]) {
  bodies = [];
  let i = 0;
  vi.stubGlobal('fetch', async (_url: string, init?: RequestInit) => {
    bodies.push(JSON.parse(String(init?.body)));
    return chatResponse(responses[Math.min(i++, responses.length - 1)]);
  });
}

const saved = { key: env.OPENAI_API_KEY, demo: env.PIPELINE_DEMO_FALLBACK, llm: { ...llmRetryPolicy } };
beforeEach(() => {
  env.OPENAI_API_KEY = 'sk-test';
  env.PIPELINE_DEMO_FALLBACK = false;
  Object.assign(llmRetryPolicy, { attempts: 2, baseDelayMs: 1, maxDelayMs: 2 });
});
afterEach(() => {
  vi.unstubAllGlobals();
  env.OPENAI_API_KEY = saved.key;
  env.PIPELINE_DEMO_FALLBACK = saved.demo;
  Object.assign(llmRetryPolicy, saved.llm);
});

type PaperOpts = Extract<ResourceOptions, { type: 'question_paper' }>;
const paperOptions = (over: Partial<PaperOpts> = {}): PaperOpts => ({
  type: 'question_paper',
  examName: 'Unit Test 1',
  maxMarks: 10,
  durationMin: 40,
  sections: [
    { name: 'A', type: 'mcq', count: 4, marksEach: 1, internalChoice: false },
    { name: 'B', type: 'short', count: 2, marksEach: 3, internalChoice: true },
  ],
  bloomMix: {},
  difficultyMix: { easy: 30, medium: 50, hard: 20 },
  ...over,
});

const ctxFor = (options: PaperOpts, over: Partial<GenerationContext> = {}): GenerationContext => ({
  resourceId: '00000000-0000-4000-8000-000000000001',
  institutionId: '00000000-0000-4000-8000-000000000002',
  type: 'question_paper',
  title: 'Light test',
  prompt: '',
  language: 'en-IN',
  options,
  course: { title: 'Class 10 Science', level: 'Class 10', board: 'CBSE', subject: 'Science' },
  units: [{ title: 'Light', summary: null, objectives: [] }],
  groundingText: 'Light travels in straight lines. The angle of incidence equals the angle of reflection.',
  model: 'gpt-4o-mini',
  ...over,
});

const mcq = (i: number, over: Record<string, unknown> = {}) => ({
  type: 'mcq',
  text: `Which statement about reflection is true? (${i})`,
  options: ['Angle i equals angle r', 'Light bends', 'Light stops', 'Light curves'],
  correctIndex: 0,
  marks: 1,
  bloomLevel: 'remember',
  competency: 'Stating the law of reflection',
  difficulty: 'easy',
  unit: 'Light',
  answer: 'The angle of incidence equals the angle of reflection.',
  markingScheme: '1 mark for the correct option',
  alternative: { text: '', answer: '', markingScheme: '' },
  ...over,
});
const short = (i: number, over: Record<string, unknown> = {}) => ({
  type: 'short',
  text: `Explain why we see our image in a plane mirror. (${i})`,
  options: [],
  correctIndex: -1,
  marks: 3,
  bloomLevel: 'understand',
  competency: 'Explaining image formation',
  difficulty: 'medium',
  unit: 'Light',
  answer: 'Reflected rays appear to come from behind the mirror.',
  markingScheme: '1 mark: reflection; 1 mark: rays diverge; 1 mark: virtual image',
  alternative: { text: `State two properties of a plane-mirror image. (${i})`, answer: 'Virtual and erect.', markingScheme: '1.5 marks each' },
  ...over,
});
const rawPaper = (sections: unknown[][]): RawPaper =>
  ({
    generalInstructions: ['All questions are compulsory.'],
    sections: sections.map((questions, i) => ({ name: String.fromCharCode(65 + i), instructions: '', questions })),
  }) as RawPaper;

const allQuestions = (c: QuestionPaperContent) => c.sections.flatMap((s) => s.questions);
const total = (c: QuestionPaperContent) => allQuestions(c).reduce((s, q) => s + q.marks, 0);

describe('question paper pattern', () => {
  it('gives the CBSE pattern at 80 marks and totals exactly for any maximum', () => {
    expect(standardSections(80, false).map((s) => [s.type, s.count, s.marksEach])).toEqual([
      ['mcq', 20, 1],
      ['very_short', 5, 2],
      ['short', 6, 3],
      ['long', 4, 5],
      ['case_based', 3, 4],
    ]);
    for (const max of [5, 10, 17, 25, 40, 63, 100, 200]) {
      expect(sectionTotal(standardSections(max, false))).toBe(max);
      expect(sectionTotal(standardSections(max, true))).toBe(max);
    }
    expect(standardSections(100, true).map((s) => s.name)).toEqual(['Part A', 'Part B', 'Part C']);
  });

  it('detects college-level courses', () => {
    expect(isCollegeLevel({ course: { title: 'Data Structures', level: 'Semester 3', board: 'Anna University', subject: null }, prompt: '' })).toBe(true);
    expect(isCollegeLevel({ course: { title: 'Class 10 Science', level: 'Class 10', board: 'CBSE', subject: null }, prompt: '' })).toBe(false);
  });
});

describe('question paper generator', () => {
  it('builds a paper whose marks sum exactly to maxMarks, with valid MCQs and internal choice', async () => {
    // The model mis-states marks on two questions; the spec wins.
    stubChat(rawPaper([[mcq(1, { marks: 2 }), mcq(2), mcq(3), mcq(4), mcq(5)], [short(1, { marks: 2.5 }), short(2)]]));
    const { content, meta } = await generate(ctxFor(paperOptions()));
    const paper = content as QuestionPaperContent;
    expect(bodies).toHaveLength(1);
    expect(total(paper)).toBe(10);
    expect(paper.header).toMatchObject({ examName: 'Unit Test 1', subject: 'Science', level: 'Class 10', durationMin: 40, maxMarks: 10 });
    expect(paper.sections.map((s) => [s.name, s.questions.length])).toEqual([
      ['Section A', 4],
      ['Section B', 2],
    ]);
    expect(allQuestions(paper).map((q) => q.number)).toEqual([1, 2, 3, 4, 5, 6]);
    for (const q of paper.sections[0]!.questions) {
      expect(q).toMatchObject({ type: 'mcq', marks: 1, correctIndex: 0, bloomLevel: 'remember' });
      expect(q.options).toHaveLength(4);
      expect(q.alternative).toBeNull();
    }
    for (const q of paper.sections[1]!.questions) {
      expect(q).toMatchObject({ type: 'short', marks: 3, correctIndex: -1, options: [] });
      expect(q.alternative?.text).toMatch(/plane-mirror/);
    }
    expect(meta).toMatchObject({ pattern: 'teacher', repaired: false, marksAdjusted: 2 });
    // Grounding and the exact section spec reach the model.
    const user = bodies[0]!.messages.find((m) => m.role === 'user')!.content;
    expect(user).toContain('Light travels in straight lines');
    expect(user).toMatch(/4 × type "mcq"/);
    expect(bodies[0]!.messages[0]!.content).toMatch(/ONLY facts/);
  });

  it('asks for one repair when a section has invalid MCQs, then uses the corrected paper', async () => {
    const bad = rawPaper([[mcq(1, { options: ['a', 'b', 'c'] }), mcq(2), mcq(3), mcq(4, { correctIndex: 7 })], [short(1), short(2)]]);
    const good = rawPaper([[mcq(1), mcq(2), mcq(3), mcq(4)], [short(1), short(2)]]);
    stubChat(bad, good);
    const { content, meta } = await generate(ctxFor(paperOptions()));
    expect(bodies).toHaveLength(2);
    expect(bodies[1]!.messages.at(-1)!.content).toMatch(/needs 4 valid multiple-choice questions.*got 2/);
    expect(meta).toMatchObject({ repaired: true });
    expect(total(content as QuestionPaperContent)).toBe(10);
  });

  it('requires an OR alternative in internal-choice sections', async () => {
    const noAlt = short(1, { alternative: { text: '', answer: '', markingScheme: '' } });
    stubChat(rawPaper([[mcq(1), mcq(2), mcq(3), mcq(4)], [noAlt, short(2)]]));
    await expect(generate(ctxFor(paperOptions()))).rejects.toBeInstanceOf(PipelineError);
    expect(bodies).toHaveLength(2);
    expect(bodies[1]!.messages.at(-1)!.content).toMatch(/internal choice/);
  });

  it('fails clearly when the teacher’s sections do not add up to maxMarks', async () => {
    stubChat(rawPaper([]));
    const err = await generate(ctxFor(paperOptions({ maxMarks: 12 }))).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(PipelineError);
    expect((err as PipelineError).userMessage).toMatch(/add up to 10 marks but the maximum marks is 12/);
    expect(bodies).toHaveLength(0);
  });

  it('uses a standard pattern when no sections are given', async () => {
    const specs = standardSections(20, false);
    const paper = rawPaper(
      specs.map((s) =>
        Array.from({ length: s.count }, (_, i) =>
          s.type === 'mcq'
            ? mcq(i + 1, { text: `${s.name} mcq ${i}` })
            : short(i + 1, { type: s.type, text: `${s.name} q ${i}`, marks: s.marksEach }),
        ),
      ),
    );
    stubChat(paper);
    const { content, meta } = await generate(ctxFor(paperOptions({ maxMarks: 20, sections: [] })));
    expect(meta).toMatchObject({ pattern: 'standard' });
    expect(total(content as QuestionPaperContent)).toBe(20);
  });

  it('exports a Word document with the answer key', async () => {
    stubChat(rawPaper([[mcq(1), mcq(2), mcq(3), mcq(4)], [short(1), short(2)]]));
    const { content } = await generate(ctxFor(paperOptions()));
    const file = await exportFile({
      type: 'question_paper',
      title: 'Light test',
      content,
      options: paperOptions(),
      language: 'en-IN',
      course: null,
      teacherName: 'Ms Rao',
    });
    expect(file.filename).toBe('Light-test.docx');
    expect(file.buffer.subarray(0, 2).toString()).toBe('PK'); // a zip container
    expect(file.buffer.length).toBeGreaterThan(3000);
  });
});

describe('lesson quiz Bloom tags', () => {
  it('carries bloomLevel and competency, and never drops a question for an odd tag', () => {
    const blocks = promptBlocks(MOCK_SEGMENTS);
    const raw = rawModelOutput(2);
    (raw.questions[1] as Record<string, unknown>).bloomLevel = 'memorise';
    const r = parseGenerationOutput(raw, { questionCount: 2, blocks, local: false });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.questions[0]).toMatchObject({ bloomLevel: 'remember', competency: 'Identifying products of photosynthesis' });
    expect(r.value.questions[1]!.bloomLevel).toBeNull();
  });
});

/* ----------------------------------------------------------------------------
 * POST /api/resources/:id/publish-exam
 * ------------------------------------------------------------------------- */

const inMin = (m: number) => new Date(Date.now() + m * 60_000).toISOString();

async function seedPaper(world: Awaited<ReturnType<typeof createWorld>>, over: Partial<typeof teachingResources.$inferInsert> = {}) {
  stubChat(rawPaper([[mcq(1), mcq(2), mcq(3), mcq(4)], [short(1), short(2)]]));
  const { content } = await generate(ctxFor(paperOptions()));
  vi.unstubAllGlobals();
  const [row] = await db
    .insert(teachingResources)
    .values({
      institutionId: world.institution.id,
      teacherId: world.teacher.id,
      type: 'question_paper',
      title: 'Light test',
      status: 'ready',
      options: paperOptions(),
      content,
      ...over,
    })
    .returning();
  return row!;
}

describe('publish a question paper as an exam', () => {
  const body = (sectionId: string, over: Record<string, unknown> = {}) => ({
    sectionId,
    opensAt: inMin(-5),
    closesAt: inMin(120),
    durationMin: 30,
    ...over,
  });

  it('creates a draft exam with the MCQs only, which the teacher can then publish', async () => {
    const world = await createWorld();
    const paper = await seedPaper(world);
    const t = as(world.teacher);
    const res = await t.post(`/api/resources/${paper.id}/publish-exam`).send(body(world.section.id));
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ mcqCount: 4, skipped: 2 });

    const exam = (await t.get(`/api/exams/${res.body.examId}`)).body as ExamDetail;
    expect(exam).toMatchObject({ status: 'draft', poolSize: 4, questionsPerStudent: 4, title: 'Unit Test 1 · Science' });
    expect(exam.pool).toHaveLength(4);
    expect(exam.pool[0]).toMatchObject({ sourceQuestionId: null, correctIndex: 0, topicTag: 'Light', difficulty: 'easy' });

    const published = await t.post(`/api/exams/${exam.id}/publish`);
    expect(published.status).toBe(200);
    expect(published.body).toMatchObject({ status: 'published', poolSize: 4 });
    expect(await db.select().from(examQuestions).where(eq(examQuestions.examId, exam.id))).toHaveLength(4);
  });

  it('caps questions per student at the MCQ count and validates the window', async () => {
    const world = await createWorld();
    const paper = await seedPaper(world);
    const t = as(world.teacher);
    const res = await t.post(`/api/resources/${paper.id}/publish-exam`).send(body(world.section.id, { questionsPerStudent: 3 }));
    expect((await t.get(`/api/exams/${res.body.examId}`)).body.questionsPerStudent).toBe(3);
    const bad = await t.post(`/api/resources/${paper.id}/publish-exam`).send(body(world.section.id, { closesAt: inMin(-10) }));
    expect(bad.status).toBe(400);
  });

  it('enforces roles, ownership, section and resource type', async () => {
    const world = await createWorld();
    const paper = await seedPaper(world);
    const url = `/api/resources/${paper.id}/publish-exam`;
    expect((await anon().post(url).send(body(world.section.id))).status).toBe(401);
    expect((await as(world.student).post(url).send(body(world.section.id))).status).toBe(403);
    expect((await as(world.admin).post(url).send(body(world.section.id))).status).toBe(403);
    // Another teacher's paper is not revealed.
    expect((await as(world.otherTeacher).post(url).send(body(world.section.id))).status).toBe(404);
    // A section the teacher does not teach.
    const other = await createSection(world.institution.id, { teacherIds: [world.otherTeacher.id] });
    expect((await as(world.teacher).post(url).send(body(other.id))).status).toBe(403);
    // Not a question paper / not ready.
    const sheet = await seedPaper(world, { type: 'worksheet' });
    expect((await as(world.teacher).post(`/api/resources/${sheet.id}/publish-exam`).send(body(world.section.id))).status).toBe(400);
    const queued = await seedPaper(world, { status: 'generating', content: null });
    expect((await as(world.teacher).post(`/api/resources/${queued.id}/publish-exam`).send(body(world.section.id))).status).toBe(409);
  });
});
