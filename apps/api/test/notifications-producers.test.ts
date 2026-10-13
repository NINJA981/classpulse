/**
 * Notification producers: the lesson pipeline, the stuck-lesson timeout, the resources queue and the deploy
 * watcher call notify() once per end state, with the right recipient, kind, tone, link and entity. notify()
 * itself (storage, sockets, push) is replaced with a spy here; it has its own tests. Coolify is a stubbed fetch.
 */
import express, { type Express } from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import type { QuizRequest, ResourceDetail } from '@classpulse/shared';
import { env } from '../src/config/env.js';
import { db } from '../src/db/client.js';
import { lessons, platformAdmins } from '../src/db/schema/index.js';
import { isRetryable, markLessonJobFailed, processLessonJob, recoverStuckLessons } from '../src/jobs/lessonGeneration.js';
import { setInProcessRunner, type LessonJobData } from '../src/jobs/queue.js';
import { failStuckLessons, STUCK_LESSON_HOURS } from '../src/jobs/retention.js';
import { setNotifierForTests } from '../src/jobs/sendNotification.js';
import { signPlatformToken } from '../src/lib/platformSession.js';
import { errorHandler, notFoundHandler } from '../src/middleware/errorHandler.js';
import { authenticatePlatform } from '../src/middleware/platformAuth.js';
import type { NotifyInput } from '../src/modules/notifications/notify.js';
import { checkDeployWatches, resetDeployWatchesForTests, WATCH_TTL_MS } from '../src/modules/platform/deployWatcher.js';
import { opsRouter } from '../src/modules/platform/opsRoutes.js';
import { setGeneratorsForTests } from '../src/modules/resources/generators/index.js';
import { resourceJobTiming, startResourceWorker, type ResourceWorkerHandle } from '../src/modules/resources/queue.js';
import { PipelineError } from '../src/pipeline/errors.js';
import { setPipelineProvidersForTests } from '../src/pipeline/providers.js';
import { setLocalEmitter } from '../src/realtime/notify.js';
import { as, createWorld } from './helpers.js';
import { insertLesson, mockGenerate, mockGenerateQuestions, mockTranscription } from './fixtures/lessons.js';

// notify() is replaced through the producers' seam: vi.mock can't reach it because test/setup.ts loads the app first.
const notifyMock = vi.fn(async (_input: NotifyInput) => undefined);
const calls = () => notifyMock.mock.calls.map((c) => c[0]);

beforeEach(() => {
  notifyMock.mockClear();
  setNotifierForTests(notifyMock);
  setLocalEmitter(() => undefined);
});
afterAll(() => setNotifierForTests(null));

/* ------------------------------------------- lessons ------------------------------------------- */

