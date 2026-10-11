/** Platform ops: health, queues, logs (sink + API), audit, Coolify deployments and the ops periodic tasks. */
import express, { type Express } from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { desc, eq } from 'drizzle-orm';
import { env } from '../src/config/env.js';
import { db } from '../src/db/client.js';
import { appLogs, auditLogs, healthSnapshots, platformAdmins } from '../src/db/schema/index.js';
import { healthSnapshotTask, logRetentionTask } from '../src/jobs/opsTasks.js';
import { createLogSink, shouldStore, type AppLogRow } from '../src/lib/logSink.js';
import { signPlatformToken } from '../src/lib/platformSession.js';
import { authenticatePlatform } from '../src/middleware/platformAuth.js';
import { errorHandler, notFoundHandler } from '../src/middleware/errorHandler.js';
import { auditRouter } from '../src/modules/platform/opsAudit.js';
import { opsRouter } from '../src/modules/platform/opsRoutes.js';
import { createInstitution, createUser, sessionCookie } from './helpers.js';

let app: Express | null = null;
function opsApp(): Express {
  if (app) return app;
  app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use('/api/platform/ops', express.Router().use(authenticatePlatform(), opsRouter));
  app.use('/api/platform/audit', express.Router().use(authenticatePlatform(), auditRouter));
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

async function platformAdmin() {
  const [row] = await db
    .insert(platformAdmins)
    .values({ email: `ops${Math.floor(Math.random() * 1e9)}@platform.test`, name: 'Ops Admin', passwordHash: 'x', mustChangePassword: false })
    .returning();
  return row!;
}

async function asPlatform() {
  const admin = await platformAdmin();
  const auth = `Platform ${signPlatformToken(admin)}`;
  const a = opsApp();
  return {
    admin,
    get: (url: string) => request(a).get(url).set('Authorization', auth),
    post: (url: string) => request(a).post(url).set('Authorization', auth),
  };
}

const line = (o: Record<string, unknown>) => JSON.stringify({ time: Date.now(), pid: 1, hostname: 'h', service: 'api', ...o });

/* ------------------------------------------------------------------------ */

describe('platform ops: access control', () => {
  it('rejects requests without a platform session (401) and with a school session (401)', async () => {
    const res = await request(opsApp()).get('/api/platform/ops/health');
    expect(res.status).toBe(401);

    const inst = await createInstitution();
    const admin = await createUser(inst.id, 'admin');
    const school = await request(opsApp()).get('/api/platform/ops/logs').set('Cookie', sessionCookie(admin));
    expect(school.status).toBe(401);
    const audit = await request(opsApp()).get('/api/platform/audit').set('Cookie', sessionCookie(admin));
    expect(audit.status).toBe(401);
    const redeploy = await request(opsApp()).post('/api/platform/ops/redeploy').send({ confirm: 'REDEPLOY' });
    expect(redeploy.status).toBe(401);
  });
});

describe('platform ops: health', () => {
  it('aggregates every component (no Redis in tests: queues null, worker unknown)', async () => {
    const p = await asPlatform();
    const res = await p.get('/api/platform/ops/health');
    expect(res.status).toBe(200);
    const h = res.body;
    expect(['ok', 'degraded', 'down']).toContain(h.status);
    expect(Array.isArray(h.alerts)).toBe(true);
    expect(h.database.status).toBe('ok');
    expect(typeof h.database.latencyMs).toBe('number');
    expect(h.database.sizeBytes).toBeGreaterThan(0);
    expect(h.database.tables.length).toBeGreaterThan(0);
    expect(h.database.tables.length).toBeLessThanOrEqual(8);
    expect(h.redis).toMatchObject({ configured: false, status: 'unknown' });
    expect(h.queues).toBeNull();
    expect(h.worker.status).toBe('unknown');
    expect(h.api).toMatchObject({ status: 'ok', nodeVersion: process.version });
    expect(h.storage).toHaveProperty('audioBytes', 0);
    expect(h.providers.map((x: { provider: string }) => x.provider)).toEqual(['openai', 'sarvam']);
    expect(h.providers[0]).toMatchObject({ configured: false, status: 'unknown' });
    expect(h.email).toHaveProperty('sentLast24h', 0);
    expect(h.devices).toMatchObject({ total: 0, status: 'ok' });
    expect(h.backups).toHaveProperty('mounted');
  });

  it('flags provider failures in the last hour as alerts', async () => {
    const p = await asPlatform();
    await db.execute(
      // raw insert keeps this test independent of the stats module
      (await import('drizzle-orm')).sql`insert into ai_usage (kind, provider, model, ok, error_code) values ('stt', 'sarvam', 'saarika:v2.5', false, 'HTTP_429')`,
    );
    const res = await p.get('/api/platform/ops/health');
    const sarvam = res.body.providers.find((x: { provider: string }) => x.provider === 'sarvam');
    expect(sarvam.failuresLastHour).toBe(1);
    expect(sarvam.lastErrorCode).toBe('HTTP_429');
    expect(res.body.alerts.some((a: { id: string }) => a.id === 'provider-sarvam-failing')).toBe(true);
  });

  describe('provider tests (stubbed fetch)', () => {
    const saved = { openai: env.OPENAI_API_KEY, sarvam: env.SARVAM_API_KEY };
    afterEach(() => {
      env.OPENAI_API_KEY = saved.openai;
      env.SARVAM_API_KEY = saved.sarvam;
      vi.unstubAllGlobals();
    });

    it('reports "not configured" without calling out', async () => {
      const fetchSpy = vi.fn();
      vi.stubGlobal('fetch', fetchSpy);
      const p = await asPlatform();
      const res = await p.post('/api/platform/ops/providers/openai/test');
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ provider: 'openai', configured: false, ok: false });
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('tests OpenAI with GET /models and never returns the key; audited', async () => {
      env.OPENAI_API_KEY = 'sk-test-SECRET-123';
      const calls: { url: string; init?: RequestInit }[] = [];
      vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
        calls.push({ url, init });
        return new Response(JSON.stringify({ data: [], echo: 'sk-test-SECRET-123' }), { status: 200 });
      });
      const p = await asPlatform();
      const res = await p.post('/api/platform/ops/providers/openai/test');
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ ok: true, httpStatus: 200, configured: true });
      expect(typeof res.body.latencyMs).toBe('number');
      expect(JSON.stringify(res.body)).not.toContain('SECRET');
      expect(calls[0]!.url).toBe(`${env.OPENAI_BASE_URL}/models`);
      expect((calls[0]!.init?.headers as Record<string, string>).Authorization).toBe('Bearer sk-test-SECRET-123');
      const [entry] = await db.select().from(auditLogs).where(eq(auditLogs.action, 'platform.provider.test'));
      expect(entry).toMatchObject({ actorType: 'platform', actorId: p.admin.id, targetId: 'openai' });
    });

    it('tests Sarvam by creating a job (no audio) and reports a rejected key', async () => {
      env.SARVAM_API_KEY = 'sarvam-key';
      const calls: { url: string; init?: RequestInit }[] = [];
      vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
        calls.push({ url, init });
        return new Response('{"error":"bad key sarvam-key"}', { status: 403 });
      });
      const p = await asPlatform();
      const res = await p.post('/api/platform/ops/providers/sarvam/test');
      expect(res.body).toMatchObject({ provider: 'sarvam', ok: false, httpStatus: 403 });
      expect(JSON.stringify(res.body)).not.toContain('sarvam-key');
      expect(calls[0]!.url).toBe(`${env.SARVAM_BASE_URL}/speech-to-text/job/v1`);
      expect(calls[0]!.init?.method).toBe('POST');
      expect(JSON.parse(String(calls[0]!.init?.body))).toEqual({
        job_parameters: { language_code: 'unknown', model: 'saarika:v2.5', with_timestamps: false },
      });
    });

    it('rejects unknown providers', async () => {
      const p = await asPlatform();
      expect((await p.post('/api/platform/ops/providers/gemini/test')).status).toBe(400);
    });
  });

  it('health snapshot task inserts a snapshot and history returns it', async () => {
    await healthSnapshotTask.run();
    const rows = await db.select().from(healthSnapshots);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.checks).toHaveProperty('statuses');
    const p = await asPlatform();
    const res = await p.get('/api/platform/ops/health/history?hours=24');
    expect(res.status).toBe(200);
    expect(res.body.points).toHaveLength(1);
    expect(res.body.points[0]).toHaveProperty('dbLatencyMs');
    expect(typeof res.body.uptimePercent).toBe('number');
  });
});

