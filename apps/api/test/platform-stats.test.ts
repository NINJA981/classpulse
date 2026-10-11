/** AI usage recording, the email log, the monthly transcription limit and the platform statistics API. */
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AI_COST_NOTE, type PlatformOverviewStats, type PlatformStats } from '@classpulse/shared';
import { env } from '../src/config/env.js';
import { db } from '../src/db/client.js';
import { aiUsage, auditLogs, emailLog, institutions, lessons, platformSettings, users } from '../src/db/schema/index.js';
import { enqueueEmail } from '../src/jobs/emailQueue.js';
import { processLessonJob } from '../src/jobs/lessonGeneration.js';
import { setInProcessRunner } from '../src/jobs/queue.js';
import { AI_AUDIO_LIMIT_MESSAGE, aiErrorCode, flushAiUsage } from '../src/lib/aiUsage.js';
import { sha256Hex } from '../src/lib/crypto.js';
import { setMailerForTests } from '../src/lib/mailer.js';
import { resetPlatformStateCache } from '../src/lib/platformState.js';
import { queueLessonGeneration } from '../src/modules/lessons/audio.js';
import { estimateCost } from '../src/modules/platform/statsService.js';
import { httpRetryPolicy } from '../src/pipeline/http.js';
import { chat, generateWithOpenAI, llmRetryPolicy } from '../src/pipeline/llm.js';
import { transcribeWithOpenAI } from '../src/pipeline/openaiStt.js';
import { setPipelineProvidersForTests } from '../src/pipeline/providers.js';
import type { GenerateInput, TranscribeInput } from '../src/pipeline/types.js';
import { setLocalEmitter } from '../src/realtime/notify.js';
import { anon, as, createInstitution, createSection, createUser, createWorld } from './helpers.js';
import { insertLesson, makeWav, mockGenerate, mockTranscription, MOCK_SEGMENTS, rawModelOutput, writeTempFile } from './fixtures/lessons.js';
import { asPlatform, createPlatformAdmin } from './platform.helpers.js';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const chatResponse = (content: unknown, usage = { prompt_tokens: 1200, completion_tokens: 300 }) =>
  json({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(content), refusal: null } }], usage });

const saved = { openai: env.OPENAI_API_KEY };
const savedLlm = { ...llmRetryPolicy };
const savedHttp = { ...httpRetryPolicy };

beforeEach(() => {
  resetPlatformStateCache();
  Object.assign(llmRetryPolicy, { attempts: 2, baseDelayMs: 1, maxDelayMs: 2 });
  Object.assign(httpRetryPolicy, { attempts: 2, baseDelayMs: 1, maxDelayMs: 2 });
});

afterEach(async () => {
  await flushAiUsage();
  vi.unstubAllGlobals();
  env.OPENAI_API_KEY = saved.openai;
  Object.assign(llmRetryPolicy, savedLlm);
  Object.assign(httpRetryPolicy, savedHttp);
  setPipelineProvidersForTests(null);
  setMailerForTests(null);
});

const usageRows = async () => {
  await flushAiUsage();
  return db.select().from(aiUsage).orderBy(aiUsage.id);
};

/* ----------------------------------------------------------------------------
 * Recording
 * ------------------------------------------------------------------------- */

