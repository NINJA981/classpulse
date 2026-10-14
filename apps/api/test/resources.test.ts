/**
 * AI teaching resources: generation through the (in-process) resources queue with stubbed generators,
 * visibility/sharing/copying, edits, Word export, the lesson-plan and worksheet generators against a stubbed
 * OpenAI, grounding assembly and voice prompts against a stubbed Sarvam.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import type { LessonPlanContent, ResourceDetail, ResourceSummary, VoicePromptResult, WorksheetContent } from '@classiq/shared';
import { env } from '../src/config/env.js';
import { db } from '../src/db/client.js';
import { lessons, modelSettings } from '../src/db/schema/index.js';
import { generators, setGeneratorsForTests } from '../src/modules/resources/generators/index.js';
import { generate as generateLessonPlan, rescaleTimings } from '../src/modules/resources/generators/lessonPlan.js';
import type { GenerationContext } from '../src/modules/resources/generators/types.js';
import { generate as generateWorksheet } from '../src/modules/resources/generators/worksheet.js';
import { buildGenerationContext, fitSources } from '../src/modules/resources/grounding.js';
import { resourceJobTiming, startResourceWorker, type ResourceWorkerHandle } from '../src/modules/resources/queue.js';
import { PipelineError } from '../src/pipeline/errors.js';
import { httpRetryPolicy } from '../src/pipeline/http.js';
import { llmRetryPolicy } from '../src/pipeline/llm.js';
import { teachingResources } from '../src/db/schema/index.js';
import { anon, as, createInstitution, createUser, createWorld } from './helpers.js';
import { insertLesson, makeWav } from './fixtures/lessons.js';

type World = Awaited<ReturnType<typeof createWorld>>;
let w: World;
let worker: ResourceWorkerHandle;
let restore: (() => void) | null = null;

const PLAN: LessonPlanContent = {
  overview: 'Light travels in straight lines.',
  level: 'Class 6',
  durationMin: 40,
  objectives: ['Explain shadows'],
  prerequisites: [],
  materials: ['Torch'],
  sections: [
    { title: 'Hook', durationMin: 10, activity: 'Shadow puppets', teacherNotes: 'Ask why', studentTask: 'Observe' },
    { title: 'Explain', durationMin: 30, activity: 'Pinhole camera', teacherNotes: 'Draw rays', studentTask: 'Build it' },
  ],
  assessment: ['Exit ticket'],
  homework: 'Draw a shadow at noon and evening.',
  differentiation: { support: 'Diagram', extension: 'Eclipses' },
};

const SHEET: WorksheetContent = {
  instructions: 'Answer all questions.',
  sections: [
    {
      title: 'Section A',
      items: [
        { number: 1, type: 'mcq', prompt: 'Light travels in?', options: ['Straight lines', 'Curves', 'Circles', 'Zigzags'], answer: 'Straight lines', marks: 1 },
        { number: 2, type: 'fill_blank', prompt: 'An opaque object casts a _____.', options: [], answer: 'shadow', marks: 1 },
      ],
    },
  ],
};

beforeAll(() => {
  resourceJobTiming.backoffMs = 1;
  worker = startResourceWorker();
});
afterAll(async () => {
  await worker.close();
});

beforeEach(async () => {
  w = await createWorld();
  restore = setGeneratorsForTests({
    lesson_plan: async () => ({ content: PLAN, meta: { stub: true } }),
    worksheet: async () => ({ content: SHEET }),
  });
});
afterEach(() => {
  restore?.();
  vi.unstubAllGlobals();
});

async function waitForResource(id: string, user = w.teacher): Promise<ResourceDetail> {
  for (let i = 0; i < 200; i++) {
    const res = await as(user).get(`/api/resources/${id}`);
    const r = res.body as ResourceDetail;
    if (r.status === 'ready' || r.status === 'failed') return r;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error('resource did not finish');
}

async function generated(type: 'lesson_plan' | 'worksheet' = 'lesson_plan', user = w.teacher): Promise<ResourceDetail> {
  const res = await as(user).post('/api/resources/generate').send({ prompt: 'Shadows for class 6', options: { type } });
  expect(res.status).toBe(201);
  return waitForResource((res.body as ResourceDetail).id, user);
}

describe('generation', () => {
  it('requires a teacher session', async () => {
    expect((await anon().get('/api/resources')).status).toBe(401);
    expect((await as(w.student).post('/api/resources/generate').send({ options: { type: 'worksheet' } })).status).toBe(403);
  });

  it('queues a resource and stores the generated content', async () => {
    const res = await as(w.teacher)
      .post('/api/resources/generate')
      .send({ prompt: 'Shadows for class 6', language: 'ta-IN', options: { type: 'lesson_plan', durationMin: 40 } });
    expect(res.status).toBe(201);
    const queued = res.body as ResourceDetail;
    expect(queued).toMatchObject({ type: 'lesson_plan', title: 'Lesson plan: Shadows for class 6', mine: true, shared: false, language: 'ta-IN' });
    expect(queued.options).toMatchObject({ type: 'lesson_plan', durationMin: 40, periods: 1 });

    const done = await waitForResource(queued.id);
    expect(done.status).toBe('ready');
    expect(done.content).toEqual(PLAN);
    const row = await db.query.teachingResources.findFirst({ where: eq(teachingResources.id, queued.id) });
    expect(row?.aiMeta).toMatchObject({ stub: true, model: 'gpt-4.1-mini' });

    const list = (await as(w.teacher).get('/api/resources?type=lesson_plan')).body as ResourceSummary[];
    expect(list.map((r) => r.id)).toEqual([queued.id]);
    expect((await as(w.teacher).get('/api/resources?type=worksheet')).body).toEqual([]);
  });

  it('validates the request and the grounding sources', async () => {
    expect((await as(w.teacher).post('/api/resources/generate').send({ options: { type: 'nope' } })).status).toBe(400);
    expect((await as(w.teacher).post('/api/resources/generate').send({ options: { type: 'worksheet' } })).status).toBe(400);

    const lesson = await insertLesson({ institutionId: w.institution.id, teacherId: w.teacher.id, sectionId: w.section.id, status: 'transcribed' });
    await db.update(lessons).set({ transcript: 'Shadows form when light is blocked.' }).where(eq(lessons.id, lesson.id));
    const other = await as(w.otherTeacher).post('/api/resources/generate').send({ lessonIds: [lesson.id], options: { type: 'worksheet' } });
    expect(other.status).toBe(400);

    const school2 = await createInstitution();
    const outsider = await createUser(school2.id, 'teacher');
    const course = await as(outsider).post('/api/curriculum/courses').send({ title: 'Foreign' });
    const foreign = await as(w.teacher).post('/api/resources/generate').send({ courseId: course.body.id, options: { type: 'worksheet' } });
    expect(foreign.status).toBe(404);
  });

  it('marks the resource failed with the generator’s user message, and regenerates', async () => {
    let calls = 0;
    setGeneratorsForTests({
      worksheet: async () => {
        calls++;
        throw new PipelineError('bad output', { retryable: false, userMessage: 'The AI returned an invalid worksheet twice.' });
      },
    });
    const failed = await generated('worksheet');
    expect(failed).toMatchObject({ status: 'failed', failureReason: 'The AI returned an invalid worksheet twice.', content: null });
    expect(calls).toBe(1);

    setGeneratorsForTests({ worksheet: async () => ({ content: SHEET }) });
    const again = await as(w.teacher).post(`/api/resources/${failed.id}/regenerate`);
    expect(again.status).toBe(200);
    expect((await waitForResource(failed.id)).content).toEqual(SHEET);
  });

  it('retries a retryable failure once (2 attempts) and hides unknown errors', async () => {
    let calls = 0;
    setGeneratorsForTests({
      worksheet: async () => {
        calls++;
        throw new Error('socket hang up at 10.0.0.1');
      },
    });
    const failed = await generated('worksheet');
    expect(calls).toBe(2);
    expect(failed.failureReason).toBe('Processing failed. Please try again.');
  });
});

describe('editing, sharing, copying and export', () => {
  it('lets only the owner edit, validating content against the type schema', async () => {
    const r = await generated('worksheet');
    const edited = { ...SHEET, instructions: 'Use a pencil.' };
    const ok = await as(w.teacher).patch(`/api/resources/${r.id}`).send({ title: 'Shadows worksheet', content: edited });
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ title: 'Shadows worksheet', content: { instructions: 'Use a pencil.' } });

    const bad = await as(w.teacher).patch(`/api/resources/${r.id}`).send({ content: { instructions: 1 } });
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe('VALIDATION_FAILED');

    expect((await as(w.otherTeacher).patch(`/api/resources/${r.id}`).send({ title: 'x' })).status).toBe(404);
  });

  it('shares with the school library, lets colleagues view and copy, unshares and deletes', async () => {
    const r = await generated('lesson_plan');
    expect((await as(w.otherTeacher).get(`/api/resources/${r.id}`)).status).toBe(404);

    const shared = await as(w.teacher).post(`/api/resources/${r.id}/share`);
    expect(shared.body).toMatchObject({ shared: true });
    const library = (await as(w.otherTeacher).get('/api/resources?scope=shared')).body as ResourceSummary[];
    expect(library.map((x) => x.id)).toEqual([r.id]);
    const view = await as(w.otherTeacher).get(`/api/resources/${r.id}`);
    expect(view.body).toMatchObject({ mine: false, content: PLAN });
    expect((await as(w.otherTeacher).patch(`/api/resources/${r.id}`).send({ title: 'x' })).status).toBe(403);
    expect((await as(w.otherTeacher).delete(`/api/resources/${r.id}`)).status).toBe(403);
    expect((await as(w.otherTeacher).post(`/api/resources/${r.id}/regenerate`)).status).toBe(403);

    const school2 = await createInstitution();
    const outsider = await createUser(school2.id, 'teacher');
    expect((await as(outsider).get(`/api/resources/${r.id}`)).status).toBe(404);
    expect((await as(outsider).get('/api/resources?scope=shared')).body).toEqual([]);

    const copy = await as(w.otherTeacher).post(`/api/resources/${r.id}/copy`);
    expect(copy.status).toBe(201);
    expect(copy.body).toMatchObject({ mine: true, shared: false, status: 'ready', content: PLAN, title: `${r.title} (copy)` });
    expect(((await as(w.otherTeacher).get('/api/resources')).body as ResourceSummary[]).map((x) => x.id)).toEqual([copy.body.id]);

    await as(w.teacher).post(`/api/resources/${r.id}/unshare`);
    expect((await as(w.otherTeacher).get(`/api/resources/${r.id}`)).status).toBe(404);
    expect((await as(w.teacher).delete(`/api/resources/${r.id}`)).status).toBe(204);
    expect((await as(w.teacher).get(`/api/resources/${r.id}`)).status).toBe(404);
  });

  it('downloads lesson plans and worksheets as Word documents', async () => {
    for (const type of ['lesson_plan', 'worksheet'] as const) {
      const r = await generated(type);
      const res = await as(w.teacher).get(`/api/resources/${r.id}/export.docx`).buffer(true).parse((resp, cb) => {
        const chunks: Buffer[] = [];
        resp.on('data', (c: Buffer) => chunks.push(c));
        resp.on('end', () => cb(null, Buffer.concat(chunks)));
      });
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      expect(res.headers['content-disposition']).toMatch(/attachment; filename=".+\.docx"/);
      expect((res.body as Buffer).subarray(0, 2).toString('latin1')).toBe('PK');
      expect((await as(w.teacher).get(`/api/resources/${r.id}/export.pptx`)).status).toBe(404);
    }
  });
});

/* ------------------------------------------ generators ------------------------------------------ */