describe('lesson pipeline notifications', () => {
  let queued: LessonJobData[] = [];
  beforeEach(() => {
    queued = [];
    setInProcessRunner((d) => queued.push(d));
    setPipelineProvidersForTests({ transcribe: async () => mockTranscription(), generate: mockGenerate, generateQuestions: mockGenerateQuestions });
  });
  afterEach(() => setPipelineProvidersForTests(null));

  const ctx = (attemptNumber: number) => ({ attemptNumber, maxAttempts: 3 });

  async function runLikeWorker(data: LessonJobData) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await processLessonJob(data, ctx(attempt));
        return;
      } catch (err) {
        if (attempt === 3 || !isRetryable(err)) return markLessonJobFailed(data, err as Error);
      }
    }
  }

  async function lessonWith(quizRequest: QuizRequest | null, attempt = 2) {
    const w = await createWorld();
    const lesson = await insertLesson({
      institutionId: w.institution.id,
      teacherId: w.teacher.id,
      sectionId: w.section.id,
      withAudio: true,
      status: 'queued',
      generationAttempt: attempt,
      quizRequest,
    });
    const expected = {
      recipient: { userId: w.teacher.id, institutionId: w.institution.id },
      link: `/teacher/lessons/${lesson.id}`,
      entity: { type: 'lesson', id: lesson.id, attempt },
    };
    return { lesson, data: { lessonId: lesson.id, attempt }, expected };
  }

  it('questions ready → lesson.ready (success) for the owning teacher, once', async () => {
    const { data, expected } = await lessonWith({ questionCount: 5, difficulty: 'mixed', mode: 'replace_all' });
    await runLikeWorker(data);
    expect(calls()).toEqual([
      {
        ...expected,
        kind: 'lesson.ready',
        tone: 'success',
        title: 'Questions are ready to review for “Photosynthesis”.',
        body: '5 questions written from the recording.',
      },
    ]);
  });

  it('transcription-only run → lesson.transcribed asking for quiz settings', async () => {
    const { data, expected } = await lessonWith(null);
    await runLikeWorker(data);
    expect(calls()).toEqual([
      {
        ...expected,
        kind: 'lesson.transcribed',
        tone: 'success',
        title: '“Photosynthesis” has been transcribed.',
        body: 'Choose how many questions to write and how hard they should be.',
      },
    ]);
  });

  it('notifies a failure only after the final attempt, with the sanitised reason, and never twice', async () => {
    const { data, expected } = await lessonWith(null);
    setPipelineProvidersForTests({
      transcribe: async () => {
        throw new PipelineError('sarvam 503 at 10.0.0.1: upstream body', { retryable: true, userMessage: 'Speech-to-text failed. Please try again.' });
      },
      generate: mockGenerate,
      generateQuestions: mockGenerateQuestions,
    });
    // Intermediate attempts throw (and are retried) without notifying.
    await expect(processLessonJob(data, ctx(1))).rejects.toThrow();
    await expect(processLessonJob(data, ctx(2))).rejects.toThrow();
    expect(calls()).toEqual([]);

    const last = await processLessonJob(data, ctx(3)).then(
      () => null,
      (e: unknown) => e as Error,
    );
    await markLessonJobFailed(data, last!);
    await markLessonJobFailed(data, last!); // a repeated report changes nothing
    expect(calls()).toEqual([
      {
        ...expected,
        kind: 'lesson.failed',
        tone: 'error',
        title: 'We couldn’t finish “Photosynthesis”.',
        body: 'Speech-to-text failed. Please try again.',
      },
    ]);
    expect(JSON.stringify(calls())).not.toMatch(/sarvam|10\.0\.0\.1|upstream/);
  });

  it('a stale job (superseded by a regenerate) does not notify', async () => {
    const { lesson, data } = await lessonWith(null);
    await db.update(lessons).set({ generationAttempt: 3 }).where(eq(lessons.id, lesson.id));
    await runLikeWorker(data);
    await markLessonJobFailed(data, new Error('late'));
    expect(calls()).toEqual([]);
  });

  it('startup recovery re-enqueues without notifying', async () => {
    const { lesson } = await lessonWith(null, 1);
    await recoverStuckLessons();
    expect(queued).toEqual([{ lessonId: lesson.id, attempt: 2 }]);
    expect(calls()).toEqual([]);
  });

  it('stuck-lesson timeout → lesson.failed with the plain timeout reason', async () => {
    const { lesson, expected } = await lessonWith(null, 4);
    await db.update(lessons).set({ status: 'transcribing' }).where(eq(lessons.id, lesson.id));
    await db.execute(sql`update lessons set updated_at = ${new Date(Date.now() - (STUCK_LESSON_HOURS + 1) * 3600_000)} where id = ${lesson.id}`);
    expect(await failStuckLessons()).toBe(1);
    expect(calls()).toEqual([
      {
        ...expected,
        kind: 'lesson.failed',
        tone: 'error',
        title: 'We couldn’t finish “Photosynthesis”.',
        body: expect.stringMatching(/did not finish/),
      },
    ]);
    // Nothing else is stuck: a second sweep sends nothing.
    await failStuckLessons();
    expect(calls()).toHaveLength(1);
  });
});

/* ------------------------------------------ resources ------------------------------------------ */