describe('AI usage recording', () => {
  it('records tokens for each chat call and returns them in ChatResult', async () => {
    const inst = await createInstitution();
    env.OPENAI_API_KEY = 'sk-test';
    vi.stubGlobal('fetch', async () => chatResponse({ ok: true }, { prompt_tokens: 50, completion_tokens: 7 }));
    const res = await chat('gpt-4.1-mini', [{ role: 'user', content: 'hi' }], 'x', { type: 'object' }, 100, {
      institutionId: inst.id,
      kind: 'resource',
    });
    expect(res.usage).toEqual({ inputTokens: 50, outputTokens: 7 });
    // Without a context nothing is recorded (backward compatible).
    await chat('gpt-4.1-mini', [{ role: 'user', content: 'hi' }], 'x', { type: 'object' }, 100);
    const rows = await usageRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ institutionId: inst.id, kind: 'resource', provider: 'openai', model: 'gpt-4.1-mini', inputTokens: 50, outputTokens: 7, ok: true });
  });

  it('records quiz generation through the real LLM path with the lesson and kind', async () => {
    const w = await createWorld();
    const lesson = await insertLesson({ institutionId: w.institution.id, teacherId: w.teacher.id, sectionId: w.section.id });
    env.OPENAI_API_KEY = 'sk-test';
    vi.stubGlobal('fetch', async () => chatResponse(rawModelOutput(2)));
    const input: GenerateInput = {
      title: 'Photosynthesis',
      subject: 'Biology',
      language: 'en-IN',
      segments: MOCK_SEGMENTS,
      questionsPerLesson: 2,
      difficulty: 'mixed',
      existingStems: [],
      bilingual: false,
      model: 'gpt-4o-mini',
      usage: { institutionId: w.institution.id, lessonId: lesson.id, kind: 'quiz' },
    };
    await generateWithOpenAI(input);
    const rows = await usageRows();
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows.every((r) => r.kind === 'quiz' && r.lessonId === lesson.id && r.ok && r.inputTokens === 1200)).toBe(true);
  });

  it('records failures with an error code and still throws', async () => {
    const inst = await createInstitution();
    env.OPENAI_API_KEY = 'sk-test';
    vi.stubGlobal('fetch', async () => json({ error: 'nope' }, 401));
    await expect(
      chat('gpt-4.1-mini', [{ role: 'user', content: 'hi' }], 'x', { type: 'object' }, 100, { institutionId: inst.id, kind: 'grading' }),
    ).rejects.toThrow();
    const [row] = await usageRows();
    expect(row).toMatchObject({ ok: false, errorCode: 'http_401', kind: 'grading', inputTokens: null });
  });

  it('records speech-to-text audio seconds (and none on failure)', async () => {
    const inst = await createInstitution();
    env.OPENAI_API_KEY = 'sk-test';
    const audioPath = await writeTempFile(`usage-${Date.now()}.wav`, makeWav(3));
    const input: TranscribeInput = {
      provider: 'openai',
      audioPath,
      language: 'en-IN',
      durationSec: 3,
      model: 'whisper-1',
      usage: { institutionId: inst.id, kind: 'stt' },
    };
    vi.stubGlobal('fetch', async () => json({ text: 'Plants make food.', segments: [{ start: 0, end: 3, text: 'Plants make food.' }] }));
    await transcribeWithOpenAI(input);
    vi.stubGlobal('fetch', async () => json({}, 500));
    await expect(transcribeWithOpenAI(input)).rejects.toThrow();
    const rows = await usageRows();
    expect(rows.map((r) => [r.ok, r.audioSeconds, r.errorCode])).toEqual([
      [true, 3, null],
      [false, null, 'http_500'],
    ]);
  });

  it('threads the lesson context through the generation job', async () => {
    const w = await createWorld();
    const seen: unknown[] = [];
    setLocalEmitter(() => undefined);
    setPipelineProvidersForTests({
      transcribe: async (i) => (seen.push(i.usage), mockTranscription()),
      generate: async (i) => (seen.push(i.usage), mockGenerate(i)),
    });
    const lesson = await insertLesson({
      institutionId: w.institution.id,
      teacherId: w.teacher.id,
      sectionId: w.section.id,
      status: 'queued',
      withAudio: true,
      generationAttempt: 1,
      quizRequest: { questionCount: 3, difficulty: 'mixed', mode: 'replace_all' },
    });
    await processLessonJob({ lessonId: lesson.id, attempt: 1 }, { attemptNumber: 1, maxAttempts: 3 });
    expect(seen).toEqual([
      { institutionId: w.institution.id, lessonId: lesson.id, kind: 'stt' },
      { institutionId: w.institution.id, lessonId: lesson.id, kind: 'quiz' },
    ]);
  });

  it('maps errors to short codes', () => {
    expect(aiErrorCode(new Error('openai:chat failed with HTTP 429'))).toBe('http_429');
    expect(aiErrorCode(Object.assign(new Error('x'), { name: 'TimeoutError' }))).toBe('timeout');
    expect(aiErrorCode(new Error('OPENAI_API_KEY is not set'))).toBe('not_configured');
  });
});

/* ----------------------------------------------------------------------------
 * Email log
 * ------------------------------------------------------------------------- */

describe('email log', () => {
  it('records sent and failed deliveries with a hashed recipient and no address', async () => {
    const inst = await createInstitution();
    setMailerForTests(async () => undefined);
    await enqueueEmail({ kind: 'invite', institutionId: inst.id, message: { to: ' Neha@School.in ', subject: 's', html: 'h', text: 't' } });
    setMailerForTests(async () => {
      throw new Error('550 5.1.1 <neha@school.in>: Recipient address rejected');
    });
    await enqueueEmail({ kind: 'reset', message: { to: 'neha@school.in', subject: 's', html: 'h', text: 't' } });
    const rows = await db.select().from(emailLog).orderBy(emailLog.id);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ kind: 'invite', institutionId: inst.id, status: 'sent', toHash: sha256Hex('neha@school.in'), error: null });
    expect(rows[1]).toMatchObject({ kind: 'reset', institutionId: null, status: 'failed', toHash: sha256Hex('neha@school.in') });
    expect(rows[1]!.error).toContain('[address]');
    expect(JSON.stringify(rows)).not.toContain('school.in');
  });
});