describe('platform ops: queues without Redis', () => {
  it('lists no failed jobs, 404s actions, and allowlists queue names', async () => {
    const p = await asPlatform();
    const list = await p.get('/api/platform/ops/queues/email/failed?limit=10');
    expect(list.status).toBe(200);
    expect(list.body.items).toEqual([]);
    expect((await p.post('/api/platform/ops/queues/email/jobs/1/retry')).status).toBe(404);
    expect((await p.post('/api/platform/ops/queues/lesson-generation/retry-all-failed')).status).toBe(404);
    expect((await p.get('/api/platform/ops/queues/secrets/failed')).status).toBe(400);
  });
});

describe('log sink', () => {
  it('stores warn+, app info and only interesting request logs', () => {
    expect(shouldStore({ level: 30, msg: 'Lesson generation enqueued' })).toBe(true);
    expect(shouldStore({ level: 20, msg: 'debug' })).toBe(false);
    expect(shouldStore({ level: 40, msg: 'warn' })).toBe(true);
    const http = (method: string, statusCode: number, responseTime: number, level = 30) => ({
      level,
      msg: 'request completed',
      req: { id: 'r1', method, url: '/api/x' },
      res: { statusCode },
      responseTime,
    });
    expect(shouldStore(http('GET', 200, 20))).toBe(false);
    expect(shouldStore(http('POST', 201, 20))).toBe(true);
    expect(shouldStore(http('GET', 404, 5, 40))).toBe(true);
    expect(shouldStore(http('GET', 200, 1500))).toBe(true);
  });

  it('batches inserts by size and caps its buffer', async () => {
    const batches: AppLogRow[][] = [];
    const sink = createLogSink({ batchSize: 2, maxBuffer: 3, flushIntervalMs: 60_000, insert: async (rows) => void batches.push(rows) });
    sink.write(line({ level: 30, msg: 'a' }));
    expect(batches).toHaveLength(0);
    sink.write(line({ level: 30, msg: 'b' })); // reaches batchSize → flush
    await sink.flush();
    expect(batches).toHaveLength(1);
    expect(batches[0]!.map((r) => r.msg)).toEqual(['a', 'b']);

    // Block inserts so the buffer fills up.
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const slow = createLogSink({ batchSize: 100, maxBuffer: 3, flushIntervalMs: 60_000, insert: async (rows) => { await gate; batches.push(rows); } });
    for (let i = 0; i < 5; i++) slow.write(line({ level: 40, msg: `m${i}` }));
    expect(slow.stats()).toMatchObject({ buffered: 3, dropped: 2 });
    slow.write('not json');
    const flushed = slow.flush();
    release();
    await flushed;
    const last = batches.at(-1)!;
    expect(last.map((r) => r.msg)).toEqual(['m0', 'm1', 'm2', '2 log lines were dropped (log buffer full)']);
    await sink.close();
    await slow.close();
  });

  it('never throws when the insert fails', async () => {
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const sink = createLogSink({ insert: async () => { throw new Error('db down'); } });
    sink.write(line({ level: 50, msg: 'boom' }));
    await expect(sink.flush()).resolves.toBeUndefined();
    expect(sink.stats()).toMatchObject({ failedBatches: 1, dropped: 1 });
    await sink.close();
    stderr.mockRestore();
  });
});

