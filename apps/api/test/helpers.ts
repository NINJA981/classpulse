/**
 * Shared integration-test helpers: database reset, fixture factories and
 * authenticated supertest agents.
 */
import { sql } from 'drizzle-orm';
import request from 'supertest';
import type { Express } from 'express';
import { SESSION_COOKIE, type Role } from '@classpulse/shared';
import { createApp } from '../src/app.js';
import { db } from '../src/db/client.js';
import { enrollments, institutions, rooms, sections, sectionTeachers, users } from '../src/db/schema/index.js';
import { generateJoinCode, hashPassword } from '../src/lib/crypto.js';
import { signSessionToken } from '../src/lib/session.js';

let app: Express | null = null;
export function testApp(): Express {
  app ??= createApp();
  return app;
}

export async function resetDatabase(): Promise<void> {
  const rows = await db.execute<{ tablename: string }>(
    sql`select tablename from pg_tables where schemaname = 'public' and tablename <> '__drizzle_migrations'`,
  );
  const names = rows.rows.map((r) => `"${r.tablename}"`).join(', ');
  if (names) await db.execute(sql.raw(`truncate ${names} restart identity cascade`));
}

export const TEST_PASSWORD = 'Passw0rd!123';
let passwordHashCache: string | null = null;
const testPasswordHash = async () => (passwordHashCache ??= await hashPassword(TEST_PASSWORD));

export async function createInstitution(overrides: Partial<typeof institutions.$inferInsert> = {}) {
  const [row] = await db
    .insert(institutions)
    .values({ name: 'Test Academy', code: `T${Math.floor(Math.random() * 1e6)}`, ...overrides })
    .returning();
  return row!;
}

export async function createUser(
  institutionId: string,
  role: Role,
  overrides: Partial<typeof users.$inferInsert> = {},
) {
  const n = Math.floor(Math.random() * 1e9);
  const [row] = await db
    .insert(users)
    .values({
      institutionId,
      role,
      name: `${role} ${n}`,
      email: role === 'student' ? null : `${role}${n}@test.local`,
      rollNumber: role === 'student' ? `R${n}` : null,
      passwordHash: await testPasswordHash(),
      ...overrides,
    })
    .returning();
  return row!;
}

export async function createRoom(institutionId: string, name = `Room ${Math.floor(Math.random() * 1e6)}`) {
  const [row] = await db.insert(rooms).values({ institutionId, name }).returning();
  return row!;
}

export async function createSection(
  institutionId: string,
  opts: { teacherIds?: string[]; studentIds?: string[]; roomId?: string; name?: string } = {},
) {
  const [row] = await db
    .insert(sections)
    .values({
      institutionId,
      name: opts.name ?? `Section ${Math.floor(Math.random() * 1e6)}`,
      subject: 'Science',
      roomId: opts.roomId ?? null,
      joinCode: generateJoinCode(),
      joinCodeExpiresAt: new Date(Date.now() + 30 * 86400_000),
    })
    .returning();
  for (const teacherId of opts.teacherIds ?? []) await db.insert(sectionTeachers).values({ sectionId: row!.id, teacherId });
  for (const studentId of opts.studentIds ?? []) await db.insert(enrollments).values({ sectionId: row!.id, studentId });
  return row!;
}

/** A basic world: institution + admin + teacher + 2 students in one section with a room. */
export async function createWorld() {
  const institution = await createInstitution();
  const admin = await createUser(institution.id, 'admin');
  const teacher = await createUser(institution.id, 'teacher');
  const otherTeacher = await createUser(institution.id, 'teacher');
  const student = await createUser(institution.id, 'student');
  const otherStudent = await createUser(institution.id, 'student');
  const room = await createRoom(institution.id);
  const section = await createSection(institution.id, {
    teacherIds: [teacher.id],
    studentIds: [student.id, otherStudent.id],
    roomId: room.id,
  });
  return { institution, admin, teacher, otherTeacher, student, otherStudent, room, section };
}

export function sessionCookie(user: { id: string; tokenVersion: number; role: Role }): string {
  return `${SESSION_COOKIE}=${signSessionToken(user)}`;
}

/** supertest helpers bound to a user's session cookie. */
export function as(user: { id: string; tokenVersion: number; role: Role }) {
  const cookie = sessionCookie(user);
  const a = testApp();
  return {
    get: (url: string) => request(a).get(url).set('Cookie', cookie),
    post: (url: string) => request(a).post(url).set('Cookie', cookie),
    put: (url: string) => request(a).put(url).set('Cookie', cookie),
    patch: (url: string) => request(a).patch(url).set('Cookie', cookie),
    delete: (url: string) => request(a).delete(url).set('Cookie', cookie),
  };
}

export const anon = () => request(testApp());
