import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_MODEL_SETTINGS } from '@classiq/shared';
import { db } from '../src/db/client.js';
import { devices, lessons, quizAttempts } from '../src/db/schema/index.js';
import { as, createInstitution, createRoom, createUser, createWorld } from './helpers.js';

describe('admin: institution', () => {
  let world: Awaited<ReturnType<typeof createWorld>>;
  beforeEach(async () => {
    world = await createWorld();
  });

  it('reads and updates the admin’s institution', async () => {
    const get = await as(world.admin).get('/api/admin/institution');
    expect(get.status).toBe(200);
    expect(get.body).toMatchObject({ id: world.institution.id, code: world.institution.code });

    const put = await as(world.admin)
      .put('/api/admin/institution')
      .send({ name: 'Renamed Academy', code: 'ren-01', timezone: 'Asia/Kolkata', academicYear: '2026-27' });
    expect(put.status).toBe(200);
    expect(put.body).toMatchObject({ id: world.institution.id, name: 'Renamed Academy', code: 'REN-01', academicYear: '2026-27' });
  });

  it('rejects an unknown timezone and a code used by another institution', async () => {
    await createInstitution({ code: 'TAKEN' });
    const tz = await as(world.admin).put('/api/admin/institution').send({ name: 'X', code: 'XX', timezone: 'Mars/Base' });
    expect(tz.status).toBe(400);
    const dup = await as(world.admin).put('/api/admin/institution').send({ name: 'X', code: 'TAKEN' });
    expect(dup.status).toBe(409);
  });
});

describe('admin: rooms', () => {
  let world: Awaited<ReturnType<typeof createWorld>>;
  beforeEach(async () => {
    world = await createWorld();
  });

  it('creates, lists, updates and deletes rooms', async () => {
    const created = await as(world.admin).post('/api/admin/rooms').send({ name: 'Lab 1', building: 'Science', capacity: 30 });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ name: 'Lab 1', building: 'Science', capacity: 30, deviceCount: 0 });

    const list = await as(world.admin).get('/api/admin/rooms');
    expect(list.body.map((r: { name: string }) => r.name)).toContain('Lab 1');

    const patched = await as(world.admin).patch(`/api/admin/rooms/${created.body.id}`).send({ capacity: 35 });
    expect(patched.status).toBe(200);
    expect(patched.body).toMatchObject({ name: 'Lab 1', capacity: 35 });

    expect((await as(world.admin).delete(`/api/admin/rooms/${created.body.id}`)).status).toBe(204);
    expect((await as(world.admin).delete(`/api/admin/rooms/${created.body.id}`)).status).toBe(404);
  });

  it('rejects duplicate names and invalid input', async () => {
    const dup = await as(world.admin).post('/api/admin/rooms').send({ name: world.room.name });
    expect(dup.status).toBe(409);
    const bad = await as(world.admin).post('/api/admin/rooms').send({ name: '', capacity: -1 });
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe('VALIDATION_FAILED');
    expect((await as(world.admin).patch('/api/admin/rooms/not-a-uuid').send({})).status).toBe(400);
  });

  it('counts devices and refuses to delete a room with a device', async () => {
    await db.insert(devices).values({
      institutionId: world.institution.id,
      roomId: world.room.id,
      deviceId: 'rpi-test-1',
      name: 'Pi',
      apiKeyHash: 'a'.repeat(64),
    });
    const list = await as(world.admin).get('/api/admin/rooms');
    expect(list.body.find((r: { id: string }) => r.id === world.room.id).deviceCount).toBe(1);
    const del = await as(world.admin).delete(`/api/admin/rooms/${world.room.id}`);
    expect(del.status).toBe(409);
  });

  it('isolates institutions', async () => {
    const other = await createInstitution();
    const foreignRoom = await createRoom(other.id, 'Foreign');
    const list = await as(world.admin).get('/api/admin/rooms');
    expect(list.body.map((r: { id: string }) => r.id)).not.toContain(foreignRoom.id);
    expect((await as(world.admin).patch(`/api/admin/rooms/${foreignRoom.id}`).send({ name: 'Mine' })).status).toBe(404);
    expect((await as(world.admin).delete(`/api/admin/rooms/${foreignRoom.id}`)).status).toBe(404);
  });
});

