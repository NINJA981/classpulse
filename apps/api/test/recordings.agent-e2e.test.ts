/**
 * Cross-language end-to-end: the real Python classroom agent (WAV file source)
 * against the real API on an ephemeral port. Skipped when Python 3.11+ is missing.
 */
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, type Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { db } from '../src/db/client.js';
import { devices, lessons } from '../src/db/schema/index.js';
import { setInProcessRunner, type LessonJobData } from '../src/jobs/queue.js';
import { wavHeader } from '../src/modules/devices/wav.js';
import { as, createWorld } from './helpers.js';
import { issueToken, pcm } from './devices.fixtures.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const agentPy = path.resolve(here, '../../classroom-agent/agent.py');

function findPython(): string | null {
  for (const bin of ['python3', 'python']) {
    const r = spawnSync(bin, ['-c', 'import sys; sys.exit(0 if sys.version_info >= (3, 11) else 1)'], { stdio: 'ignore' });
    if (r.status === 0) return bin;
  }
  return null;
}
const python = findPython();

let server: HttpServer;
let baseUrl: string;
let agent: ChildProcess | null = null;
let workDir: string;
let agentLog = '';

beforeAll(async () => {
  server = createServer(createApp());
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterEach(() => {
  agent?.kill();
  agent = null;
  if (workDir) rmSync(workDir, { recursive: true, force: true });
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

async function until<T>(fn: () => Promise<T | null | undefined | false>, timeoutMs: number, what: string): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}\n--- agent log ---\n${agentLog.slice(-4000)}`);
    await new Promise((r) => setTimeout(r, 200));
  }
}

describe.skipIf(!python)('classroom agent ↔ API end-to-end', () => {
  it('registers, records a WAV on command, uploads chunks and finalizes', async () => {
    const runJob = vi.fn((_d: LessonJobData) => undefined);
    setInProcessRunner(runJob);
    const w = await createWorld();
    const token = await issueToken(w, w.room.id, 'E2E Pi');

    workDir = mkdtempSync(path.join(os.tmpdir(), 'cp-agent-'));
    const audio = pcm(2.5);
    writeFileSync(path.join(workDir, 'lecture.wav'), Buffer.concat([wavHeader(audio.length), audio]));
    const configPath = path.join(workDir, 'agent.json');
    writeFileSync(
      configPath,
      JSON.stringify({
        server_url: baseUrl,
        allow_insecure_http: true,
        device_id: 'e2e-agent-1',
        enrollment_token: token,
        data_dir: path.join(workDir, 'data'),
        chunk_seconds: 1,
        heartbeat_interval_sec: 5,
        min_free_disk_mb: 1,
        audio_source: { type: 'file', path: path.join(workDir, 'lecture.wav'), realtime: false },
      }),
    );

    agent = spawn(python!, [agentPy, '--config', configPath], { stdio: ['ignore', 'pipe', 'pipe'] });
    agent.stdout!.on('data', (d: Buffer) => (agentLog += d.toString()));
    agent.stderr!.on('data', (d: Buffer) => (agentLog += d.toString()));

    const device = await until(
      async () => (await db.select().from(devices).where(eq(devices.deviceId, 'e2e-agent-1')))[0]?.status === 'online' &&
        (await db.select().from(devices).where(eq(devices.deviceId, 'e2e-agent-1')))[0],
      20_000,
      'device online',
    );
    expect(device.stats).toMatchObject({ micOk: true });

    const start = await as(w.teacher).post('/api/recordings').send({ sectionId: w.section.id, title: 'E2E class', subject: 'Science' });
    expect(start.status).toBe(201);
    const sessionId = start.body.id as string;

    await until(
      async () => {
        const s = await as(w.teacher).get(`/api/recordings/${sessionId}`);
        return s.body.status === 'recording' && s.body.chunksReceived >= 3 && s.body;
      },
      30_000,
      'chunks uploaded',
    );

    expect((await as(w.teacher).post(`/api/recordings/${sessionId}/stop`)).status).toBe(200);
    const final = await until(
      async () => {
        const s = await as(w.teacher).get(`/api/recordings/${sessionId}`);
        return s.body.status === 'finalized' && s.body;
      },
      30_000,
      'finalized',
    );
    expect(final).toMatchObject({ chunksReceived: 3, expectedChunks: 3 });
    // The lesson is queued right after the session commits (chunk cleanup may still be running).
    const lesson = await until(
      async () => (await db.select().from(lessons).where(eq(lessons.id, start.body.lessonId))).find((l) => l.status === 'queued'),
      10_000,
      'lesson queued',
    );
    expect(lesson.durationSec).toBeCloseTo(2.5, 1);
    expect(runJob).toHaveBeenCalledWith(expect.objectContaining({ lessonId: start.body.lessonId }));
    // The server may finish before the agent logs the finalize response.
    await until(async () => agentLog.includes('Recording finalized'), 10_000, 'agent finalize log');
    expect(agentLog).not.toContain(token); // secrets never logged
  }, 90_000);
});