describe('platform ops: logs API', () => {
  async function seedLogs() {
    const inst = await createInstitution({ name: 'Log School' });
    const sink = createLogSink({ flushIntervalMs: 60_000 });
    sink.write(line({ level: 30, msg: 'Lesson generation enqueued', jobId: 'lesson:1' }));
    sink.write(line({ level: 30, msg: 'request completed', req: { id: 'req-get', method: 'GET', url: '/api/lessons' }, res: { statusCode: 200 }, responseTime: 4 }));
    sink.write(line({ level: 30, msg: 'request completed', req: { id: 'req-post', method: 'POST', url: '/api/lessons' }, res: { statusCode: 201 }, responseTime: 12 }));
    sink.write(line({ level: 40, msg: 'Email delivery attempt failed', institutionId: inst.id, service: 'worker' }));
    sink.write(line({ level: 50, msg: '=HYPERLINK("http://evil")', err: { message: 'x' } }));
    await sink.close();
    return inst;
  }

  it('returns newest first, tails with `after` ascending, and filters', async () => {
    const inst = await seedLogs();
    const p = await asPlatform();

    const all = await p.get('/api/platform/ops/logs');
    expect(all.status).toBe(200);
    const msgs = all.body.items.map((l: { msg: string }) => l.msg);
    expect(msgs).toHaveLength(4); // the fast GET request log was not stored
    expect(msgs[0]).toBe('=HYPERLINK("http://evil")');
    expect(msgs).toContain('POST /api/lessons → 201 (12 ms)');
    expect(all.body.latestId).toBe(all.body.items[0].id);
    const post = all.body.items.find((l: { reqId: string | null }) => l.reqId === 'req-post');
    expect(post.context.req).toMatchObject({ method: 'POST' });

    const firstId = all.body.items.at(-1).id;
    const tail = await p.get(`/api/platform/ops/logs?after=${firstId}`);
    const ids = tail.body.items.map((l: { id: number }) => l.id);
    expect(ids).toHaveLength(3);
    expect([...ids].sort((a, b) => a - b)).toEqual(ids);

    const warn = await p.get('/api/platform/ops/logs?level=warn');
    expect(warn.body.items.map((l: { levelName: string }) => l.levelName)).toEqual(['error', 'warn']);

    const q = await p.get('/api/platform/ops/logs?q=delivery');
    expect(q.body.items).toHaveLength(1);
    expect(q.body.items[0]).toMatchObject({ service: 'worker', institutionName: 'Log School' });

    const wild = await p.get('/api/platform/ops/logs?q=%25');
    expect(wild.body.items).toHaveLength(0);

    const byInst = await p.get(`/api/platform/ops/logs?institutionId=${inst.id}`);
    expect(byInst.body.items).toHaveLength(1);

    const byService = await p.get('/api/platform/ops/logs?service=worker&limit=1');
    expect(byService.body.items).toHaveLength(1);

    expect((await p.get('/api/platform/ops/logs?limit=501')).status).toBe(400);
    expect((await p.get('/api/platform/ops/logs?level=verbose')).status).toBe(400);
  });

  it('exports CSV with formula injection neutralised', async () => {
    await seedLogs();
    const p = await asPlatform();
    const res = await p.get('/api/platform/ops/logs.csv');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toMatch(/attachment; filename="logs-/);
    expect(res.text).toContain(`"'=HYPERLINK(""http://evil"")"`);
    expect(res.text).not.toMatch(/(^|,)=HYPERLINK/m);
  });

  it('log retention task deletes rows older than 14 days only', async () => {
    const old = new Date(Date.now() - 20 * 86400_000);
    await db.insert(appLogs).values([
      { at: old, level: 30, service: 'api', msg: 'old' },
      { at: old, level: 50, service: 'api', msg: 'old error' },
      { at: new Date(), level: 30, service: 'api', msg: 'fresh' },
    ]);
    await logRetentionTask.run();
    const left = await db.select({ msg: appLogs.msg }).from(appLogs);
    expect(left.map((r) => r.msg)).toEqual(['fresh']);
  });
});

describe('platform ops: audit', () => {
  async function seedAudit() {
    const a = await createInstitution({ name: 'Alpha School' });
    const b = await createInstitution({ name: 'Beta School' });
    const base = { actorType: 'user', actorRole: 'admin' } as const;
    await db.insert(auditLogs).values([
      { ...base, actorName: 'Asha Admin', institutionId: a.id, action: 'auth.login', at: new Date(Date.now() - 3 * 86400_000) },
      { ...base, actorName: 'Asha Admin', institutionId: a.id, action: 'users.create', metadata: { role: 'teacher' } },
      { ...base, actorName: 'Bala Admin', institutionId: b.id, action: 'auth.login' },
      { actorType: 'platform', actorRole: 'superadmin', actorName: '@Ops', action: 'platform.queue.retry', targetType: 'job', targetId: '7' },
    ]);
    return { a, b };
  }

  it('filters by school, actor, action prefix and date, with paging', async () => {
    const { a } = await seedAudit();
    const p = await asPlatform();

    const all = await p.get('/api/platform/ops/audit');
    expect(all.status).toBe(200);
    expect(all.body).toMatchObject({ total: 4, page: 1, pageSize: 50 });

    const school = await p.get(`/api/platform/audit?institutionId=${a.id}`);
    expect(school.status).toBe(200);
    expect(school.body.total).toBe(2);
    expect(school.body.items[0]).toMatchObject({ institutionName: 'Alpha School', action: 'users.create', metadata: { role: 'teacher' } });

    const actor = await p.get('/api/platform/ops/audit?actor=bala');
    expect(actor.body.items.map((x: { actorName: string }) => x.actorName)).toEqual(['Bala Admin']);

    const action = await p.get('/api/platform/ops/audit?action=auth.');
    expect(action.body.total).toBe(2);

    const recent = await p.get(`/api/platform/ops/audit?action=auth.login&from=${encodeURIComponent(new Date(Date.now() - 86400_000).toISOString())}`);
    expect(recent.body.total).toBe(1);

    const paged = await p.get('/api/platform/ops/audit?page=2&pageSize=3');
    expect(paged.body).toMatchObject({ total: 4, page: 2, pageSize: 3 });
    expect(paged.body.items).toHaveLength(1);

    expect((await p.get('/api/platform/ops/audit?pageSize=1000')).status).toBe(400);
    expect((await p.get('/api/platform/audit?institutionId=nope')).status).toBe(400);
  });

  it('exports CSV with formula injection neutralised', async () => {
    await seedAudit();
    const p = await asPlatform();
    const res = await p.get('/api/platform/ops/audit.csv');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.text.split('\r\n')[0]).toMatch(/^id,at,actor_type/);
    expect(res.text).toContain(",'@Ops,");
  });
});