describe('admin: model settings', () => {
  let world: Awaited<ReturnType<typeof createWorld>>;
  beforeEach(async () => {
    world = await createWorld();
  });

  it('returns defaults, then persists partial updates', async () => {
    const get = await as(world.admin).get('/api/admin/settings/models');
    expect(get.status).toBe(200);
    expect(get.body).toEqual({ ...DEFAULT_MODEL_SETTINGS, configured: { sarvam: false, openai: false } });

    const patch = await as(world.admin).patch('/api/admin/settings/models').send({ questionsPerLesson: 8, bilingual: false });
    expect(patch.status).toBe(200);
    expect(patch.body).toMatchObject({ questionsPerLesson: 8, bilingual: false, llmModel: DEFAULT_MODEL_SETTINGS.llmModel });

    const again = await as(world.admin).patch('/api/admin/settings/models').send({ llmModel: 'gpt-4.1-mini' });
    expect(again.body).toMatchObject({ questionsPerLesson: 8, llmModel: 'gpt-4.1-mini' });

    const bad = await as(world.admin).patch('/api/admin/settings/models').send({ questionsPerLesson: 99 });
    expect(bad.status).toBe(400);

    // Models come from the dropdown lists; switching provider picks that provider's default model.
    const unknown = await as(world.admin).patch('/api/admin/settings/models').send({ llmModel: 'gpt-3' });
    expect(unknown.status).toBe(400);
    expect(unknown.body.error).toMatchObject({ code: 'VALIDATION_FAILED', details: [{ path: 'llmModel' }] });
    const whisper = await as(world.admin).patch('/api/admin/settings/models').send({ sttProvider: 'openai' });
    expect(whisper.body).toMatchObject({ sttProvider: 'openai', sttModel: 'whisper-1' });
    const mismatch = await as(world.admin).patch('/api/admin/settings/models').send({ sttModel: 'saaras:v3' });
    expect(mismatch.status).toBe(400);
  });
});

describe('admin: overview', () => {
  it('aggregates counts for the admin’s institution only', async () => {
    const world = await createWorld();
    const other = await createInstitution();
    await createUser(other.id, 'teacher');
    const [lesson] = await db
      .insert(lessons)
      .values({
        institutionId: world.institution.id,
        teacherId: world.teacher.id,
        sectionId: world.section.id,
        title: 'Photosynthesis',
        subject: 'Science',
        status: 'published',
        publishedAt: new Date(),
      })
      .returning();
    await db.insert(lessons).values({
      institutionId: world.institution.id,
      teacherId: world.teacher.id,
      sectionId: world.section.id,
      title: 'Draft',
      subject: 'Science',
    });
    await db.insert(quizAttempts).values([
      { lessonId: lesson!.id, studentId: world.student.id, idempotencyKey: crypto.randomUUID(), correct: 1, total: 2, scorePct: 50 },
      { lessonId: lesson!.id, studentId: world.otherStudent.id, idempotencyKey: crypto.randomUUID(), correct: 2, total: 2, scorePct: 100 },
    ]);
    await db.insert(devices).values({
      institutionId: world.institution.id,
      roomId: world.room.id,
      deviceId: 'rpi-ov-1',
      name: 'Pi',
      apiKeyHash: 'b'.repeat(64),
      status: 'recording',
    });

    const res = await as(world.admin).get('/api/admin/overview');
    expect(res.status).toBe(200);
    expect(res.body.institution).toMatchObject({ id: world.institution.id });
    expect(res.body.counts).toEqual({
      teachers: 2,
      students: 2,
      sections: 1,
      rooms: 1,
      lessons: 2,
      publishedLessons: 1,
      devicesOnline: 1,
      devicesTotal: 1,
    });
    expect(res.body.lessonsByStatus).toEqual({ published: 1, draft: 1 });
    expect(res.body.recentLessons).toHaveLength(2);
    expect(res.body.recentLessons[0].teacherName).toBe(world.teacher.name);
    expect(res.body.averageQuizScorePct).toBe(75);
  });
});