describe('teaching-resource notifications', () => {
  let worker: ResourceWorkerHandle;
  let restore: (() => void) | null = null;
  beforeAll(() => {
    resourceJobTiming.backoffMs = 1;
    worker = startResourceWorker();
  });
  afterAll(async () => {
    await worker.close();
  });
  afterEach(() => restore?.());

  async function generate(w: Awaited<ReturnType<typeof createWorld>>) {
    const res = await as(w.teacher).post('/api/resources/generate').send({ prompt: 'Shadows for class 6', options: { type: 'worksheet' } });
    expect(res.status).toBe(201);
    const id = (res.body as ResourceDetail).id;
    await vi.waitFor(() => expect(calls().length).toBeGreaterThan(0), { timeout: 5_000, interval: 20 });
    return (await as(w.teacher).get(`/api/resources/${id}`)).body as ResourceDetail;
  }

  it('ready → resource.ready for the teacher, linking the resource', async () => {
    const w = await createWorld();
    restore = setGeneratorsForTests({
      worksheet: async () => ({ content: { instructions: 'Answer all.', sections: [] } }),
    });
    const r = await generate(w);
    expect(r.status).toBe('ready');
    expect(calls()).toEqual([
      {
        recipient: { userId: w.teacher.id, institutionId: w.institution.id },
        kind: 'resource.ready',
        tone: 'success',
        title: `Your worksheet “${r.title}” is ready.`,
        body: null,
        link: `/teacher/resources/${r.id}`,
        entity: { type: 'resource', id: r.id, attempt: expect.any(Number) },
      },
    ]);
  });

  it('failed after the last attempt → one resource.failed with the generic reason (no raw error)', async () => {
    const w = await createWorld();
    let tries = 0;
    restore = setGeneratorsForTests({
      worksheet: async () => {
        tries++;
        throw new Error('socket hang up at 10.0.0.1');
      },
    });
    const r = await generate(w);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(tries).toBe(2);
    expect(r.status).toBe('failed');
    expect(calls()).toEqual([
      expect.objectContaining({
        recipient: { userId: w.teacher.id, institutionId: w.institution.id },
        kind: 'resource.failed',
        tone: 'error',
        title: `We couldn’t create your worksheet “${r.title}”.`,
        body: 'Processing failed. Please try again.',
        link: `/teacher/resources/${r.id}`,
      }),
    ]);
  });
});

/* ------------------------------------------- deploys ------------------------------------------- */

