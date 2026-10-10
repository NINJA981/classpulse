import { existsSync } from 'node:fs';
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
// test/setup.ts loads the app graph before any vi.mock here could apply, so instead of
// mocking the queue module we register a spy as the in-process job runner: the real
// enqueueLessonGeneration hands jobs to it (no Redis in tests) and the AI pipeline never runs.
import { setInProcessRunner, type LessonJobData } from '../src/jobs/queue.js';
import { db } from '../src/db/client.js';
import { deviceEnrollmentTokens, devices, lessons, recordingSessions } from '../src/db/schema/index.js';
import { storage, storageKeys } from '../src/lib/storage.js';
import { sweepDevices } from '../src/modules/devices/sweep.js';
import { anon, as, createInstitution, createRoom, createWorld } from './helpers.js';
import {
  heartbeat,
  issueToken,
  pcm,
  pollCommand,
  provisionDevice,
  putChunk,
  sha256,
  startedRecording,
} from './devices.fixtures.js';

const runJob = vi.fn((_data: LessonJobData) => undefined);
beforeEach(() => {
  runJob.mockClear();
  setInProcessRunner(runJob);
});

describe('admin devices', () => {
  it('issues enrollment tokens (admin only, own institution rooms)', async () => {
    const w = await createWorld();
    const res = await as(w.admin).post('/api/admin/devices/enrollment-tokens').send({ roomId: w.room.id, name: 'Pi 101' });
    expect(res.status).toBe(201);
    expect(res.body.token.length).toBeGreaterThanOrEqual(24);
    expect(res.body.room).toEqual({ id: w.room.id, name: w.room.name });
    const [stored] = await db.select().from(deviceEnrollmentTokens);
    expect(stored!.tokenHash).toBe(sha256(Buffer.from(res.body.token)));
    expect(stored!.tokenHash).not.toBe(res.body.token);

    expect((await as(w.teacher).post('/api/admin/devices/enrollment-tokens').send({ roomId: w.room.id, name: 'x' })).status).toBe(403);
    expect((await anon().post('/api/admin/devices/enrollment-tokens').send({ roomId: w.room.id, name: 'x' })).status).toBe(401);
    const other = await createInstitution();
    const foreignRoom = await createRoom(other.id);
    expect((await as(w.admin).post('/api/admin/devices/enrollment-tokens').send({ roomId: foreignRoom.id, name: 'x' })).status).toBe(404);
    expect((await as(w.admin).post('/api/admin/devices/enrollment-tokens').send({ roomId: 'nope', name: 'x' })).status).toBe(400);
  });

  it('lists devices with stats and revokes them', async () => {
    const w = await createWorld();
    const d = await provisionDevice(w);
    const list = await as(w.admin).get('/api/admin/devices');
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0]).toMatchObject({ deviceId: d.deviceId, status: 'online', activeRecordingId: null, agentVersion: '2.0.0' });
    expect(list.body[0].stats).toMatchObject({ micOk: true, cpuTempC: 48.5, diskFreeMb: 20000 });
    expect(JSON.stringify(list.body)).not.toContain(d.key);

    const otherAdmin = await createWorld();
    expect((await as(otherAdmin.admin).delete(`/api/admin/devices/${d.id}`)).status).toBe(404);
    expect((await as(w.admin).delete(`/api/admin/devices/${d.id}`)).status).toBe(204);
    expect((await heartbeat(d.headers)).status).toBe(401);
    expect((await as(w.admin).get('/api/admin/devices')).body).toHaveLength(0);
  });

  it('refuses to revoke a device with an active recording', async () => {
    const w = await createWorld();
    const d = await provisionDevice(w);
    await startedRecording(w, d);
    const res = await as(w.admin).delete(`/api/admin/devices/${d.id}`);
    expect(res.status).toBe(409);
  });
});

