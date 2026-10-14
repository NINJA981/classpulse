/** Presentation generator (stubbed OpenAI fetch) and PPTX export. Nothing touches the network. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PresentationContent } from '@classiq/shared';
import { env } from '../src/config/env.js';
import { PipelineError } from '../src/pipeline/errors.js';
import { llmRetryPolicy } from '../src/pipeline/llm.js';
import { checkDeck, generate, MAX_BULLETS, repairDeck } from '../src/modules/resources/generators/presentation.js';
import type { GenerationContext } from '../src/modules/resources/generators/types.js';
import { exportFile } from '../src/modules/resources/exporters/presentation.js';
import { PPTX_CONTENT_TYPE } from '../src/modules/resources/exporters/types.js';

type Slide = PresentationContent['slides'][number];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const chatResponse = (content: unknown) =>
  json({
    choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(content), refusal: null } }],
  });

let bodies: {
  model: string;
  messages: { role: string; content: string }[];
  response_format: { type: string; json_schema: { strict: boolean; name: string } };
}[] = [];
function stubChat(responder: (n: number) => unknown) {
  bodies = [];
  vi.stubGlobal('fetch', async (_url: string, init?: RequestInit) => {
    bodies.push(JSON.parse(String(init?.body)) as (typeof bodies)[number]);
    return chatResponse(responder(bodies.length));
  });
}

/** A well-formed deck of `count` slides: title, bullets / two_column / quote, summary. */
function deck(count: number, opts: { notes?: boolean } = {}): { slides: Slide[] } {
  const notes =
    opts.notes === false ? '' : 'Say this. Example: a torch. Ask: what happens if the bulb is removed?';
  const slides: Slide[] = Array.from({ length: count }, (_, i): Slide => {
    if (i === 0)
      return {
        layout: 'title',
        title: "Ohm's law",
        subtitle: 'Class 10 Physics',
        bullets: [],
        rightBullets: [],
        speakerNotes: notes,
      };
    if (i === count - 1)
      return {
        layout: 'summary',
        title: 'Recap',
        subtitle: '',
        bullets: ['V = IR', 'Resistance opposes current'],
        rightBullets: [],
        speakerNotes: notes,
      };
    if (i % 3 === 2)
      return {
        layout: 'two_column',
        title: 'Series vs parallel',
        subtitle: 'Series | Parallel',
        bullets: ['Same current'],
        rightBullets: ['Same voltage'],
        speakerNotes: notes,
      };
    if (i % 3 === 0)
      return {
        layout: 'quote',
        title: 'The law',
        subtitle: 'Georg Ohm, 1827',
        bullets: ['Current is proportional to voltage'],
        rightBullets: [],
        speakerNotes: notes,
      };
    return {
      layout: 'bullets',
      title: `Idea ${i}`,
      subtitle: '',
      bullets: ['Current is the flow of charge', 'Measured in amperes'],
      rightBullets: [],
      speakerNotes: notes,
    };
  });
  return { slides };
}

const ctx = (over: Partial<GenerationContext> = {}): GenerationContext => ({
  resourceId: '00000000-0000-0000-0000-000000000001',
  institutionId: '00000000-0000-0000-0000-000000000002',
  type: 'presentation',
  title: "Ohm's law",
  prompt: 'Introduce Ohm’s law with a torch example',
  language: 'en-IN',
  options: { type: 'presentation', slideCount: 6, includeSpeakerNotes: true, theme: 'dark' },
  course: { title: 'Class 10 Science', level: 'Grade 10', board: 'CBSE', subject: 'Physics' },
  units: [{ title: 'Electricity', summary: null, objectives: [] }],
  groundingText: '',
  model: 'gpt-4o-mini',
  ...over,
});

const saved = { openai: env.OPENAI_API_KEY, demo: env.PIPELINE_DEMO_FALLBACK };
const savedLlm = { ...llmRetryPolicy };
beforeEach(() => {
  env.OPENAI_API_KEY = 'test-key';
  env.PIPELINE_DEMO_FALLBACK = false;
  Object.assign(llmRetryPolicy, { attempts: 2, baseDelayMs: 1, maxDelayMs: 2 });
});
afterEach(() => {
  vi.unstubAllGlobals();
  env.OPENAI_API_KEY = saved.openai;
  env.PIPELINE_DEMO_FALLBACK = saved.demo;
  Object.assign(llmRetryPolicy, savedLlm);
});