const chatResponse = (content: unknown) =>
  new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(content), refusal: null } }] }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

function ctxFor(options: GenerationContext['options'], extra: Partial<GenerationContext> = {}): GenerationContext {
  return {
    resourceId: '00000000-0000-4000-8000-000000000000',
    institutionId: w.institution.id,
    type: options.type,
    title: 'Shadows',
    prompt: 'Make it hands-on',
    language: 'ta-IN',
    options,
    course: { title: 'Class 6 Science', level: 'Class 6', board: 'CBSE', subject: 'Science' },
    units: [{ title: 'Light, Shadows and Reflections', summary: null, objectives: [] }],
    groundingText: '## Teacher material: Notes\nA shadow forms when an opaque object blocks light.',
    model: 'gpt-4.1-mini',
    ...extra,
  };
}

describe('lesson plan and worksheet generators', () => {
  const saved = { key: env.OPENAI_API_KEY };
  const savedLlm = { ...llmRetryPolicy };
  beforeEach(() => {
    env.OPENAI_API_KEY = 'test-key';
    Object.assign(llmRetryPolicy, { attempts: 1, baseDelayMs: 1, maxDelayMs: 1 });
    restore?.();
    restore = null;
  });
  afterEach(() => {
    env.OPENAI_API_KEY = saved.key;
    Object.assign(llmRetryPolicy, savedLlm);
  });

  it('asks for a repair when timings do not add up, with the grounding and language rules in the prompt', async () => {
    const bodies: { messages: { role: string; content: string }[]; response_format: { json_schema: { strict: boolean } } }[] = [];
    let n = 0;
    vi.stubGlobal('fetch', async (_url: string, init?: RequestInit) => {
      bodies.push(JSON.parse(String(init?.body)));
      n++;
      const offBy5 = PLAN.sections.map((sec, i) => (i === 0 ? { ...sec, durationMin: 15 } : sec));
      return chatResponse(n === 1 ? { ...PLAN, sections: offBy5 } : PLAN);
    });
    const result = await generateLessonPlan(ctxFor({ type: 'lesson_plan', durationMin: 40, periods: 1 }));
    expect(n).toBe(2);
    expect(result.content).toMatchObject({ durationMin: 40, sections: PLAN.sections });
    expect(result.meta).toMatchObject({ repaired: true, timingsAdjusted: false });
    expect(bodies[0]!.response_format.json_schema.strict).toBe(true);
    const [system, user] = bodies[0]!.messages;
    expect(system!.content).toMatch(/Use ONLY facts/);
    expect(system!.content).toMatch(/Tamil/);
    expect(user!.content).toContain('opaque object blocks light');
    expect(user!.content).toContain('Make it hands-on');
    expect(bodies[1]!.messages.at(-1)!.content).toMatch(/add up to 45 minutes but must add up to exactly 40/);
  });

  it('rescales timings that are still off after the repair', async () => {
    vi.stubGlobal('fetch', async () =>
      chatResponse({ ...PLAN, durationMin: 90, sections: PLAN.sections.map((s) => ({ ...s, durationMin: s.durationMin * 2 })) }),
    );
    const result = await generateLessonPlan(ctxFor({ type: 'lesson_plan', durationMin: 45, periods: 2 }));
    const content = result.content as LessonPlanContent;
    expect(content.durationMin).toBe(90);
    expect(content.sections.reduce((s, x) => s + x.durationMin, 0)).toBe(90);
    expect(result.meta).toMatchObject({ timingsAdjusted: true });

    expect(rescaleTimings(PLAN.sections, 45).map((s) => s.durationMin)).toEqual([11, 34]);
  });

  it('fails with a readable message when the plan is malformed twice', async () => {
    vi.stubGlobal('fetch', async () => chatResponse({ overview: 'x' }));
    await expect(generateLessonPlan(ctxFor({ type: 'lesson_plan', durationMin: 40, periods: 1 }))).rejects.toMatchObject({
      userMessage: 'The AI returned an invalid lesson plan twice. Please try generating again.',
    });
  });

  it('repairs worksheet items with wrong answers, trims extras and renumbers', async () => {
    const badMcq = { ...SHEET.sections[0]!.items[0]!, answer: 'Rainbows' };
    const extra = { number: 9, type: 'fill_blank', prompt: 'Light is a form of _____.', options: [], answer: 'energy', marks: 1 };
    let n = 0;
    const bodies: string[] = [];
    vi.stubGlobal('fetch', async (_url: string, init?: RequestInit) => {
      bodies.push(String(init?.body));
      n++;
      if (n === 1) return chatResponse({ instructions: 'Go', sections: [{ title: 'A', items: [badMcq, SHEET.sections[0]!.items[1]] }] });
      return chatResponse({ instructions: 'Go', sections: [{ title: 'A', items: [...SHEET.sections[0]!.items, extra] }] });
    });
    const result = await generateWorksheet(ctxFor({ type: 'worksheet', itemCount: 2, difficulty: 'mixed', itemTypes: ['mcq', 'fill_blank'], includeAnswerKey: true }));
    expect(n).toBe(2);
    expect(bodies[1]).toMatch(/answer must be the exact text of one option/);
    const sheet = result.content as WorksheetContent;
    expect(sheet.sections[0]!.items.map((i) => [i.number, i.type])).toEqual([
      [1, 'mcq'],
      [2, 'fill_blank'],
    ]);
  });

  it('rejects item types the teacher did not ask for', async () => {
    const tf = { number: 1, type: 'true_false', prompt: 'Shadows are dark.', options: ['True', 'False'], answer: 'True', marks: 1 };
    vi.stubGlobal('fetch', async () => chatResponse({ instructions: 'Go', sections: [{ title: 'A', items: [tf] }] }));
    await expect(
      generateWorksheet(ctxFor({ type: 'worksheet', itemCount: 1, difficulty: 'easy', itemTypes: ['mcq'], includeAnswerKey: true })),
    ).rejects.toMatchObject({ userMessage: 'The AI returned an invalid worksheet twice. Please try generating again.' });
  });

  it('dispatches through the registry', () => {
    expect(generators.lesson_plan).toBe(generateLessonPlan);
    expect(generators.worksheet).toBe(generateWorksheet);
  });
});

