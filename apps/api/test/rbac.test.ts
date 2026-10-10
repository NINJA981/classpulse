import { beforeEach, describe, expect, it } from 'vitest';
import type { Role } from '@classpulse/shared';
import { anon, as, createWorld } from './helpers.js';

type Method = 'get' | 'post' | 'put' | 'patch' | 'delete';
const ID = '00000000-0000-4000-8000-000000000000';

const ROUTES: { method: Method; path: string; role: Role }[] = [
  // Admin console
  { method: 'get', path: '/api/admin/institution', role: 'admin' },
  { method: 'put', path: '/api/admin/institution', role: 'admin' },
  { method: 'get', path: '/api/admin/overview', role: 'admin' },
  { method: 'get', path: '/api/admin/rooms', role: 'admin' },
  { method: 'post', path: '/api/admin/rooms', role: 'admin' },
  { method: 'patch', path: `/api/admin/rooms/${ID}`, role: 'admin' },
  { method: 'delete', path: `/api/admin/rooms/${ID}`, role: 'admin' },
  { method: 'get', path: '/api/admin/teachers', role: 'admin' },
  { method: 'post', path: '/api/admin/teachers', role: 'admin' },
  { method: 'patch', path: `/api/admin/teachers/${ID}`, role: 'admin' },
  { method: 'delete', path: `/api/admin/teachers/${ID}`, role: 'admin' },
  { method: 'post', path: `/api/admin/teachers/${ID}/reset-password`, role: 'admin' },
  { method: 'get', path: '/api/admin/students', role: 'admin' },
  { method: 'post', path: '/api/admin/students', role: 'admin' },
  { method: 'post', path: '/api/admin/students/import', role: 'admin' },
  { method: 'patch', path: `/api/admin/students/${ID}`, role: 'admin' },
  { method: 'delete', path: `/api/admin/students/${ID}`, role: 'admin' },
  { method: 'post', path: `/api/admin/students/${ID}/reset-password`, role: 'admin' },
  { method: 'get', path: '/api/admin/sections', role: 'admin' },
  { method: 'post', path: '/api/admin/sections', role: 'admin' },
  { method: 'patch', path: `/api/admin/sections/${ID}`, role: 'admin' },
  { method: 'delete', path: `/api/admin/sections/${ID}`, role: 'admin' },
  { method: 'post', path: `/api/admin/sections/${ID}/rotate-code`, role: 'admin' },
  { method: 'get', path: `/api/admin/sections/${ID}/students`, role: 'admin' },
  { method: 'put', path: `/api/admin/sections/${ID}/students`, role: 'admin' },
  { method: 'get', path: '/api/admin/timetable', role: 'admin' },
  { method: 'put', path: `/api/admin/timetable/${ID}`, role: 'admin' },
  { method: 'get', path: '/api/admin/settings/models', role: 'admin' },
  { method: 'patch', path: '/api/admin/settings/models', role: 'admin' },
  // Teacher studio
  { method: 'get', path: '/api/teacher/dashboard', role: 'teacher' },
  { method: 'get', path: '/api/teacher/sections', role: 'teacher' },
  { method: 'get', path: '/api/teacher/timetable', role: 'teacher' },
  // Student portal
  { method: 'get', path: '/api/student/dashboard', role: 'student' },
  { method: 'patch', path: '/api/student/profile', role: 'student' },
  { method: 'get', path: '/api/student/sections', role: 'student' },
  { method: 'get', path: '/api/student/sections/preview/ABC234', role: 'student' },
  { method: 'post', path: '/api/student/enrollments', role: 'student' },
  { method: 'get', path: '/api/student/quizzes', role: 'student' },
  { method: 'get', path: `/api/student/quizzes/${ID}`, role: 'student' },
  { method: 'post', path: `/api/student/quizzes/${ID}/attempts`, role: 'student' },
  { method: 'get', path: `/api/student/quizzes/${ID}/attempts/latest`, role: 'student' },
  { method: 'get', path: '/api/student/assignments', role: 'student' },
  { method: 'post', path: `/api/student/assignments/${ID}/submission`, role: 'student' },
  { method: 'get', path: '/api/student/guardians', role: 'student' },
  { method: 'post', path: '/api/student/guardians', role: 'student' },
  { method: 'delete', path: `/api/student/guardians/${ID}`, role: 'student' },
];

describe('RBAC matrix', () => {
  let world: Awaited<ReturnType<typeof createWorld>>;
  beforeEach(async () => {
    world = await createWorld();
  });

  it.each(ROUTES)('$method $path requires $role', async ({ method, path, role }) => {
    const unauth = await anon()[method](path).send({});
    expect(unauth.status).toBe(401);
    expect(unauth.body.error.code).toBe('UNAUTHENTICATED');

    const byRole = { admin: world.admin, teacher: world.teacher, student: world.student };
    for (const other of (['admin', 'teacher', 'student'] as const).filter((r) => r !== role)) {
      const res = await as(byRole[other])[method](path).send({});
      expect(res.status, `${other} should be forbidden`).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    }
  });

  it('rejects a forged or garbage token', async () => {
    const res = await anon().get('/api/admin/overview').set('Authorization', 'Bearer not-a-jwt');
    expect(res.status).toBe(401);
  });
});