describe('platform ops: deployments (Coolify)', () => {
  const saved = { url: env.COOLIFY_API_URL, token: env.COOLIFY_API_TOKEN, app: env.COOLIFY_APP_UUID };
  const BASE = 'http://coolify.test:8000/api/v1';

  afterEach(() => {
    env.COOLIFY_API_URL = saved.url;
    env.COOLIFY_API_TOKEN = saved.token;
    env.COOLIFY_APP_UUID = saved.app;
    vi.unstubAllGlobals();
  });

  it('returns setup instructions when Coolify is not configured', async () => {
    const p = await asPlatform();
    for (const url of ['/api/platform/ops/app', '/api/platform/ops/deployments', '/api/platform/ops/deployments/abc/logs']) {
      const res = await p.get(url);
      expect(res.status).toBe(200);
      expect(res.body.configured).toBe(false);
      expect(res.body.instructions.length).toBeGreaterThan(0);
    }
    const redeploy = await p.post('/api/platform/ops/redeploy').send({ confirm: 'REDEPLOY' });
    expect(redeploy.body.configured).toBe(false);
  });

  describe('configured', () => {
    const calls: { method: string; url: string; auth: string | null; body: unknown }[] = [];
    let deploymentsStatus = 200;

    beforeEach(() => {
      env.COOLIFY_API_URL = `${BASE}/`;
      env.COOLIFY_API_TOKEN = 'coolify-token-SECRET';
      env.COOLIFY_APP_UUID = 'app-uuid-1';
      calls.length = 0;
      deploymentsStatus = 200;
      vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
        const method = init?.method ?? 'GET';
        const headers = (init?.headers ?? {}) as Record<string, string>;
        calls.push({ method, url, auth: headers.Authorization ?? null, body: init?.body ? JSON.parse(String(init.body)) : null });
        const path = url.slice(BASE.length);
        const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
        if (path === '/applications/app-uuid-1') {
          return json({
            uuid: 'app-uuid-1',
            name: 'classpulse',
            status: 'running:healthy',
            fqdn: 'https://app.example.org',
            git_branch: 'main',
            git_commit_sha: 'HEAD',
            environment_variables: [{ key: 'JWT_SECRET', value: 'super-secret-jwt' }],
            private_key: '-----BEGIN OPENSSH PRIVATE KEY-----',
            dockerfile: 'FROM node',
          });
        }
        if (path.startsWith('/deployments/applications/app-uuid-1')) {
          if (deploymentsStatus !== 200) return json({ message: 'Not found' }, deploymentsStatus);
          return json({
            count: 2,
            deployments: [
              { deployment_uuid: 'd-old', status: 'failed', commit: 'aaaaaaa1111', created_at: '2026-10-01T10:00:00Z', updated_at: '2026-10-01T10:01:00Z', logs: '[{"output":"SECRET=1"}]' },
              { deployment_uuid: 'd-new', status: 'finished', commit: 'f30fa9e1234567', commit_message: 'docs: handbook\n\nbody', created_at: '2026-10-10T10:00:00Z', finished_at: '2026-10-10T10:03:30Z' },
            ],
          });
        }
        if (path === '/deployments') {
          return json([
            { deployment_uuid: 'd-run', application_uuid: 'app-uuid-1', status: 'in_progress', commit: 'bbbbbbb2222', created_at: '2026-10-11T09:00:00Z' },
            { deployment_uuid: 'd-other', application_uuid: 'someone-else', status: 'in_progress', created_at: '2026-10-11T09:00:00Z' },
          ]);
        }
        if (path === '/deployments/d-new') {
          return json({
            deployment_uuid: 'd-new',
            status: 'finished',
            logs: JSON.stringify([
              { output: 'Step 1/9 : FROM node:22', timestamp: '2026-10-10T10:00:01Z', hidden: false },
              { output: 'docker login --password abc', hidden: true },
              { output: 'export DATABASE_PASSWORD=hunter2', hidden: false },
              { output: 'JWT_SECRET is set', hidden: false },
              { output: 'API_KEY=sk-live-123', hidden: false },
              { output: 'Build complete', timestamp: '2026-10-10T10:03:00Z', hidden: false },
            ]),
          });
        }
        if (path.startsWith('/deploy?') && method === 'POST') return json({ deployments: [{ message: 'queued', resource_uuid: 'app-uuid-1', deployment_uuid: 'd-queued' }] });
        if (path === '/applications/app-uuid-1/restart' && method === 'POST') return json({ message: 'Restart request queued.', deployment_uuid: 'd-restart' });
        return json({ message: 'nope' }, 500);
      });
    });

    it('whitelists application fields (no env, keys or raw payload)', async () => {
      const p = await asPlatform();
      const res = await p.get('/api/platform/ops/app');
      expect(res.status).toBe(200);
      expect(Object.keys(res.body).sort()).toEqual(
        ['configured', 'currentCommit', 'fqdn', 'gitBranch', 'lastOnlineAt', 'name', 'runningVersion', 'status'].sort(),
      );
      expect(res.body).toMatchObject({ configured: true, status: 'running:healthy', currentCommit: 'f30fa9e', fqdn: 'https://app.example.org' });
      const text = JSON.stringify(res.body);
      expect(text).not.toMatch(/super-secret-jwt|PRIVATE KEY|environment|coolify-token/);
      expect(calls.every((c) => c.auth === 'Bearer coolify-token-SECRET')).toBe(true);
    });

    it('normalises deployment history (and falls back to /deployments on 404)', async () => {
      const p = await asPlatform();
      const res = await p.get('/api/platform/ops/deployments');
      expect(res.status).toBe(200);
      expect(res.body.items).toEqual([
        { id: 'd-new', status: 'finished', commit: 'f30fa9e', commitMessage: 'docs: handbook', createdAt: '2026-10-10T10:00:00.000Z', finishedAt: '2026-10-10T10:03:30.000Z', durationSec: 210 },
        { id: 'd-old', status: 'failed', commit: 'aaaaaaa', commitMessage: null, createdAt: '2026-10-01T10:00:00.000Z', finishedAt: '2026-10-01T10:01:00.000Z', durationSec: 60 },
      ]);
      expect(JSON.stringify(res.body)).not.toContain('SECRET');

      deploymentsStatus = 404;
      const fallback = await p.get('/api/platform/ops/deployments');
      expect(fallback.body.items.map((d: { id: string }) => d.id)).toEqual(['d-run']);
    });

    it('returns build logs without hidden or secret-looking lines', async () => {
      const p = await asPlatform();
      const res = await p.get('/api/platform/ops/deployments/d-new/logs');
      expect(res.status).toBe(200);
      const texts = res.body.lines.map((l: { text: string }) => l.text);
      expect(texts).toEqual([
        'Step 1/9 : FROM node:22',
        '[hidden: this line may contain a secret]',
        '[hidden: this line may contain a secret]',
        '[hidden: this line may contain a secret]',
        'Build complete',
      ]);
      expect(JSON.stringify(res.body)).not.toMatch(/hunter2|sk-live|--password/);
      expect((await p.get('/api/platform/ops/deployments/..%2Fapplications/logs')).status).toBe(400);
    });

    it('requires the typed confirmation to redeploy or restart, and audits both', async () => {
      const p = await asPlatform();
      expect((await p.post('/api/platform/ops/redeploy').send({})).status).toBe(400);
      expect((await p.post('/api/platform/ops/redeploy').send({ confirm: 'redeploy' })).status).toBe(400);
      expect((await p.post('/api/platform/ops/restart').send({ confirm: 'REDEPLOY' })).status).toBe(400);
      expect(calls.filter((c) => c.method === 'POST')).toHaveLength(0);

      const deploy = await p.post('/api/platform/ops/redeploy').send({ confirm: 'REDEPLOY' });
      expect(deploy.status).toBe(200);
      expect(deploy.body).toMatchObject({ configured: true, ok: true, deploymentId: 'd-queued' });
      const post = calls.find((c) => c.method === 'POST')!;
      expect(post.url).toBe(`${BASE}/deploy?uuid=app-uuid-1&force=false`);
      expect(post.body).toEqual({ uuid: 'app-uuid-1' });

      const restart = await p.post('/api/platform/ops/restart').send({ confirm: 'RESTART' });
      expect(restart.body).toMatchObject({ ok: true, deploymentId: 'd-restart' });

      const actions = (await db.select().from(auditLogs).orderBy(desc(auditLogs.id))).map((r) => r.action);
      expect(actions).toEqual(['platform.deploy.restart', 'platform.deploy.redeploy']);
    });

    it('maps Coolify failures to 502 without leaking details', async () => {
      env.COOLIFY_APP_UUID = 'missing';
      const p = await asPlatform();
      const res = await p.get('/api/platform/ops/app');
      expect(res.status).toBe(502);
      expect(res.body.error.code).toBe('UPSTREAM_FAILED');
      expect(JSON.stringify(res.body)).not.toContain('coolify-token');
    });
  });
});