describe('grounding', () => {
  it('fits sources into the budget, giving short ones all their text', () => {
    const text = fitSources(
      [
        { header: '## A', body: 'short' },
        { header: '## B', body: 'x'.repeat(1000) },
      ],
      300,
    );
    expect(text).toContain('## A\nshort');
    expect(text).toContain('[…truncated]');
    expect(text.length).toBeLessThanOrEqual(320);
  });

  it('builds the context from units, the owner’s lessons and materials and the school model', async () => {
    await db.insert(modelSettings).values({
      institutionId: w.institution.id,
      sttProvider: 'sarvam',
      sttModel: 'saaras:v3',
      llmProvider: 'openai',
      llmModel: 'gpt-test',
      questionsPerLesson: 5,
      bilingual: true,
    });
    const course = (await as(w.teacher).post('/api/curriculum/courses').send({ title: 'Class 6 Science', level: 'Class 6' })).body as { id: string };
    const unit = (await as(w.teacher).post(`/api/curriculum/courses/${course.id}/units`).send({ title: 'Light', summary: 'Sources of light.' })).body as {
      id: string;
    };
    const material = (await as(w.teacher).post('/api/curriculum/materials').attach('file', Buffer.from('Mirrors reflect light.'), 'n.txt')).body as {
      id: string;
    };
    const lesson = await insertLesson({ institutionId: w.institution.id, teacherId: w.teacher.id, sectionId: w.section.id, status: 'transcribed' });
    await db.update(lessons).set({ transcript: 'Today we made a pinhole camera.' }).where(eq(lessons.id, lesson.id));

    setGeneratorsForTests({ worksheet: () => new Promise(() => undefined) });
    const res = await as(w.teacher)
      .post('/api/resources/generate')
      .send({ courseId: course.id, unitIds: [unit.id], lessonIds: [lesson.id], materialIds: [material.id], options: { type: 'worksheet' } });
    expect(res.status).toBe(201);
    const row = (await db.query.teachingResources.findFirst({ where: eq(teachingResources.id, res.body.id) }))!;
    const ctx = await buildGenerationContext(row);
    expect(ctx.model).toBe('gpt-test');
    expect(ctx.course).toMatchObject({ title: 'Class 6 Science', level: 'Class 6' });
    expect(ctx.units).toEqual([{ title: 'Light', summary: 'Sources of light.', objectives: [] }]);
    expect(ctx.groundingText).toContain('### Unit: Light\nSources of light.');
    expect(ctx.groundingText).toContain('## Recorded lesson transcript: Photosynthesis (Biology)\nToday we made a pinhole camera.');
    expect(ctx.groundingText).toContain('## Teacher material: n\nMirrors reflect light.');
  });
});

