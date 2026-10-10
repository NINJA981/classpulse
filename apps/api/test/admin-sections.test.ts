import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../src/db/client.js';
import { lessons, sections, timetableSlots } from '../src/db/schema/index.js';
import { as, createInstitution, createRoom, createSection, createUser, createWorld } from './helpers.js';

describe('admin: sections', () => {
  let world: Awaited<ReturnType<typeof createWorld>>;
  beforeEach(async () => {
    world = await createWorld();
  });

  it('lists sections with room, teachers and student count', async () => {
    const res = await as(world.admin).get('/api/admin/sections');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({
      id: world.section.id,
      room: { id: world.room.id, name: world.room.name },
      teachers: [{ id: world.teacher.id, name: world.teacher.name }],
      studentCount: 2,
      joinCode: world.section.joinCode,
    });
  });

  it('creates a section with a generated join code valid for 30 days', async () => {
    const res = await as(world.admin)
      .post('/api/admin/sections')
      .send({ name: 'Grade 9 - C', grade: '9', subject: 'Maths', roomId: world.room.id, teacherIds: [world.otherTeacher.id] });
    expect(res.status).toBe(201);
    expect(res.body.joinCode).toMatch(/^[A-Z0-9]{6}$/);
    const days = (Date.parse(res.body.joinCodeExpiresAt) - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(29);
    expect(days).toBeLessThanOrEqual(30);
    expect(res.body).toMatchObject({ teachers: [{ id: world.otherTeacher.id }], studentCount: 0, room: { id: world.room.id } });
  });

  it('rejects duplicate names and foreign rooms/teachers', async () => {
    const dup = await as(world.admin).post('/api/admin/sections').send({ name: world.section.name });
    expect(dup.status).toBe(409);
    const other = await createInstitution();
    const foreignRoom = await createRoom(other.id);
    const foreignTeacher = await createUser(other.id, 'teacher');
    expect((await as(world.admin).post('/api/admin/sections').send({ name: 'A', roomId: foreignRoom.id })).status).toBe(400);
    expect((await as(world.admin).post('/api/admin/sections').send({ name: 'B', teacherIds: [foreignTeacher.id] })).status).toBe(400);
    expect((await as(world.admin).post('/api/admin/sections').send({ name: 'C', teacherIds: [world.student.id] })).status).toBe(400);
    const all = await db.select().from(sections).where(eq(sections.institutionId, world.institution.id));
    expect(all).toHaveLength(1);
  });

  it('patches fields and replaces the teacher list', async () => {
    const res = await as(world.admin)
      .patch(`/api/admin/sections/${world.section.id}`)
      .send({ subject: 'Physics', roomId: null, teacherIds: [world.otherTeacher.id] });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ subject: 'Physics', room: null, teachers: [{ id: world.otherTeacher.id }] });

    const clear = await as(world.admin).patch(`/api/admin/sections/${world.section.id}`).send({ teacherIds: [] });
    expect(clear.body.teachers).toEqual([]);
  });

  it('rotates the join code', async () => {
    const res = await as(world.admin).post(`/api/admin/sections/${world.section.id}/rotate-code`);
    expect(res.status).toBe(200);
    expect(res.body.joinCode).toMatch(/^[A-Z0-9]{6}$/);
    expect(res.body.joinCode).not.toBe(world.section.joinCode);
  });

  it('deletes sections without lessons and refuses those with lessons', async () => {
    const empty = await createSection(world.institution.id);
    expect((await as(world.admin).delete(`/api/admin/sections/${empty.id}`)).status).toBe(204);
    await db.insert(lessons).values({
      institutionId: world.institution.id,
      teacherId: world.teacher.id,
      sectionId: world.section.id,
      title: 'L',
      subject: 'S',
    });
    const res = await as(world.admin).delete(`/api/admin/sections/${world.section.id}`);
    expect(res.status).toBe(409);
  });

  it('gets and replaces the enrolled students', async () => {
    const get = await as(world.admin).get(`/api/admin/sections/${world.section.id}/students`);
    expect(get.body.map((s: { id: string }) => s.id).sort()).toEqual([world.student.id, world.otherStudent.id].sort());

    const newcomer = await createUser(world.institution.id, 'student');
    const put = await as(world.admin)
      .put(`/api/admin/sections/${world.section.id}/students`)
      .send({ studentIds: [world.student.id, newcomer.id] });
    expect(put.status).toBe(200);
    expect(put.body.map((s: { id: string }) => s.id).sort()).toEqual([world.student.id, newcomer.id].sort());

    const other = await createInstitution();
    const foreign = await createUser(other.id, 'student');
    const bad = await as(world.admin).put(`/api/admin/sections/${world.section.id}/students`).send({ studentIds: [foreign.id] });
    expect(bad.status).toBe(400);

    const empty = await as(world.admin).put(`/api/admin/sections/${world.section.id}/students`).send({ studentIds: [] });
    expect(empty.body).toEqual([]);
  });

  it('isolates institutions', async () => {
    const other = await createInstitution();
    const foreign = await createSection(other.id);
    const list = await as(world.admin).get('/api/admin/sections');
    expect(list.body.map((s: { id: string }) => s.id)).not.toContain(foreign.id);
    expect((await as(world.admin).patch(`/api/admin/sections/${foreign.id}`).send({ name: 'X' })).status).toBe(404);
    expect((await as(world.admin).delete(`/api/admin/sections/${foreign.id}`)).status).toBe(404);
    expect((await as(world.admin).post(`/api/admin/sections/${foreign.id}/rotate-code`)).status).toBe(404);
    expect((await as(world.admin).get(`/api/admin/sections/${foreign.id}/students`)).status).toBe(404);
    expect((await as(world.admin).put(`/api/admin/sections/${foreign.id}/students`).send({ studentIds: [] })).status).toBe(404);
  });
});