describe('presentation generator', () => {
  it('returns exactly slideCount slides, title first and summary last, with notes and the chosen theme', async () => {
    stubChat(() => deck(6));
    const { content } = await generate(ctx());
    const c = content as PresentationContent;
    expect(bodies).toHaveLength(1);
    expect(bodies[0]!.response_format.type).toBe('json_schema');
    expect(bodies[0]!.response_format.json_schema.strict).toBe(true);
    expect(bodies[0]!.model).toBe('gpt-4o-mini');
    expect(c.theme).toBe('dark');
    expect(c.slides).toHaveLength(6);
    expect(c.slides[0]!.layout).toBe('title');
    expect(c.slides.at(-1)!.layout).toBe('summary');
    expect(new Set(c.slides.map((s) => s.layout))).toEqual(
      new Set(['title', 'bullets', 'two_column', 'quote', 'summary']),
    );
    expect(c.slides.every((s) => s.speakerNotes.length > 0)).toBe(true);
    expect(c.slides[0]!.bullets).toEqual([]);
    expect(c.slides[1]!.rightBullets).toEqual([]);
  });

  it('asks for a repair when the slide count is wrong, then accepts the corrected deck', async () => {
    stubChat((n) => (n === 1 ? deck(4) : deck(6)));
    const { content, meta } = await generate(ctx());
    expect(bodies).toHaveLength(2);
    expect(bodies[1]!.messages.at(-1)!.content).toMatch(/exactly 6 slides/);
    expect((content as PresentationContent).slides).toHaveLength(6);
    expect(meta).toMatchObject({ repaired: true });
  });

  it('fails with a clear message when the deck is still invalid after the repair', async () => {
    stubChat(() => deck(3));
    const err = await generate(ctx()).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(PipelineError);
    expect((err as PipelineError).retryable).toBe(false);
    expect((err as PipelineError).userMessage).toMatch(/invalid presentation/);
    expect(bodies).toHaveLength(2);
  });

  it('repairs structure the model still gets wrong after the repair round (one slide short, empty quote)', async () => {
    // Seen live with gpt-4o-mini: 9 of 10 slides and a quote slide with its text in the subtitle.
    const broken = () => {
      const d = deck(5);
      d.slides[2] = { ...d.slides[2]!, layout: 'quote', bullets: [], subtitle: 'V = IR' };
      d.slides[3] = { ...d.slides[3]!, layout: 'two_column', rightBullets: [] };
      return d;
    };
    stubChat(broken);
    const { content, meta } = await generate(ctx());
    const slides = (content as PresentationContent).slides;
    expect(bodies).toHaveLength(2);
    expect(slides).toHaveLength(5);
    expect(meta).toMatchObject({ repaired: true, slideCountShort: 1 });
    expect(slides[2]).toMatchObject({ layout: 'quote', bullets: ['V = IR'], subtitle: '' });
    expect(slides[3]!.layout).toBe('bullets');
    expect(checkDeck(slides, { slideCount: 5, includeSpeakerNotes: true }).hard).toEqual([]);
  });

  it('repairDeck adds a missing title and recap slide and drops extra slides', () => {
    const middle = deck(8).slides.slice(1, -1).map((s) => ({ ...s, layout: 'bullets' as const, rightBullets: [] }));
    const fixed = repairDeck(middle, { slideCount: 6, includeSpeakerNotes: false }, "Ohm's law", 'Class 10 Science');
    expect(fixed).toHaveLength(6);
    expect(fixed[0]).toMatchObject({ layout: 'title', title: "Ohm's law", subtitle: 'Class 10 Science' });
    expect(fixed.at(-1)).toMatchObject({ layout: 'summary', title: 'Recap' });
    expect(fixed.at(-1)!.bullets.length).toBeGreaterThan(0);
  });

  it('requires notes when requested and clears them when not', async () => {
    const noNotes = deck(5, { notes: false });
    expect(checkDeck(noNotes.slides, { slideCount: 5, includeSpeakerNotes: true }).hard.join(' ')).toMatch(
      /speaker notes are missing/,
    );
    stubChat(() => deck(5));
    const { content } = await generate(
      ctx({ options: { type: 'presentation', slideCount: 5, includeSpeakerNotes: false, theme: 'light' } }),
    );
    expect((content as PresentationContent).slides.every((s) => s.speakerNotes === '')).toBe(true);
    expect(bodies[0]!.messages[0]!.content).toMatch(/speakerNotes: always an empty string/);
  });

  it('flags long bullets as style issues and too many bullets as hard issues', () => {
    const d = deck(3);
    d.slides[1]!.bullets = Array.from(
      { length: MAX_BULLETS + 1 },
      () => 'one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen',
    );
    const r = checkDeck(d.slides, { slideCount: 3, includeSpeakerNotes: true });
    expect(r.hard.join(' ')).toMatch(/at most 6 bullets/);
    expect(r.soft.join(' ')).toMatch(/at most 14 words/);
  });

  it('puts grounding and the language rule in the prompt', async () => {
    stubChat(() => deck(4));
    await generate(
      ctx({
        language: 'ta-IN',
        groundingText: 'Resistance of a conductor depends on its length.',
        options: { type: 'presentation', slideCount: 4, includeSpeakerNotes: true, theme: 'classic' },
      }),
    );
    const [system, user] = bodies[0]!.messages;
    expect(system!.content).toMatch(/Use ONLY facts/);
    expect(system!.content).toMatch(/Latin script/);
    expect(user!.content).toMatch(/SOURCE MATERIAL/);
    expect(user!.content).toMatch(/Resistance of a conductor/);
  });

  it('fails non-retryably without an API key', async () => {
    env.OPENAI_API_KEY = '';
    const err = await generate(ctx()).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(PipelineError);
    expect((err as PipelineError).retryable).toBe(false);
  });
});

/** File names inside a zip (local headers and central directory store them uncompressed). */
const zipEntries = (buf: Buffer) =>
  new Set(buf.toString('latin1').match(/ppt\/(?:slides\/slide|notesSlides\/notesSlide)\d+\.xml/g) ?? []);

describe('PPTX export', () => {
  for (const theme of ['light', 'dark', 'classic'] as const) {
    it(`builds a valid ${theme} .pptx with one slide per deck slide and notes`, async () => {
      const content: PresentationContent = { theme, ...deck(7) };
      const file = await exportFile({
        title: "Ohm's law / basics",
        content,
        course: { title: 'Class 10 Science' },
      });
      expect(file.contentType).toBe(PPTX_CONTENT_TYPE);
      expect(file.filename).toBe('Ohms-law-basics.pptx');
      expect(file.buffer.subarray(0, 2).toString('latin1')).toBe('PK');
      const entries = [...zipEntries(file.buffer)];
      expect(entries.filter((e) => e.startsWith('ppt/slides/'))).toHaveLength(7);
      expect(entries.filter((e) => e.startsWith('ppt/notesSlides/')).length).toBeGreaterThanOrEqual(7);
    });
  }

  it('rejects content that is not a presentation', async () => {
    await expect(exportFile({ title: 'x', content: { overview: 'lesson plan' } })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
  });
});