/* ------------------------------------------ voice ------------------------------------------ */

describe('voice prompts', () => {
  const saved = { sarvam: env.SARVAM_API_KEY };
  const savedHttp = { ...httpRetryPolicy };
  beforeEach(() => Object.assign(httpRetryPolicy, { attempts: 1, baseDelayMs: 1, maxDelayMs: 1 }));
  afterEach(() => {
    env.SARVAM_API_KEY = saved.sarvam;
    Object.assign(httpRetryPolicy, savedHttp);
  });

  it('transcribes a short recording with Sarvam (codemix, auto language)', async () => {
    env.SARVAM_API_KEY = 'sarvam-key';
    const calls: { url: string; form: FormData; headers: Record<string, string> }[] = [];
    vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
      calls.push({ url, form: init!.body as FormData, headers: init!.headers as Record<string, string> });
      return new Response(JSON.stringify({ transcript: 'Class 6 க்கு fractions worksheet', language_code: 'ta-IN' }), { status: 200 });
    });
    const res = await as(w.teacher).post('/api/resources/voice').attach('audio', makeWav(2), 'prompt.wav');
    expect(res.status).toBe(200);
    expect(res.body as VoicePromptResult).toEqual({ text: 'Class 6 க்கு fractions worksheet', languageCode: 'ta-IN' });
    expect(calls[0]!.url).toBe(`${env.SARVAM_BASE_URL}/speech-to-text`);
    expect(calls[0]!.headers['api-subscription-key']).toBe('sarvam-key');
    expect(calls[0]!.form.get('model')).toBe('saaras:v3');
    expect(calls[0]!.form.get('mode')).toBe('codemix');
    expect(calls[0]!.form.get('language_code')).toBe('unknown');
  });

  it('rejects long, missing and non-audio uploads and maps provider errors to 502', async () => {
    env.SARVAM_API_KEY = 'sarvam-key';
    vi.stubGlobal('fetch', async () => new Response('{}', { status: 403 }));
    expect((await as(w.teacher).post('/api/resources/voice').attach('audio', makeWav(65, 8000), 'long.wav')).status).toBe(400);
    expect((await as(w.teacher).post('/api/resources/voice')).status).toBe(400);
    expect((await as(w.teacher).post('/api/resources/voice').attach('audio', Buffer.from('hello'), 'x.wav')).status).toBe(415);
    const res = await as(w.teacher).post('/api/resources/voice').attach('audio', makeWav(1), 'p.wav');
    expect(res.status).toBe(502);
    expect(res.body.error.message).toMatch(/credentials were rejected/);
    expect((await as(w.student).post('/api/resources/voice').attach('audio', makeWav(1), 'p.wav')).status).toBe(403);
  });
});