describe('admin: timetable', () => {
  let world: Awaited<ReturnType<typeof createWorld>>;
  beforeEach(async () => {
    world = await createWorld();
  });

  const slot = (over: Record<string, unknown> = {}) => ({
    day: 'mon',
    period: 1,
    startTime: '09:00',
    endTime: '09:45',
    subject: 'Science',
    ...over,
  });

  it('replaces a section’s week and lists it', async () => {
    const put = await as(world.admin)
      .put(`/api/admin/timetable/${world.section.id}`)
      .send({
        slots: [
          slot({ day: 'tue', teacherId: world.teacher.id, roomId: world.room.id }),
          slot({ period: 2, startTime: '10:00', endTime: '10:45' }),
        ],
      });
    expect(put.status).toBe(200);
    expect(put.body).toHaveLength(2);
    expect(put.body[0]).toMatchObject({ day: 'mon', period: 2, teacher: null, room: null, sectionName: world.section.name });
    expect(put.body[1]).toMatchObject({ day: 'tue', teacher: { id: world.teacher.id }, room: { id: world.room.id } });

    const replace = await as(world.admin).put(`/api/admin/timetable/${world.section.id}`).send({ slots: [slot()] });
    expect(replace.body).toHaveLength(1);

    const other = await createSection(world.institution.id);
    await as(world.admin).put(`/api/admin/timetable/${other.id}`).send({ slots: [slot({ day: 'fri' })] });
    expect((await as(world.admin).get('/api/admin/timetable')).body).toHaveLength(2);
    const filtered = await as(world.admin).get(`/api/admin/timetable?sectionId=${other.id}`);
    expect(filtered.body).toHaveLength(1);
    expect(filtered.body[0].sectionId).toBe(other.id);
  });

  it('validates duplicates, times and ownership', async () => {
    const dup = await as(world.admin).put(`/api/admin/timetable/${world.section.id}`).send({ slots: [slot(), slot()] });
    expect(dup.status).toBe(400);
    const times = await as(world.admin)
      .put(`/api/admin/timetable/${world.section.id}`)
      .send({ slots: [slot({ startTime: '10:00', endTime: '09:00' })] });
    expect(times.status).toBe(400);

    const other = await createInstitution();
    const foreignTeacher = await createUser(other.id, 'teacher');
    const foreignRoom = await createRoom(other.id);
    expect(
      (await as(world.admin).put(`/api/admin/timetable/${world.section.id}`).send({ slots: [slot({ teacherId: foreignTeacher.id })] })).status,
    ).toBe(400);
    expect(
      (await as(world.admin).put(`/api/admin/timetable/${world.section.id}`).send({ slots: [slot({ roomId: foreignRoom.id })] })).status,
    ).toBe(400);

    const foreignSection = await createSection(other.id);
    expect((await as(world.admin).put(`/api/admin/timetable/${foreignSection.id}`).send({ slots: [] })).status).toBe(404);
    await db
      .insert(timetableSlots)
      .values({ sectionId: foreignSection.id, day: 'mon', period: 1, startTime: '09:00', endTime: '09:45', subject: 'X' });
    expect((await as(world.admin).get('/api/admin/timetable')).body).toHaveLength(0);
  });
});
