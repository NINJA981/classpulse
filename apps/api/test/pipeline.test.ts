/** Provider-level tests with a stubbed global fetch — nothing touches the network. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { env } from '../src/config/env.js';
import { PipelineError } from '../src/pipeline/errors.js';
import { httpRetryPolicy } from '../src/pipeline/http.js';
import { generateRemedialPlan, generateWithOpenAI, llmRetryPolicy, parseGenerationOutput, promptBlocks, wantsLocal } from '../src/pipeline/llm.js';
import { providers, setPipelineProvidersForTests } from '../src/pipeline/providers.js';
import { parseSarvamOutput, sarvamTiming, transcribeWithSarvam } from '../src/pipeline/sarvam.js';
import { distributeSentences } from '../src/pipeline/segments.js';
import type { GenerateInput } from '../src/pipeline/types.js';
import { MOCK_SEGMENTS, makeWav, rawModelOutput, writeTempFile } from './fixtures/lessons.js';

type Handler = (url: string, init: RequestInit | undefined) => Response | Promise<Response>;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const chatResponse = (content: unknown) => json({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(content), refusal: null } }] });

let calls: { url: string; init: RequestInit | undefined }[] = [];
function stubFetch(handler: Handler) {
  calls = [];
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return handler(String(url), init);
  });
}

const saved = { openai: env.OPENAI_API_KEY, sarvam: env.SARVAM_API_KEY, demo: env.PIPELINE_DEMO_FALLBACK };
const savedLlm = { ...llmRetryPolicy };
const savedHttp = { ...httpRetryPolicy };
const savedTiming = { ...sarvamTiming };

beforeEach(() => {
  Object.assign(llmRetryPolicy, { attempts: 3, baseDelayMs: 1, maxDelayMs: 2 });
  Object.assign(httpRetryPolicy, { attempts: 3, baseDelayMs: 1, maxDelayMs: 2 });
  Object.assign(sarvamTiming, { pollIntervalMs: 1, pollTimeoutMs: 2_000 });
});

afterEach(() => {
  vi.unstubAllGlobals();
  env.OPENAI_API_KEY = saved.openai;
  env.SARVAM_API_KEY = saved.sarvam;
  env.PIPELINE_DEMO_FALLBACK = saved.demo;
  Object.assign(llmRetryPolicy, savedLlm);
  Object.assign(httpRetryPolicy, savedHttp);
  Object.assign(sarvamTiming, savedTiming);
  setPipelineProvidersForTests(null);
});

const genInput = (over: Partial<GenerateInput> = {}): GenerateInput => ({
  title: 'Photosynthesis',
  subject: 'Biology',
  language: 'en-IN',
  segments: MOCK_SEGMENTS,
  questionsPerLesson: 2,
  bilingual: true,
  model: 'gpt-4o-mini',
  ...over,
});

describe('LLM output validation', () => {
  const blocks = promptBlocks(MOCK_SEGMENTS);

  it('rejects a question with two correct answers', () => {
    const r = parseGenerationOutput(rawModelOutput(2, { twoCorrect: true }), { questionCount: 2, blocks, local: false });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues.join(' ')).toMatch(/exactly one option must be correct/);
  });

  it('rejects the wrong question count and citations of non-existent blocks', () => {
    expect(parseGenerationOutput(rawModelOutput(3), { questionCount: 2, blocks, local: false }).ok).toBe(false);
    expect(parseGenerationOutput(rawModelOutput(2, { cited: [9] }), { questionCount: 2, blocks, local: false }).ok).toBe(false);
  });

  it('requires local-language fields only when bilingual and not English', () => {
    expect(wantsLocal('en-IN', true)).toBe(false);
    expect(wantsLocal('hi-IN', false)).toBe(false);
    expect(wantsLocal('hi-IN', true)).toBe(true);
    expect(parseGenerationOutput(rawModelOutput(2), { questionCount: 2, blocks, local: true }).ok).toBe(false);
  });

  it('maps citations to real segment times and keeps the correct answer after shuffling', () => {
    const r = parseGenerationOutput(rawModelOutput(2, { cited: [0, 1] }), { questionCount: 2, blocks, local: false });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    for (const q of r.value.questions) {
      expect(q.options[q.correctIndex]).toBe('Oxygen is released');
      expect(q.citationStartSec).toBe(0);
      expect(q.citationEndSec).toBe(29.8);
      expect(q.stemLocal).toBeNull();
    }
  });
});

describe('OpenAI generation (stubbed fetch)', () => {
  it('fails non-retryably without an API key', async () => {
    env.OPENAI_API_KEY = '';
    const err = await generateWithOpenAI(genInput()).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(PipelineError);
    expect((err as PipelineError).retryable).toBe(false);
    expect((err as PipelineError).userMessage).toBe('Question generation is not configured');
  });

  it('uses strict json_schema and succeeds after one repair round', async () => {
    env.OPENAI_API_KEY = 'test-key';
    let n = 0;
    stubFetch(() => chatResponse(rawModelOutput(2, { twoCorrect: ++n === 1 })));
    const result = await generateWithOpenAI(genInput());
    expect(calls).toHaveLength(2);
    expect(calls[0]!.url).toBe(`${env.OPENAI_BASE_URL}/chat/completions`);
    const body = JSON.parse(String(calls[0]!.init!.body)) as { response_format: { type: string; json_schema: { strict: boolean } }; model: string };
    expect(body.response_format.type).toBe('json_schema');
    expect(body.response_format.json_schema.strict).toBe(true);
    expect(body.model).toBe('gpt-4o-mini');
    expect((calls[0]!.init!.headers as Record<string, string>).Authorization).toBe('Bearer test-key');
    expect(result.questions).toHaveLength(2);
    expect(result.meta.repaired).toBe(true);
  });

  it('fails non-retryably when output stays invalid after the repair round', async () => {
    env.OPENAI_API_KEY = 'test-key';
    stubFetch(() => chatResponse(rawModelOutput(2, { twoCorrect: true })));
    const err = (await generateWithOpenAI(genInput()).catch((e: unknown) => e)) as PipelineError;
    expect(err).toBeInstanceOf(PipelineError);
    expect(err.retryable).toBe(false);
    expect(calls).toHaveLength(2);
  });

  it('retries 429/5xx per request, then raises a retryable error without the upstream body', async () => {
    env.OPENAI_API_KEY = 'test-key';
    stubFetch(() => json({ error: 'secret upstream detail' }, 503));
    const err = (await generateWithOpenAI(genInput()).catch((e: unknown) => e)) as PipelineError;
    expect(err.retryable).toBe(true);
    expect(calls).toHaveLength(3);
    expect(err.message).not.toContain('secret');
    expect(err.userMessage).not.toContain('secret');

    stubFetch(() => json({}, 401));
    const auth = (await generateWithOpenAI(genInput()).catch((e: unknown) => e)) as PipelineError;
    expect(auth.retryable).toBe(false);
    expect(calls).toHaveLength(1);
  });

  it('builds a remedial plan', async () => {
    env.OPENAI_API_KEY = 'test-key';
    stubFetch(() => chatResponse({ summary: 'Reteach', actions: [{ topic: 'Light', recommendation: 'Use a prism demo' }] }));
    const plan = await generateRemedialPlan({
      title: 'P',
      subject: 'S',
      language: 'en-IN',
      model: 'gpt-4o-mini',
      analytics: { lessonId: crypto.randomUUID(), enrolledStudents: 2, studentsAttempted: 1, averageScorePct: 50, questions: [], students: [], remedial: null },
    });
    expect(plan.actions[0]!.topic).toBe('Light');
    expect(plan.generatedAt).toBeTruthy();
  });
});

describe('Sarvam batch STT (stubbed fetch)', () => {
  const sarvamFlow = (output: unknown, opts: { neverComplete?: boolean } = {}): Handler => (url, init) => {
    if (url.endsWith('/speech-to-text/job/v1')) return json({ job_id: 'job-1' });
    if (url.endsWith('/upload-files')) return json({ upload_urls: { 'lecture.wav': { file_url: 'https://blob.test/up' } } });
    if (url === 'https://blob.test/up') {
      expect(init?.method).toBe('PUT');
      return new Response(null, { status: 201 });
    }
    if (url.endsWith('/start')) return json({ job_state: 'Running' });
    if (url.endsWith('/status')) {
      return json(
        opts.neverComplete
          ? { job_state: 'Running' }
          : { job_state: 'Completed', job_details: [{ inputs: [{ file_name: 'lecture.wav' }], outputs: [{ file_name: 'lecture.wav.json' }], state: 'Success' }] },
      );
    }
    if (url.endsWith('/download-files')) return json({ download_urls: { 'lecture.wav.json': { file_url: 'https://blob.test/out' } } });
    if (url === 'https://blob.test/out') return json(output);
    return json({}, 404);
  };

  const input = async (durationSec = 30) => ({
    audioPath: await writeTempFile('lecture.wav', makeWav(1)),
    language: 'hi-IN' as const,
    durationSec,
    model: 'saaras:v3',
  });

  it('fails non-retryably without an API key', async () => {
    env.SARVAM_API_KEY = '';
    const err = (await transcribeWithSarvam(await input()).catch((e: unknown) => e)) as PipelineError;
    expect(err.retryable).toBe(false);
    expect(err.userMessage).toBe('Speech-to-text is not configured');
  });

  it('requests timestamps and returns real segment times', async () => {
    env.SARVAM_API_KEY = 'sarvam-key';
    stubFetch(
      sarvamFlow({
        transcript: 'नमस्ते. आज हम प्रकाश संश्लेषण पढ़ेंगे.',
        timestamps: { words: ['नमस्ते.', 'आज हम प्रकाश संश्लेषण पढ़ेंगे.'], start_time_seconds: [0.4, 2.5], end_time_seconds: [2.1, 7.9] },
      }),
    );
    const res = await transcribeWithSarvam(await input());
    const init = JSON.parse(String(calls[0]!.init!.body)) as { job_parameters: Record<string, unknown> };
    expect(init.job_parameters).toMatchObject({ with_timestamps: true, language_code: 'hi-IN', model: 'saaras:v3' });
    expect((calls[0]!.init!.headers as Record<string, string>)['api-subscription-key']).toBe('sarvam-key');
    expect(res.segments).toEqual([
      { startSec: 0.4, endSec: 2.1, text: 'नमस्ते.' },
      { startSec: 2.5, endSec: 7.9, text: 'आज हम प्रकाश संश्लेषण पढ़ेंगे.' },
    ]);
    expect(res.meta.approximateTimestamps).toBe(false);
  });

  it('distributes sentences over the real duration when timestamps are missing', async () => {
    env.SARVAM_API_KEY = 'sarvam-key';
    stubFetch(sarvamFlow({ transcript: 'Short one. A much longer second sentence here.' }));
    const res = await transcribeWithSarvam(await input(30));
    expect(res.meta.approximateTimestamps).toBe(true);
    expect(res.segments).toHaveLength(2);
    expect(res.segments[0]!.startSec).toBe(0);
    expect(res.segments[1]!.endSec).toBeCloseTo(30, 1);
    expect(res.segments[1]!.endSec - res.segments[1]!.startSec).toBeGreaterThan(res.segments[0]!.endSec - res.segments[0]!.startSec);
  });

  it('rejects an empty transcript and times out polling with a retryable error', async () => {
    env.SARVAM_API_KEY = 'sarvam-key';
    stubFetch(sarvamFlow({ transcript: '' }));
    const empty = (await transcribeWithSarvam(await input()).catch((e: unknown) => e)) as PipelineError;
    expect(empty.retryable).toBe(false);

    sarvamTiming.pollTimeoutMs = 30;
    stubFetch(sarvamFlow({}, { neverComplete: true }));
    const timeout = (await transcribeWithSarvam(await input()).catch((e: unknown) => e)) as PipelineError;
    expect(timeout).toBeInstanceOf(PipelineError);
    expect(timeout.retryable).toBe(true);
    expect(timeout.userMessage).toMatch(/too long/);
  });

  it('parses diarized output as a fallback', () => {
    const r = parseSarvamOutput({ transcript: 'a b', diarized_transcript: { entries: [{ transcript: 'a', start_time_seconds: 1, end_time_seconds: 2 }] } });
    expect(r.segments).toEqual([{ startSec: 1, endSec: 2, text: 'a' }]);
    expect(distributeSentences('', 10)).toEqual([]);
  });
});

describe('demo fallback', () => {
  it('is used only when enabled and the key is missing, and is clearly labelled', async () => {
    env.SARVAM_API_KEY = '';
    env.PIPELINE_DEMO_FALLBACK = false;
    await expect(providers.transcribe({ audioPath: 'x', language: 'en-IN', durationSec: 90, model: 'm' })).rejects.toBeInstanceOf(PipelineError);

    env.PIPELINE_DEMO_FALLBACK = true;
    const stt = await providers.transcribe({ audioPath: 'x', language: 'en-IN', durationSec: 90, model: 'm' });
    expect(stt.meta.demoFallback).toBe(true);
    expect(stt.segments.at(-1)!.endSec).toBe(90);
    env.OPENAI_API_KEY = '';
    const gen = await providers.generate(genInput({ segments: stt.segments }));
    expect(gen.summary.startsWith('[Demo]')).toBe(true);
    expect(gen.meta.demoFallback).toBe(true);
  });
});