/* ----------------------------------------------------------------------------
 * Monthly AI audio limit
 * ------------------------------------------------------------------------- */

describe('monthly AI transcription limit', () => {
  it('refuses to queue transcription past the limit, but allows quiz-only jobs and unlimited schools', async () => {
    const w = await createWorld();
    setInProcessRunner(() => undefined);
    await db
      .update(institutions)
      .set({ limits: { maxStudents: null, maxTeachers: null, aiAudioMinutesPerMonth: 1, storageGb: null } })
      .where(eq(institutions.id, w.institution.id));
    // 58 s used this month (+ a failed call and last month's usage, which don't count).
    await db.insert(aiUsage).values([
      { institutionId: w.institution.id, kind: 'stt', provider: 'sarvam', model: 'saaras:v3', audioSeconds: 58, ok: true },
      { institutionId: w.institution.id, kind: 'stt', provider: 'sarvam', model: 'saaras:v3', audioSeconds: 500, ok: false },
      { institutionId: w.institution.id, kind: 'stt', provider: 'sarvam', model: 'saaras:v3', audioSeconds: 900, ok: true, at: new Date(Date.now() - 40 * 86400_000) },
    ]);
    const lesson = await insertLesson({ institutionId: w.institution.id, teacherId: w.teacher.id, sectionId: w.section.id, withAudio: true });

    await expect(queueLessonGeneration(lesson.id, null)).rejects.toMatchObject({ code: 'INVALID_STATE', message: AI_AUDIO_LIMIT_MESSAGE });
    const unchanged = await db.query.lessons.findFirst({ where: eq(lessons.id, lesson.id) });
    expect(unchanged!.status).toBe('draft');

    // A transcript of this audio already exists: generating the quiz needs no transcription.
    await db
      .update(lessons)
      .set({ transcript: 'x', transcriptSegments: MOCK_SEGMENTS, pipelineMeta: { transcriptAudioKey: lesson.audioObjectKey } })
      .where(eq(lessons.id, lesson.id));
    await expect(queueLessonGeneration(lesson.id, { questionCount: 3, difficulty: 'easy', mode: 'replace_all' })).resolves.toContain(lesson.id);

    // Within the allowance (58 + 3 > 60 fails; raising the limit lets it through).
    await db
      .update(institutions)
      .set({ limits: { maxStudents: null, maxTeachers: null, aiAudioMinutesPerMonth: 2, storageGb: null } })
      .where(eq(institutions.id, w.institution.id));
    resetPlatformStateCache();
    const other = await insertLesson({ institutionId: w.institution.id, teacherId: w.teacher.id, sectionId: w.section.id, withAudio: true });
    await expect(queueLessonGeneration(other.id, null)).resolves.toContain(other.id);
  });
});

/* ----------------------------------------------------------------------------
 * Statistics API
 * ------------------------------------------------------------------------- */

/** YYYY-MM-DD `n` days before today in Asia/Kolkata. */
const istDay = (n: number) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(
    new Date(Date.now() - n * 86400_000),
  );
/** 11:30 IST on that day. */
const at = (day: string) => new Date(`${day}T06:00:00Z`);

