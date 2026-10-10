import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RecordingSession } from '@classpulse/shared';
import { setInProcessRunner, type LessonJobData } from '../src/jobs/queue.js';
import { db } from '../src/db/client.js';
import { deviceCommands, lessons, recordingSessions } from '../src/db/schema/index.js';
import { setLocalEmitter } from '../src/realtime/notify.js';
import { anon, as, createRoom, createSection, createUser, createWorld } from './helpers.js';
import { ack, heartbeat, pcm, pollCommand, provisionDevice, putChunk, startedRecording } from './devices.fixtures.js';

// The real enqueue hands jobs to this spy (no Redis in tests), so the AI pipeline never runs.
const runJob = vi.fn((_data: LessonJobData) => undefined);
const updates: { userId: string; event: string; payload: RecordingSession }[] = [];

beforeEach(() => {
  runJob.mockClear();
  setInProcessRunner(runJob);
  updates.length = 0;
  setLocalEmitter((userId, event, payload) => {
    if (event === 'recording:update') updates.push({ userId, event, payload: payload as RecordingSession });
  });
});

describe('recordings RBAC', () => {
  it('only teachers of the section can list devices or start recordings', async () => {
    const w = await createWorld();
    await provisionDevice(w);
    const body = { sectionId: w.section.id, title: 'Optics', subject: 'Physics' };

    expect((await anon().post('/api/recordings').send(body)).status).toBe(401);
    expect((await as(w.student).post('/api/recordings').send(body)).status).toBe(403);
    expect((await as(w.admin).post('/api/recordings').send(body)).status).toBe(403);
    expect((await as(w.otherTeacher).post('/api/recordings').send(body)).status).toBe(404);
    expect((await as(w.otherTeacher).get(`/api/recordings/devices?sectionId=${w.section.id}`)).status).toBe(404);
    expect((await as(w.teacher).get('/api/recordings/devices?sectionId=bad')).status).toBe(400);
    expect((await as(w.teacher).post('/api/recordings').send({ ...body, title: '' })).status).toBe(400);

    const list = await as(w.teacher).get(`/api/recordings/devices?sectionId=${w.section.id}`);
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].status).toBe('online');
  });

  it("hides another teacher's session", async () => {
    const w = await createWorld();
    const d = await provisionDevice(w);
    const { sessionId } = await startedRecording(w, d);
    // The other teacher also teaches the section, but the session is not theirs.
    await createSection(w.institution.id, { teacherIds: [w.otherTeacher.id] });
    expect((await as(w.otherTeacher).get(`/api/recordings/${sessionId}`)).status).toBe(404);
    expect((await as(w.otherTeacher).post(`/api/recordings/${sessionId}/stop`)).status).toBe(404);
    expect((await as(w.otherTeacher).post(`/api/recordings/${sessionId}/cancel`)).status).toBe(404);
  });
});

describe('recording device selection', () => {
  it('rejects a busy device and rooms with no online device', async () => {
    const w = await createWorld();
    const d = await provisionDevice(w);
    const body = { sectionId: w.section.id, title: 'Optics', subject: 'Physics' };
    expect((await as(w.teacher).post('/api/recordings').send(body)).status).toBe(201);
    // Second start on the same device (still pending): busy.
    const busy = await as(w.teacher).post('/api/recordings').send({ ...body, deviceId: d.id });
    expect(busy.status).toBe(409);

    const room2 = await createRoom(w.institution.id);
    const section2 = await createSection(w.institution.id, { teacherIds: [w.teacher.id], roomId: room2.id });
    const none = await as(w.teacher).post('/api/recordings').send({ ...body, sectionId: section2.id });
    expect(none.status).toBe(409);
    // A device from another room cannot be chosen explicitly.
    expect((await as(w.teacher).post('/api/recordings').send({ ...body, sectionId: section2.id, deviceId: d.id })).status).toBe(404);

    const offline = await provisionDevice(w, { roomId: room2.id, online: false });
    expect((await as(w.teacher).post('/api/recordings').send({ ...body, sectionId: section2.id, deviceId: offline.id })).status).toBe(409);
  });
});

