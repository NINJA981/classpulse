import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../src/db/client.js';
import { enrollments, lessons, users } from '../src/db/schema/index.js';
import { anon, as, createInstitution, createSection, createUser, createWorld } from './helpers.js';

describe('admin: teachers', () => {
  let world: Awaited<ReturnType<typeof createWorld>>;
  beforeEach(async () => {
    world = await createWorld();
  });

  it('lists teachers with their sections', async () => {
    const res = await as(world.admin).get('/api/admin/teachers');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    const t = res.body.find((x: { id: string }) => x.id === world.teacher.id);
    expect(t.sections).toEqual([{ id: world.section.id, name: world.section.name }]);
    expect(t.passwordHash).toBeUndefined();
  });

  it('creates a teacher with a generated password that must be changed', async () => {
    const res = await as(world.admin).post('/api/admin/teachers').send({ name: 'Neha', email: 'Neha@School.in', department: 'Maths' });
    expect(res.status).toBe(201);
    expect(res.body.record).toMatchObject({ name: 'Neha', email: 'neha@school.in', department: 'Maths', status: 'active', sections: [] });
    expect(res.body.initialPassword).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{2}$/);
    // No email transport configured in this suite: the one-time password is the only way in.
    expect(res.body.invite).toBe('email_disabled');
    expect(res.body.record.inviteStatus).toBe('none');

    const login = await anon().post('/api/auth/login').send({ email: 'neha@school.in', password: res.body.initialPassword });
    expect(login.status).toBe(200);
    expect(login.body.user.mustChangePassword).toBe(true);
  });

  it('accepts an explicit password and returns no initialPassword', async () => {
    const res = await as(world.admin).post('/api/admin/teachers').send({ name: 'Raj', email: 'raj@school.in', password: 'Explicit#123' });
    expect(res.status).toBe(201);
    expect(res.body.initialPassword).toBeNull();
  });

  it('returns 409 for a duplicate email (create and patch)', async () => {
    const dup = await as(world.admin).post('/api/admin/teachers').send({ name: 'Dup', email: world.teacher.email });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('CONFLICT');
    const patch = await as(world.admin).patch(`/api/admin/teachers/${world.teacher.id}`).send({ email: world.otherTeacher.email });
    expect(patch.status).toBe(409);
  });

  it('disabling a teacher revokes their sessions', async () => {
    const teacherClient = as(world.teacher);
    expect((await teacherClient.get('/api/teacher/sections')).status).toBe(200);
    const res = await as(world.admin).patch(`/api/admin/teachers/${world.teacher.id}`).send({ status: 'disabled', department: 'Physics' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'disabled', department: 'Physics' });
    expect((await teacherClient.get('/api/teacher/sections')).status).toBe(401);
  });

  it('resets a password and revokes sessions', async () => {
    const teacherClient = as(world.teacher);
    const res = await as(world.admin).post(`/api/admin/teachers/${world.teacher.id}/reset-password`);
    expect(res.status).toBe(200);
    expect(typeof res.body.initialPassword).toBe('string');
    expect((await teacherClient.get('/api/auth/me')).status).toBe(401);
    const row = await db.query.users.findFirst({ where: eq(users.id, world.teacher.id) });
    expect(row?.mustChangePassword).toBe(true);
  });

  it('deletes a teacher, but not one who owns lessons', async () => {
    await db.insert(lessons).values({
      institutionId: world.institution.id,
      teacherId: world.teacher.id,
      sectionId: world.section.id,
      title: 'L',
      subject: 'S',
    });
    expect((await as(world.admin).delete(`/api/admin/teachers/${world.teacher.id}`)).status).toBe(409);
    expect((await as(world.admin).delete(`/api/admin/teachers/${world.otherTeacher.id}`)).status).toBe(204);
    expect((await as(world.admin).delete(`/api/admin/teachers/${world.otherTeacher.id}`)).status).toBe(404);
  });

  it('cannot touch teachers of another institution or non-teachers', async () => {
    const other = await createInstitution();
    const foreign = await createUser(other.id, 'teacher');
    const list = await as(world.admin).get('/api/admin/teachers');
    expect(list.body.map((t: { id: string }) => t.id)).not.toContain(foreign.id);
    expect((await as(world.admin).patch(`/api/admin/teachers/${foreign.id}`).send({ name: 'X' })).status).toBe(404);
    expect((await as(world.admin).post(`/api/admin/teachers/${foreign.id}/reset-password`)).status).toBe(404);
    expect((await as(world.admin).delete(`/api/admin/teachers/${foreign.id}`)).status).toBe(404);
    expect((await as(world.admin).patch(`/api/admin/teachers/${world.student.id}`).send({ name: 'X' })).status).toBe(404);
  });
});