describe('device registration', () => {
  it('registers with a valid token once and stores only the key hash', async () => {
    const w = await createWorld();
    const token = await issueToken(w);
    const res = await anon().post('/api/devices/register').send({ enrollmentToken: token, deviceId: 'rpi5-room-101', agentVersion: '2.0.0' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ deviceId: 'rpi5-room-101', room: { id: w.room.id, name: w.room.name } });
    const key = res.body.deviceKey as string;
    const [row] = await db.select().from(devices);
    expect(row!.apiKeyHash).toBe(sha256(Buffer.from(key)));

    // Token is single-use.
    const again = await anon().post('/api/devices/register').send({ enrollmentToken: token, deviceId: 'rpi5-room-102', agentVersion: '2.0.0' });
    expect(again.status).toBe(401);
  });

  it('rejects expired and unknown tokens and invalid input', async () => {
    const w = await createWorld();
    const token = await issueToken(w);
    await db.update(deviceEnrollmentTokens).set({ expiresAt: new Date(Date.now() - 1000) });
    expect((await anon().post('/api/devices/register').send({ enrollmentToken: token, deviceId: 'rpi5-a', agentVersion: '1' })).status).toBe(401);
    expect(
      (await anon().post('/api/devices/register').send({ enrollmentToken: 'x'.repeat(32), deviceId: 'rpi5-a', agentVersion: '1' })).status,
    ).toBe(401);
    const fresh = await issueToken(w);
    expect((await anon().post('/api/devices/register').send({ enrollmentToken: fresh, deviceId: '../etc', agentVersion: '1' })).status).toBe(400);
  });

  it('re-provisions an existing device id with a new token and never returns the existing key', async () => {
    const w = await createWorld();
    const d = await provisionDevice(w);
    const room2 = await createRoom(w.institution.id);
    const token = await issueToken(w, room2.id, 'Moved device');
    const res = await anon().post('/api/devices/register').send({ enrollmentToken: token, deviceId: d.deviceId, agentVersion: '2.0.1' });
    expect(res.status).toBe(201);
    expect(res.body.deviceKey).not.toBe(d.key);
    expect(res.body.room.id).toBe(room2.id);
    expect((await heartbeat(d.headers)).status).toBe(401); // old key dead
    expect((await heartbeat({ 'X-Device-Id': d.deviceId, 'X-Device-Key': res.body.deviceKey })).status).toBe(200);
    expect(await db.select().from(devices)).toHaveLength(1);
  });
});

describe('device auth and heartbeat', () => {
  it('rejects missing or wrong credentials', async () => {
    const w = await createWorld();
    const d = await provisionDevice(w);
    expect((await anon().post('/api/devices/me/heartbeat').send({})).status).toBe(401);
    expect((await heartbeat({ 'X-Device-Id': d.deviceId, 'X-Device-Key': 'wrong-key' })).status).toBe(401);
    expect((await heartbeat({ 'X-Device-Id': 'unknown-device', 'X-Device-Key': d.key })).status).toBe(401);
    // A user session cookie is not device auth.
    expect((await as(w.admin).post('/api/devices/me/heartbeat').send({})).status).toBe(401);
  });

  it('records heartbeat status, stats and ip', async () => {
    const w = await createWorld();
    const d = await provisionDevice(w, { online: false });
    const res = await heartbeat(d.headers, 'recording');
    expect(res.status).toBe(200);
    expect(typeof res.body.serverTime).toBe('string');
    const [row] = await db.select().from(devices).where(eq(devices.id, d.id));
    expect(row!.status).toBe('recording');
    expect(row!.lastHeartbeatAt).toBeInstanceOf(Date);
    expect(row!.ipAddress).toBeTruthy();
    expect(row!.stats).toMatchObject({ micOk: true, micName: 'USB mic', backlogChunks: 0 });
    await heartbeat(d.headers, 'error');
    const [row2] = await db.select().from(devices).where(eq(devices.id, d.id));
    expect(row2!.status).toBe('error');
    const bad = await anon().post('/api/devices/me/heartbeat').set(d.headers).send({ status: 'idle', micOk: 'yes', agentVersion: '1' });
    expect(bad.status).toBe(400);
  });
});