describe('recording lifecycle', () => {
  it('start → ack → chunks → stop → finalize', async () => {
    const w = await createWorld();
    const d = await provisionDevice(w);

    const start = await as(w.teacher).post('/api/recordings').send({ sectionId: w.section.id, title: 'Optics', subject: 'Physics', language: 'hi-IN' });
    expect(start.status).toBe(201);
    expect(start.body).toMatchObject({ status: 'pending', chunksReceived: 0, device: { id: d.id, status: 'online' } });
    const sessionId = start.body.id as string;
    const [lesson0] = await db.select().from(lessons).where(eq(lessons.id, start.body.lessonId));
    expect(lesson0).toMatchObject({ status: 'recording', sourceType: 'device', language: 'hi-IN', teacherId: w.teacher.id });

    const cmd = await pollCommand(d.headers);
    expect(cmd).toMatchObject({ type: 'start_recording', payload: { sessionId, lessonId: start.body.lessonId } });
    expect((await ack(d.headers, cmd!.id)).status).toBe(204);
    expect((await ack(d.headers, cmd!.id)).status).toBe(204); // duplicate ack is harmless

    const afterAck = await as(w.teacher).get(`/api/recordings/${sessionId}`);
    expect(afterAck.body.status).toBe('recording');
    expect(afterAck.body.startedAt).toBeTruthy();
    expect(afterAck.body.device.status).toBe('recording');

    expect((await putChunk(d.headers, sessionId, 0, pcm(1))).status).toBe(200);
    expect((await putChunk(d.headers, sessionId, 1, pcm(0.5))).status).toBe(200);
    await new Promise((r) => setTimeout(r, 100));
    // At least the first chunk pushed an update with the received count (throttled to ~1 / 5 s).
    expect(updates.some((u) => u.payload.id === sessionId && u.payload.chunksReceived >= 1)).toBe(true);

    const stop = await as(w.teacher).post(`/api/recordings/${sessionId}/stop`);
    expect(stop.status).toBe(200);
    expect(stop.body.status).toBe('stopping');
    expect(stop.body.stoppedAt).toBeTruthy();
    expect((await as(w.teacher).post(`/api/recordings/${sessionId}/stop`)).body.status).toBe('stopping'); // idempotent

    const stopCmd = await pollCommand(d.headers);
    expect(stopCmd).toMatchObject({ type: 'stop_recording', payload: { sessionId } });
    expect((await ack(d.headers, stopCmd!.id)).status).toBe(204);

    const fin = await anon().post(`/api/devices/me/sessions/${sessionId}/finalize`).set(d.headers).send({ totalChunks: 2, durationSec: 1.5 });
    expect(fin.status).toBe(200);

    const final = await as(w.teacher).get(`/api/recordings/${sessionId}`);
    expect(final.body).toMatchObject({ status: 'finalized', chunksReceived: 2, expectedChunks: 2, failureReason: null });
    const [lesson] = await db.select().from(lessons).where(eq(lessons.id, start.body.lessonId));
    expect(lesson!.status).toBe('queued');
    expect(lesson!.audioObjectKey).toBeTruthy();
    expect(runJob).toHaveBeenCalledWith(expect.objectContaining({ lessonId: start.body.lessonId }));

    const statuses = updates.filter((u) => u.payload.id === sessionId).map((u) => u.payload.status);
    expect(statuses).toEqual(expect.arrayContaining(['pending', 'recording', 'stopping', 'finalized']));
    expect(updates.every((u) => u.userId === w.teacher.id)).toBe(true);

    // The device is free again.
    expect((await as(w.teacher).post('/api/recordings').send({ sectionId: w.section.id, title: 'Next', subject: 'Physics' })).status).toBe(201);
  });

  it('a failed start ack fails the session and the lesson', async () => {
    const w = await createWorld();
    const d = await provisionDevice(w);
    const start = await as(w.teacher).post('/api/recordings').send({ sectionId: w.section.id, title: 'Optics', subject: 'Physics' });
    const cmd = await pollCommand(d.headers);
    expect((await ack(d.headers, cmd!.id, false, 'Not enough free disk space')).status).toBe(204);
    const s = await as(w.teacher).get(`/api/recordings/${start.body.id}`);
    expect(s.body.status).toBe('failed');
    expect(s.body.failureReason).toMatch(/Not enough free disk space/);
    const [lesson] = await db.select().from(lessons).where(eq(lessons.id, start.body.lessonId));
    expect(lesson!.status).toBe('failed');
    expect(updates.at(-1)?.payload.status).toBe('failed');
  });

  it('cancel fails the lesson, withdraws or stops the device and refuses later chunks', async () => {
    const w = await createWorld();
    const d = await provisionDevice(w);

    // Cancel before the device picked up the start command: the command is withdrawn.
    const first = await as(w.teacher).post('/api/recordings').send({ sectionId: w.section.id, title: 'A', subject: 'S' });
    const c1 = await as(w.teacher).post(`/api/recordings/${first.body.id}/cancel`);
    expect(c1.status).toBe(200);
    expect(c1.body.status).toBe('cancelled');
    expect(await pollCommand(d.headers)).toBeNull();
    const [l1] = await db.select().from(lessons).where(eq(lessons.id, first.body.lessonId));
    expect(l1).toMatchObject({ status: 'failed', failureReason: 'Recording cancelled' });

    // Cancel while recording: a stop command is sent.
    const { sessionId } = await startedRecording(w, d);
    expect((await as(w.teacher).post(`/api/recordings/${sessionId}/cancel`)).body.status).toBe('cancelled');
    expect(await pollCommand(d.headers)).toMatchObject({ type: 'stop_recording', payload: { sessionId } });
    expect((await putChunk(d.headers, sessionId, 0, pcm(0.2))).status).toBe(409);
    expect((await anon().get(`/api/devices/me/sessions/${sessionId}/chunks`).set(d.headers)).body.status).toBe('cancelled');
    // Cancelling again is idempotent; stopping a cancelled recording is not allowed.
    expect((await as(w.teacher).post(`/api/recordings/${sessionId}/cancel`)).status).toBe(200);
    expect((await as(w.teacher).post(`/api/recordings/${sessionId}/stop`)).status).toBe(409);
    const cmds = await db.select().from(deviceCommands).where(eq(deviceCommands.deviceId, d.id));
    expect(cmds.filter((c) => c.type === 'stop_recording')).toHaveLength(1);
  });

  it('heartbeat-reported recording marks the device busy for new sessions', async () => {
    const w = await createWorld();
    const d = await provisionDevice(w);
    await heartbeat(d.headers, 'recording');
    const res = await as(w.teacher).post('/api/recordings').send({ sectionId: w.section.id, title: 'A', subject: 'S', deviceId: d.id });
    expect(res.status).toBe(409);
    const [s] = await db.select().from(recordingSessions);
    expect(s).toBeUndefined();
    // Teacher without sections in this institution
    const t = await createUser(w.institution.id, 'teacher');
    expect((await as(t).get(`/api/recordings/devices?sectionId=${w.section.id}`)).status).toBe(404);
  });
});