describe('admin: students', () => {
  let world: Awaited<ReturnType<typeof createWorld>>;
  beforeEach(async () => {
    world = await createWorld();
  });

  it('lists with pagination, search and section filter', async () => {
    const second = await createSection(world.institution.id);
    await createUser(world.institution.id, 'student', { name: 'Zara Khan', rollNumber: '10C-07' });
    const lone = await createUser(world.institution.id, 'student', { name: 'Lone Wolf', rollNumber: 'LW-1' });
    await db.insert(enrollments).values({ sectionId: second.id, studentId: lone.id });

    const all = await as(world.admin).get('/api/admin/students?pageSize=2&page=1');
    expect(all.status).toBe(200);
    expect(all.body).toMatchObject({ page: 1, pageSize: 2, total: 4 });
    expect(all.body.items).toHaveLength(2);

    const byName = await as(world.admin).get('/api/admin/students?q=zara');
    expect(byName.body.items.map((s: { rollNumber: string }) => s.rollNumber)).toEqual(['10C-07']);
    const byRoll = await as(world.admin).get('/api/admin/students?q=10c');
    expect(byRoll.body.total).toBe(1);
    const wildcard = await as(world.admin).get('/api/admin/students?q=%25');
    expect(wildcard.body.total).toBe(0);

    const bySection = await as(world.admin).get(`/api/admin/students?sectionId=${second.id}`);
    expect(bySection.body.items).toHaveLength(1);
    expect(bySection.body.items[0]).toMatchObject({ id: lone.id, sections: [{ id: second.id, name: second.name }] });

    expect((await as(world.admin).get('/api/admin/students?pageSize=1000')).status).toBe(400);
  });

  it('creates a student and enrolls them in a section', async () => {
    const res = await as(world.admin)
      .post('/api/admin/students')
      .send({ name: 'New Kid', rollNumber: '9A-01', sectionId: world.section.id });
    expect(res.status).toBe(201);
    expect(res.body.record).toMatchObject({ name: 'New Kid', rollNumber: '9A-01', sections: [{ id: world.section.id }] });
    expect(res.body.initialPassword).toBeTruthy();

    const login = await anon().post('/api/auth/student/login').send({ rollNumber: '9A-01', password: res.body.initialPassword });
    expect(login.status).toBe(200);
    expect(login.body.user.mustChangePassword).toBe(true);
  });

  it('rejects duplicate roll numbers (409) and foreign sections (400) without partial writes', async () => {
    const dup = await as(world.admin).post('/api/admin/students').send({ name: 'Dup', rollNumber: world.student.rollNumber });
    expect(dup.status).toBe(409);

    const other = await createInstitution();
    const foreignSection = await createSection(other.id);
    const bad = await as(world.admin).post('/api/admin/students').send({ name: 'X', rollNumber: 'NEW-1', sectionId: foreignSection.id });
    expect(bad.status).toBe(400);
    const rows = await db.select().from(users).where(eq(users.rollNumber, 'NEW-1'));
    expect(rows).toHaveLength(0);
  });

  it('allows the same roll number in another institution', async () => {
    const other = await createInstitution();
    await createUser(other.id, 'student', { rollNumber: 'SHARED-1' });
    const res = await as(world.admin).post('/api/admin/students').send({ name: 'Mine', rollNumber: 'SHARED-1' });
    expect(res.status).toBe(201);
  });

  it('imports students in bulk, skipping existing and duplicate rows', async () => {
    const res = await as(world.admin)
      .post('/api/admin/students/import')
      .send({
        sectionId: world.section.id,
        rows: [
          { name: 'Imp One', rollNumber: 'IMP-1' },
          { name: 'Imp Two', rollNumber: 'IMP-2', email: 'imp2@test.local' },
          { name: 'Imp Dup', rollNumber: 'IMP-1' },
          { name: 'Existing', rollNumber: world.student.rollNumber },
          { name: 'Email clash', rollNumber: 'IMP-3', email: world.teacher.email },
        ],
      });
    expect(res.status).toBe(200);
    expect(res.body.created.map((c: { rollNumber: string }) => c.rollNumber).sort()).toEqual(['IMP-1', 'IMP-2']);
    expect(res.body.created.every((c: { initialPassword: string }) => c.initialPassword.length > 0)).toBe(true);
    const invites = Object.fromEntries(res.body.created.map((c: { rollNumber: string; invite: string }) => [c.rollNumber, c.invite]));
    expect(invites).toEqual({ 'IMP-1': 'no_email', 'IMP-2': 'email_disabled' });
    expect(res.body.skipped.map((s: { rollNumber: string }) => s.rollNumber).sort()).toEqual(
      ['IMP-1', 'IMP-3', world.student.rollNumber].sort(),
    );
    const section = await as(world.admin).get(`/api/admin/sections/${world.section.id}/students`);
    expect(section.body).toHaveLength(4);
  });

  it('patches, resets password and deletes students', async () => {
    const studentClient = as(world.student);
    const patch = await as(world.admin).patch(`/api/admin/students/${world.student.id}`).send({ name: 'Renamed', email: 'r@test.local' });
    expect(patch.status).toBe(200);
    expect(patch.body).toMatchObject({ name: 'Renamed', email: 'r@test.local' });

    const dupEmail = await as(world.admin).patch(`/api/admin/students/${world.otherStudent.id}`).send({ email: 'r@test.local' });
    expect(dupEmail.status).toBe(409);

    const reset = await as(world.admin).post(`/api/admin/students/${world.student.id}/reset-password`);
    expect(reset.status).toBe(200);
    expect((await studentClient.get('/api/auth/me')).status).toBe(401);

    expect((await as(world.admin).delete(`/api/admin/students/${world.student.id}`)).status).toBe(204);
    expect((await as(world.admin).delete(`/api/admin/students/${world.student.id}`)).status).toBe(404);
  });

  it('isolates institutions', async () => {
    const other = await createInstitution();
    const foreign = await createUser(other.id, 'student');
    const list = await as(world.admin).get('/api/admin/students');
    expect(list.body.items.map((s: { id: string }) => s.id)).not.toContain(foreign.id);
    expect((await as(world.admin).patch(`/api/admin/students/${foreign.id}`).send({ name: 'X' })).status).toBe(404);
    expect((await as(world.admin).delete(`/api/admin/students/${foreign.id}`)).status).toBe(404);
    expect((await as(world.admin).post(`/api/admin/students/${foreign.id}/reset-password`)).status).toBe(404);
  });
});