describe('deploy watcher notifications', () => {
  const BASE = 'http://coolify.test:8000/api/v1';
  const saved = { url: env.COOLIFY_API_URL, token: env.COOLIFY_API_TOKEN, app: env.COOLIFY_APP_UUID };
  let app: Express;
  /** What the stubbed Coolify answers. */
  let coolify: {
    deployId: string | null;
    restartId: string | null;
    status: Record<string, string>;
    down: boolean;
    list: { deployment_uuid: string; status: string; created_at: string }[];
  };

  beforeAll(() => {
    app = express();
    app.use(cookieParser());
    app.use(express.json());
    app.use('/api/platform/ops', express.Router().use(authenticatePlatform(), opsRouter));
    app.use(notFoundHandler);
    app.use(errorHandler);
  });
  beforeEach(() => {
    resetDeployWatchesForTests();
    env.COOLIFY_API_URL = BASE;
    env.COOLIFY_API_TOKEN = 'token';
    env.COOLIFY_APP_UUID = 'app-1';
    coolify = { deployId: 'd-1', restartId: 'd-2', status: {}, down: false, list: [] };
    vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
      if (coolify.down) throw new TypeError('fetch failed');
      const method = init?.method ?? 'GET';
      const path = url.slice(BASE.length);
      const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
      if (path.startsWith('/deploy?') && method === 'POST') return json({ deployments: coolify.deployId ? [{ deployment_uuid: coolify.deployId }] : [] });
      if (path === '/applications/app-1/restart' && method === 'POST') return json({ deployment_uuid: coolify.restartId });
      if (path.startsWith('/deployments/applications/app-1')) return json({ deployments: coolify.list });
      const one = /^\/deployments\/([\w-]+)$/.exec(path);
      if (one && coolify.status[one[1]!]) return json({ deployment_uuid: one[1], status: coolify.status[one[1]!], logs: '[]' });
      return json({ message: 'nope' }, 404);
    });
  });
  afterEach(() => {
    env.COOLIFY_API_URL = saved.url;
    env.COOLIFY_API_TOKEN = saved.token;
    env.COOLIFY_APP_UUID = saved.app;
    vi.unstubAllGlobals();
  });

  async function admin() {
    const [row] = await db
      .insert(platformAdmins)
      .values({ email: `ops${Math.floor(Math.random() * 1e9)}@platform.test`, name: 'Ops', passwordHash: 'x', mustChangePassword: false })
      .returning();
    const auth = `Platform ${signPlatformToken(row!)}`;
    return { row: row!, post: (url: string) => request(app).post(url).set('Authorization', auth) };
  }

  it('redeploy: waits while running and through an outage, then deploy.succeeded to the admin who started it, once', async () => {
    const a = await admin();
    expect((await a.post('/api/platform/ops/redeploy').send({ confirm: 'REDEPLOY' })).body).toMatchObject({ deploymentId: 'd-1' });

    coolify.status['d-1'] = 'in_progress';
    expect(await checkDeployWatches()).toBe(0);

    // The redeploy restarts the API; Coolify/the network is briefly unreachable — the watch survives.
    coolify.down = true;
    expect(await checkDeployWatches()).toBe(0);
    coolify.down = false;
    expect(calls()).toEqual([]);

    coolify.status['d-1'] = 'finished';
    expect(await checkDeployWatches()).toBe(1);
    expect(calls()).toEqual([
      {
        recipient: { platformAdminId: a.row.id },
        kind: 'deploy.succeeded',
        tone: 'success',
        title: 'The deployment finished. The new version is live.',
        body: null,
        link: '/platform/deployments',
        entity: { type: 'deployment', id: 'd-1' },
      },
    ]);
    expect(await checkDeployWatches()).toBe(0);
    expect(calls()).toHaveLength(1);
  });

  it('restart that fails → deploy.failed (error)', async () => {
    const a = await admin();
    await a.post('/api/platform/ops/restart').send({ confirm: 'RESTART' });
    coolify.status['d-2'] = 'failed';
    expect(await checkDeployWatches()).toBe(1);
    expect(calls()).toEqual([
      expect.objectContaining({
        recipient: { platformAdminId: a.row.id },
        kind: 'deploy.failed',
        tone: 'error',
        title: 'The restart failed.',
        link: '/platform/deployments',
        entity: { type: 'deployment', id: 'd-2' },
      }),
    ]);
  });

  it('without a deployment id, follows the newest deployment created after the request', async () => {
    const a = await admin();
    coolify.deployId = null;
    await a.post('/api/platform/ops/redeploy').send({ confirm: 'REDEPLOY' });
    coolify.list = [
      { deployment_uuid: 'd-new', status: 'in_progress', created_at: new Date().toISOString() },
      { deployment_uuid: 'd-old', status: 'finished', created_at: '2026-01-01T00:00:00Z' },
    ];
    expect(await checkDeployWatches()).toBe(0);
    coolify.list = [];
    coolify.status['d-new'] = 'cancelled-by-user';
    expect(await checkDeployWatches()).toBe(1);
    expect(calls()).toEqual([
      expect.objectContaining({ kind: 'deploy.failed', title: 'The deployment was cancelled.', entity: { type: 'deployment', id: 'd-new' } }),
    ]);
  });

  it('gives up silently after the TTL, and watches nothing when Coolify is not configured', async () => {
    const a = await admin();
    await a.post('/api/platform/ops/redeploy').send({ confirm: 'REDEPLOY' });
    coolify.status['d-1'] = 'finished';
    expect(await checkDeployWatches(new Date(Date.now() + WATCH_TTL_MS + 60_000))).toBe(0);
    expect(await checkDeployWatches()).toBe(0);

    env.COOLIFY_API_URL = '';
    expect((await a.post('/api/platform/ops/redeploy').send({ confirm: 'REDEPLOY' })).body.configured).toBe(false);
    expect(await checkDeployWatches()).toBe(0);
    expect(calls()).toEqual([]);
  });
});