describe('statistics API', () => {
  it('requires a platform session', async () => {
    const w = await createWorld();
    expect((await anon().get('/api/platform/stats')).status).toBe(401);
    expect((await as(w.admin).get('/api/platform/stats')).status).toBe(401);
    expect((await anon().get('/api/platform/stats/overview')).status).toBe(401);
    expect((await anon().get('/api/platform/stats/export.csv')).status).toBe(401);
  });

  it('aggregates activity per day, per school and per model, with costs from the price rates', async () => {
    const owner = await createPlatformAdmin();
    const w = await createWorld();
    const other = await createInstitution({ name: 'Other School' });
    const otherTeacher = await createUser(other.id, 'teacher');
    const [d0, d1, d2] = [istDay(2), istDay(1), istDay(0)];

    await db.insert(platformSettings).values({
      key: 'aiPrices',
      value: { llm: { 'test-llm': { inputPer1M: 1, outputPer1M: 2 } }, stt: { 'test-stt': { perHour: 0.5 } } },
    });
    const mk = async (inst: string, teacher: string, section: string, day: string) => {
      const l = await insertLesson({ institutionId: inst, teacherId: teacher, sectionId: section });
      await db.update(lessons).set({ createdAt: at(day), durationSec: 120 }).where(eq(lessons.id, l.id));
    };
    await mk(w.institution.id, w.teacher.id, w.section.id, d0);
    await mk(w.institution.id, w.teacher.id, w.section.id, d1);
    await mk(w.institution.id, w.teacher.id, w.section.id, d1);
    const os = await createSection(other.id, { teacherIds: [otherTeacher.id] });
    await mk(other.id, otherTeacher.id, os.id, d1);

    // Sign-ins: the student twice on d1 (counted once) and the teacher's last login on d1.
    await db.insert(auditLogs).values([
      { actorType: 'user', actorId: w.student.id, institutionId: w.institution.id, action: 'auth.login', at: at(d1) },
      { actorType: 'user', actorId: w.student.id, institutionId: w.institution.id, action: 'auth.login', at: at(d1) },
    ]);
    await db.update(users).set({ lastLoginAt: at(d1) }).where(eq(users.id, w.teacher.id));

    await db.insert(aiUsage).values([
      { at: at(d1), institutionId: w.institution.id, kind: 'quiz', provider: 'openai', model: 'test-llm', inputTokens: 1_000_000, outputTokens: 500_000, ok: true },
      { at: at(d1), institutionId: w.institution.id, kind: 'quiz', provider: 'openai', model: 'test-llm', ok: false, errorCode: 'http_500' },
      { at: at(d2), institutionId: w.institution.id, kind: 'stt', provider: 'sarvam', model: 'test-stt', audioSeconds: 1800, ok: true },
      { at: at(d2), institutionId: other.id, kind: 'remedial', provider: 'openai', model: 'mystery-model', inputTokens: 10, outputTokens: 10, ok: true },
    ]);
    await db.insert(emailLog).values([
      { at: at(d0), kind: 'invite', institutionId: w.institution.id, toHash: 'a'.repeat(64), status: 'sent' },
      { at: at(d0), kind: 'invite', institutionId: null, toHash: 'b'.repeat(64), status: 'failed' },
    ]);

    const res = await asPlatform(owner).get(`/api/platform/stats?from=${d0}&to=${d2}`);
    expect(res.status).toBe(200);
    const s = res.body as PlatformStats;
    expect(s.range).toMatchObject({ from: d0, to: d2, granularity: 'day', timeZone: 'Asia/Kolkata' });
    expect(s.totals).toMatchObject({ schools: 2, activeSchools: 2, teachers: 3, students: 2, admins: 1 });
    expect(s.series.map((b) => b.bucket)).toEqual([d0, d1, d2]);
    expect(s.series.map((b) => b.lessonsCreated)).toEqual([1, 3, 0]);
    expect(s.series.map((b) => b.audioMinutes)).toEqual([2, 6, 0]);
    expect(s.series.map((b) => b.activeUsers)).toEqual([0, 2, 0]);
    expect(s.series.map((b) => [b.emailsSent, b.emailsFailed])).toEqual([[1, 1], [0, 0], [0, 0]]);
    expect(s.series[1]).toMatchObject({ aiCalls: 2, aiFailures: 1, aiInputTokens: 1_000_000, aiOutputTokens: 500_000, aiCostUsd: 2 });
    expect(s.series[2]).toMatchObject({ aiCalls: 2, aiAudioMinutes: 30, aiCostUsd: 0.25 });
    expect(s.summary).toMatchObject({ lessonsCreated: 4, activeUsers: 2, aiCalls: 4, aiCostUsd: 2.25 });

    const mine = s.schools.find((x) => x.institutionId === w.institution.id)!;
    expect(mine).toMatchObject({ lessonsCreated: 3, activeUsers: 2, aiCostUsd: 2.25, teachers: 2, students: 2 });
    expect(mine.storageBytes).toBeGreaterThanOrEqual(0);
    expect(s.rankings.byAiCost[0]).toMatchObject({ institutionId: w.institution.id, value: 2.25 });
    expect(s.rankings.byActivity[0]!.institutionId).toBe(w.institution.id);
    const mystery = s.ai.find((a) => a.model === 'mystery-model')!;
    expect(mystery).toMatchObject({ priced: false, costUsd: 0, kind: 'remedial' });
    expect(s.costNote).toBe(AI_COST_NOTE);

    // School filter
    const filtered = (await asPlatform(owner).get(`/api/platform/stats?from=${d0}&to=${d2}&institutionId=${other.id}`)).body as PlatformStats;
    expect(filtered.totals.schools).toBe(1);
    expect(filtered.summary.lessonsCreated).toBe(1);
    expect(filtered.schools.map((x) => x.institutionId)).toEqual([other.id]);
    expect(filtered.summary.aiCalls).toBe(1);

    // Weekly buckets add up to the same totals
    const weekly = (await asPlatform(owner).get(`/api/platform/stats?from=${d0}&to=${d2}&granularity=week`)).body as PlatformStats;
    expect(weekly.series.reduce((n, b) => n + b.lessonsCreated, 0)).toBe(4);
  });

  it('validates the range', async () => {
    const owner = await createPlatformAdmin();
    expect((await asPlatform(owner).get('/api/platform/stats?from=2026-05-02&to=2026-05-01')).status).toBe(400);
    expect((await asPlatform(owner).get('/api/platform/stats?from=2024-01-01&to=2026-01-01')).status).toBe(400);
    expect((await asPlatform(owner).get('/api/platform/stats?from=yesterday')).status).toBe(400);
    expect((await asPlatform(owner).get('/api/platform/stats?granularity=month')).status).toBe(400);
    const def = await asPlatform(owner).get('/api/platform/stats');
    expect(def.status).toBe(200);
    expect((def.body as PlatformStats).series).toHaveLength(30);
  });

  it('returns overview KPIs', async () => {
    const owner = await createPlatformAdmin();
    const w = await createWorld();
    await db.update(institutions).set({ status: 'suspended' }).where(eq(institutions.id, (await createInstitution()).id));
    await insertLesson({ institutionId: w.institution.id, teacherId: w.teacher.id, sectionId: w.section.id });
    await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, w.student.id));
    await db.insert(aiUsage).values([
      { institutionId: w.institution.id, kind: 'quiz', provider: 'openai', model: 'gpt-4.1-mini', inputTokens: 1_000_000, outputTokens: 0, ok: true },
      { institutionId: w.institution.id, kind: 'quiz', provider: 'openai', model: 'gpt-4.1-mini', ok: false, errorCode: 'timeout' },
    ]);
    await db.insert(emailLog).values({ kind: 'invite', toHash: 'c'.repeat(64), status: 'failed' });
    const res = await asPlatform(owner).get('/api/platform/stats/overview');
    expect(res.status).toBe(200);
    const o = res.body as PlatformOverviewStats;
    expect(o).toMatchObject({ schools: 2, activeSchools: 1, suspendedSchools: 1, activeUsersToday: 1, lessonsThisWeek: 1, aiFailures24h: 1, emailsFailed24h: 1 });
    expect(o.aiCostThisMonthUsd).toBe(0.4); // default rate for gpt-4.1-mini: $0.40 per 1M input tokens
    expect(o.aiCostBySchool).toEqual([{ institutionId: w.institution.id, name: w.institution.name, value: 0.4 }]);
  });

  it('exports CSV with spreadsheet formulas neutralised', async () => {
    const owner = await createPlatformAdmin();
    await createInstitution({ name: '=HYPERLINK("http://evil","x")' });
    const res = await asPlatform(owner).get('/api/platform/stats/export.csv?section=schools');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toMatch(/attachment; filename="classpulse-schools-/);
    expect(res.text).toContain(`"'=HYPERLINK(""http://evil"",""x"")"`);
    expect(res.text).not.toMatch(/(^|,)=HYPERLINK/m);
    const activity = await asPlatform(owner).get('/api/platform/stats/export.csv');
    expect(activity.text.split('\r\n')[0]).toMatch(/^Date,Active users,/);
    const ai = await asPlatform(owner).get('/api/platform/stats/export.csv?section=ai');
    expect(ai.text.split('\r\n')[0]).toMatch(/^Provider,Model,Kind/);
  });

  it('estimates cost by exact model, longest prefix, or not at all', () => {
    const prices = { llm: { 'gpt-4.1': { inputPer1M: 2, outputPer1M: 8 }, 'gpt-4.1-mini': { inputPer1M: 0.4, outputPer1M: 1.6 } }, stt: { 'saaras:v3': { perHour: 1 } } };
    const base = { provider: 'openai', kind: 'quiz' as const, calls: 1, failures: 0, audioSeconds: 0 };
    expect(estimateCost({ ...base, model: 'gpt-4.1-mini-2025-04-14', inputTokens: 1e6, outputTokens: 1e6 }, prices).costUsd).toBeCloseTo(2);
    expect(estimateCost({ ...base, model: 'claude-x', inputTokens: 5, outputTokens: 5 }, prices)).toEqual({ costUsd: 0, priced: false });
    expect(estimateCost({ ...base, kind: 'stt', provider: 'sarvam', model: 'saaras:v3', inputTokens: 0, outputTokens: 0, audioSeconds: 7200 }, prices).costUsd).toBe(2);
  });
});