describe('device commands', () => {
  it('returns null immediately with wait=0 and wakes a long-poll when a command is created', async () => {
    const w = await createWorld();
    const d = await provisionDevice(w);
    expect(await pollCommand(d.headers, 0)).toBeNull();

    const started = Date.now();
    const poll = pollCommand(d.headers, 10);
    await new Promise((r) => setTimeout(r, 300));
    const start = await as(w.teacher).post('/api/recordings').send({ sectionId: w.section.id, title: 'T', subject: 'S' });
    expect(start.status).toBe(201);
    const command = await poll;
    expect(Date.now() - started).toBeLessThan(5000);
    expect(command).toMatchObject({ type: 'start_recording', payload: { sessionId: start.body.id, lessonId: start.body.lessonId } });
    // Delivered commands are not handed out again immediately.
    expect(await pollCommand(d.headers, 0)).toBeNull();
    expect((await anon().get('/api/devices/me/commands?wait=99').set(d.headers)).status).toBe(400);
  });
});

describe('chunk upload and finalize', () => {
  it('validates chunk uploads and is idempotent', async () => {
    const w = await createWorld();
    const d = await provisionDevice(w);
    const { sessionId } = await startedRecording(w, d);
    const body = pcm(0.5);

    expect((await putChunk(d.headers, sessionId, 0, body, sha256(pcm(0.5, 7)))).status).toBe(400); // sha mismatch
    expect((await putChunk(d.headers, sessionId, 0, body.subarray(0, 1001))).status).toBe(400); // odd length
    expect((await putChunk(d.headers, 'not-a-uuid', 0, body)).status).toBe(400);
    expect((await putChunk(d.headers, '..%2F..%2Fetc', 0, body)).status).toBe(400);
    expect((await putChunk(d.headers, sessionId, '1.5', body)).status).toBe(400);
    expect((await putChunk(d.headers, sessionId, 100000, body)).status).toBe(400);
    expect((await putChunk(d.headers, sessionId, -1, body)).status).toBe(400);
    const noSha = await anon()
      .put(`/api/devices/me/sessions/${sessionId}/chunks/0`)
      .set(d.headers)
      .set('Content-Type', 'application/octet-stream')
      .send(body);
    expect(noSha.status).toBe(400);
    const wrongType = await anon()
      .put(`/api/devices/me/sessions/${sessionId}/chunks/0`)
      .set(d.headers)
      .set('X-Chunk-SHA256', sha256(body))
      .set('Content-Type', 'text/plain')
      .send(body.toString('latin1'));
    expect(wrongType.status).toBe(415);

    const ok = await putChunk(d.headers, sessionId, 0, body);
    expect(ok.status).toBe(200);
    expect(ok.body).toEqual({ idx: 0, sha256: sha256(body), bytes: body.length });
    expect((await putChunk(d.headers, sessionId, 0, body)).status).toBe(200); // same again
    const replacement = pcm(0.5, 3);
    expect((await putChunk(d.headers, sessionId, 0, replacement)).status).toBe(200); // replaced
    expect((await putChunk(d.headers, sessionId, 2, body)).status).toBe(200);

    const list = await anon().get(`/api/devices/me/sessions/${sessionId}/chunks`).set(d.headers);
    expect(list.status).toBe(200);
    expect(list.body.received).toEqual([0, 2]);
    expect(list.body.status).toBe('recording');
    expect(existsSync(storage.localPath(storageKeys.recordingChunk(sessionId, 0)))).toBe(true);
  });

  it("rejects another device's session", async () => {
    const w = await createWorld();
    const d1 = await provisionDevice(w);
    const room2 = await createRoom(w.institution.id);
    const d2 = await provisionDevice(w, { roomId: room2.id });
    const { sessionId } = await startedRecording(w, d1);
    expect((await putChunk(d2.headers, sessionId, 0, pcm(0.1))).status).toBe(404);
    expect((await anon().get(`/api/devices/me/sessions/${sessionId}/chunks`).set(d2.headers)).status).toBe(404);
    expect((await anon().post(`/api/devices/me/sessions/${sessionId}/finalize`).set(d2.headers).send({ totalChunks: 1, durationSec: 1 })).status).toBe(404);
  });

  it('finalize lists missing chunks, then assembles audio and queues generation', async () => {
    const w = await createWorld();
    const d = await provisionDevice(w);
    const { sessionId, lessonId } = await startedRecording(w, d);
    const c0 = pcm(1);
    const c1 = pcm(1, 16000);
    expect((await putChunk(d.headers, sessionId, 0, c0)).status).toBe(200);

    const missing = await anon().post(`/api/devices/me/sessions/${sessionId}/finalize`).set(d.headers).send({ totalChunks: 3, durationSec: 3 });
    expect(missing.status).toBe(409);
    expect(missing.body.error.details.missing).toEqual([1, 2]);

    expect((await putChunk(d.headers, sessionId, 1, c1)).status).toBe(200);
    const res = await anon().post(`/api/devices/me/sessions/${sessionId}/finalize`).set(d.headers).send({ totalChunks: 2, durationSec: 2 });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: sessionId, status: 'finalized', expectedChunks: 2 });

    const [lesson] = await db.select().from(lessons).where(eq(lessons.id, lessonId));
    expect(lesson!.audioObjectKey).toMatch(new RegExp(`^audio/${lessonId}/`));
    expect(lesson!.sourceType).toBe('device');
    expect({ status: lesson!.status, reason: lesson!.failureReason }).toEqual({ status: 'queued', reason: null });
    expect(lesson!.durationSec).toBeGreaterThan(1.9);
    expect(lesson!.durationSec).toBeLessThan(2.1);
    expect(existsSync(storage.localPath(lesson!.audioObjectKey!))).toBe(true);
    expect(runJob).toHaveBeenCalledTimes(1);
    expect(runJob).toHaveBeenCalledWith(expect.objectContaining({ lessonId }));
    expect(existsSync(storage.localPath(storageKeys.recordingChunk(sessionId, 0)))).toBe(false);
    const [session] = await db.select().from(recordingSessions).where(eq(recordingSessions.id, sessionId));
    expect(session!.durationSec).toBe(2);
    const [dev] = await db.select().from(devices).where(eq(devices.id, d.id));
    expect(dev!.status).toBe('online');

    // Retried finalize is idempotent; further chunks are refused.
    expect((await anon().post(`/api/devices/me/sessions/${sessionId}/finalize`).set(d.headers).send({ totalChunks: 2, durationSec: 2 })).status).toBe(200);
    expect((await putChunk(d.headers, sessionId, 2, c0)).status).toBe(409);
  });
});

describe('device sweep', () => {
  it('marks silent devices offline and fails recordings that never started', async () => {
    const w = await createWorld();
    const d = await provisionDevice(w);
    const start = await as(w.teacher).post('/api/recordings').send({ sectionId: w.section.id, title: 'T', subject: 'S' });
    expect(start.status).toBe(201);

    expect((await sweepDevices()).offline).toBe(0);
    await db.update(devices).set({ lastHeartbeatAt: new Date(Date.now() - 10 * 60_000) });
    await db.update(recordingSessions).set({ createdAt: new Date(Date.now() - 3 * 60_000) });
    const result = await sweepDevices(new Date(Date.now() + 3 * 60_000)); // also past the start command expiry
    expect(result.offline).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.expired).toBe(1);
    const [dev] = await db.select().from(devices).where(eq(devices.id, d.id));
    expect(dev!.status).toBe('offline');
    const [session] = await db.select().from(recordingSessions);
    expect(session!.status).toBe('failed');
    const [lesson] = await db.select().from(lessons);
    expect(lesson!.status).toBe('failed');
    expect(lesson!.failureReason).toMatch(/did not start/);
  });
});
