/**
 * Request-level protections: no CORS grants, the same-origin (CSRF) guard, body content types,
 * sign-in rate-limit keys and the proxy client-IP check. Production-only origin rules are in
 * origins.prod.test.ts.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { isPrivateIp } from '../src/lib/clientIp.js';
import { isOwnOrigin } from '../src/lib/origins.js';
import { platformAccountKey, staffAccountKey, studentAccountKey } from '../src/middleware/rateLimit.js';
import { anon, as, createWorld, TEST_PASSWORD } from './helpers.js';

const OWN = 'http://localhost:3000'; // PUBLIC_ORIGIN in the test config
const EVIL = 'https://evil.example';

describe('CORS', () => {
  it('grants no cross-origin access, not even to our own origin', async () => {
    for (const origin of [EVIL, OWN]) {
      const res = await anon().get('/api/status').set('Origin', origin);
      expect(res.status).toBe(200);
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
      expect(res.headers['access-control-allow-credentials']).toBeUndefined();
    }
    const preflight = await anon().options('/api/auth/login').set('Origin', EVIL).set('Access-Control-Request-Method', 'POST');
    expect(preflight.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('same-origin guard', () => {
  let world: Awaited<ReturnType<typeof createWorld>>;
  beforeEach(async () => {
    world = await createWorld();
  });

  const blocked = (res: { status: number; body: { error?: { code: string; message: string } } }) => {
    expect(res.status).toBe(403);
    expect(res.body.error).toEqual({ code: 'FORBIDDEN', message: 'Cross-site request blocked' });
  };

  it('blocks state-changing requests from another origin, with or without a session', async () => {
    blocked(await as(world.admin).post('/api/admin/rooms').set('Origin', EVIL).send({ name: 'Lab' }));
    blocked(await as(world.admin).delete(`/api/admin/rooms/${world.room.id}`).set('Origin', EVIL));
    blocked(await as(world.admin).post('/api/auth/logout').set('Origin', 'null'));
    blocked(await anon().post('/api/auth/teacher/login').set('Origin', EVIL).send({ email: world.teacher.email, password: TEST_PASSWORD }));
  });

  it('blocks cross-site requests without an Origin by Sec-Fetch-Site', async () => {
    blocked(await as(world.admin).post('/api/auth/logout').set('Sec-Fetch-Site', 'cross-site'));
    blocked(await as(world.admin).post('/api/auth/logout').set('Sec-Fetch-Site', 'same-site'));
    expect((await as(world.admin).post('/api/auth/logout').set('Sec-Fetch-Site', 'same-origin')).status).toBe(204);
    expect((await as(world.admin).post('/api/auth/logout').set('Sec-Fetch-Site', 'none')).status).toBe(204);
  });

  it('allows our own origin, and non-browser clients that send neither header', async () => {
    const own = await as(world.admin).post('/api/admin/rooms').set('Origin', OWN).set('Sec-Fetch-Site', 'same-origin').send({ name: 'Lab A' });
    expect(own.status).toBe(201);
    const script = await as(world.admin).post('/api/admin/rooms').send({ name: 'Lab B' });
    expect(script.status).toBe(201);
    // Safe methods are never blocked.
    expect((await as(world.admin).get('/api/admin/rooms').set('Origin', EVIL)).status).toBe(200);
  });

  it('refuses form-encodable bodies (text/plain, urlencoded) and accepts JSON', async () => {
    const text = await as(world.admin).post('/api/admin/rooms').set('Content-Type', 'text/plain').send('{"name":"Lab"}');
    expect(text.status).toBe(415);
    expect(text.body.error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
    const form = await as(world.admin).post('/api/admin/rooms').type('form').send({ name: 'Lab' });
    expect(form.status).toBe(415);
    const json = await as(world.admin).post('/api/admin/rooms').set('Content-Type', 'application/json; charset=utf-8').send('{"name":"Lab C"}');
    expect(json.status).toBe(201);
  });

  it('leaves classroom device routes alone (device key auth, raw audio bodies)', async () => {
    const res = await anon()
      .post('/api/devices/me/heartbeat')
      .set('Origin', EVIL)
      .set('Content-Type', 'application/octet-stream')
      .send(Buffer.from('x'));
    expect(res.status).not.toBe(403);
    expect(res.status).not.toBe(415);
    // The admin device pages are browser routes and are guarded.
    blocked(await as(world.admin).post('/api/admin/devices').set('Origin', EVIL).send({}));
  });
});

describe('isOwnOrigin (development)', () => {
  it('accepts configured origins and true same-origin requests, nothing else', () => {
    expect(isOwnOrigin(OWN, ['localhost:5000'])).toBe(true); // behind the Next.js dev rewrite
    expect(isOwnOrigin('http://127.0.0.1:3000', ['127.0.0.1:3000'])).toBe(true);
    expect(isOwnOrigin(EVIL, ['localhost:3000'])).toBe(false);
    expect(isOwnOrigin('null', ['localhost:3000'])).toBe(false);
    expect(isOwnOrigin('not a url', ['localhost:3000'])).toBe(false);
  });
});

describe('sign-in rate-limit keys', () => {
  it('come only from the normalised identifier; extra fields never create a new bucket', () => {
    const base = staffAccountKey({ email: 'Teacher@School.in', password: 'x' });
    expect(base).toBe('staff:teacher@school.in');
    expect(staffAccountKey({ email: 'TEACHER@school.IN', password: 'y' })).toBe(base);
    // Padded emails fail validation: one shared "invalid" bucket, never a fresh one.
    expect(staffAccountKey({ email: '  teacher@school.in ', password: 'y' })).toBe('invalid');
    expect(staffAccountKey({ email: 'teacher@school.in', password: 'x', rollNumber: '1' })).toBe('invalid');
    expect(staffAccountKey({ email: 'teacher@school.in', password: 'x', nonce: Math.random() })).toBe('invalid');
    expect(staffAccountKey(undefined)).toBe('invalid');
  });

  it('students: school code + trimmed roll number', () => {
    const plain = studentAccountKey({ rollNumber: '1023', password: 'x' });
    expect(plain).toBe('student::1023');
    expect(studentAccountKey({ rollNumber: ' 1023  ', password: 'y' })).toBe(plain);
    expect(studentAccountKey({ rollNumber: '1023', password: 'x', email: 'random@x.in' })).toBe('invalid');
    expect(studentAccountKey({ rollNumber: '1023', password: 'x', institutionCode: ' abc1 ' })).toBe('student:abc1:1023');
  });

  it('platform: normalised email; extra fields are invalid', () => {
    expect(platformAccountKey({ email: 'Owner@Ops.in', password: 'x' })).toBe('platform:owner@ops.in');
    expect(platformAccountKey({ email: 'owner@ops.in', password: 'x', email2: 'z' })).toBe('invalid');
  });
});

describe('client IP check', () => {
  it('recognises private, loopback and mapped addresses', () => {
    for (const ip of ['10.0.5.2', '172.20.1.1', '192.168.1.9', '127.0.0.1', '::1', '::ffff:10.0.5.2', 'fd00::1', '100.64.3.4']) {
      expect(isPrivateIp(ip)).toBe(true);
    }
    for (const ip of ['49.37.1.10', '8.8.8.8', '2001:4860::8888', '::ffff:49.37.1.10', undefined, 'garbage']) {
      expect(isPrivateIp(ip)).toBe(false);
    }
  });
});
