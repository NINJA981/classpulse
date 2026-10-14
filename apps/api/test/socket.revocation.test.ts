/**
 * Socket sessions stay revocable and bounded: disabled accounts, password resets, suspended
 * schools and maintenance drop connected sockets; live-quiz events are rate limited; a user keeps
 * a bounded number of sockets; live quizzes respect the platform's feature switch.
 */
import { createServer, type Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { eq, sql } from 'drizzle-orm';
import { io as connectClient, type Socket as ClientSocket } from 'socket.io-client';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_INSTITUTION_FEATURES, type Ack } from '@classiq/shared';
import { createApp } from '../src/app.js';
import { db } from '../src/db/client.js';
import { institutions, platformSettings, users } from '../src/db/schema/index.js';
import { invalidateInstitutionState, invalidatePlatformSettings } from '../src/lib/platformState.js';
import { attachSockets, revalidateSockets, type SocketHandle } from '../src/sockets/index.js';
import { MAX_SOCKETS_PER_USER } from '../src/sockets/rateLimit.js';
import { as, createWorld, sessionCookie } from './helpers.js';

type User = { id: string; tokenVersion: number; role: 'admin' | 'teacher' | 'student' };

let server: HttpServer;
let handle: SocketHandle;
let url: string;
const open: ClientSocket[] = [];

beforeAll(async () => {
  server = createServer(createApp());
  handle = attachSockets(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterEach(() => {
  for (const s of open.splice(0)) s.disconnect();
});

afterAll(async () => {
  await handle.close();
});

function connect(user: User): Promise<ClientSocket> {
  const socket = connectClient(url, {
    transports: ['websocket'],
    forceNew: true,
    reconnection: false,
    extraHeaders: { Cookie: sessionCookie(user) },
  });
  open.push(socket);
  return new Promise((resolve, reject) => {
    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', reject);
  });
}

const disconnected = (socket: ClientSocket, timeoutMs = 5000) =>
  new Promise<string>((resolve, reject) => {
    if (!socket.connected) return resolve('already');
    const timer = setTimeout(() => reject(new Error('socket was not disconnected')), timeoutMs);
    socket.once('disconnect', (reason) => {
      clearTimeout(timer);
      resolve(reason);
    });
  });

describe('socket revocation', () => {
  it('drops the sockets of a student the admin disables', async () => {
    const w = await createWorld();
    const socket = await connect(w.student);
    const gone = disconnected(socket);
    expect((await as(w.admin).patch(`/api/admin/students/${w.student.id}`).send({ status: 'disabled' })).status).toBe(200);
    expect(await gone).toBe('io server disconnect');
  });

  it('drops the sockets of a teacher whose password the admin resets', async () => {
    const w = await createWorld();
    const socket = await connect(w.teacher);
    const gone = disconnected(socket);
    expect((await as(w.admin).post(`/api/admin/teachers/${w.teacher.id}/reset-password`)).status).toBe(200);
    expect(await gone).toBe('io server disconnect');
  });

  it('drops every socket of a school as soon as it is suspended', async () => {
    const w = await createWorld();
    const s1 = await connect(w.student);
    const s2 = await connect(w.teacher);
    const both = Promise.all([disconnected(s1), disconnected(s2)]);
    await db.update(institutions).set({ status: 'suspended' }).where(eq(institutions.id, w.institution.id));
    invalidateInstitutionState(w.institution.id);
    await both;
  });

  it('drops sockets when maintenance blocks sign-ins', async () => {
    const w = await createWorld();
    const socket = await connect(w.student);
    const gone = disconnected(socket);
    const value = { enabled: true, message: '', blockLogins: true };
    await db.insert(platformSettings).values({ key: 'maintenance', value }).onConflictDoUpdate({ target: platformSettings.key, set: { value } });
    invalidatePlatformSettings();
    try {
      await gone;
    } finally {
      await db.delete(platformSettings).where(eq(platformSettings.key, 'maintenance'));
      invalidatePlatformSettings();
    }
  });

  it('periodic re-validation drops sockets whose token version changed elsewhere and keeps valid ones', async () => {
    const w = await createWorld();
    const revoked = await connect(w.student);
    const valid = await connect(w.otherStudent);
    // e.g. a password change in another process: no fast-path disconnect here.
    await db.update(users).set({ tokenVersion: sql`${users.tokenVersion} + 1` }).where(eq(users.id, w.student.id));
    const gone = disconnected(revoked);
    expect(await revalidateSockets(handle.io.of('/').sockets.values())).toBe(1);
    await gone;
    expect(valid.connected).toBe(true);
  });
});

describe('socket limits', () => {
  it(`keeps at most ${MAX_SOCKETS_PER_USER} sockets per user, dropping the oldest`, async () => {
    const w = await createWorld();
    const first = await connect(w.student);
    const gone = disconnected(first);
    const rest: ClientSocket[] = [];
    for (let i = 0; i < MAX_SOCKETS_PER_USER; i++) rest.push(await connect(w.student));
    await gone;
    expect(rest.every((s) => s.connected)).toBe(true);
  });

  it('rate limits events and disconnects a socket that keeps flooding', async () => {
    const w = await createWorld();
    const socket = await connect(w.student);
    const gone = disconnected(socket);
    const limited: Ack<unknown>[] = [];
    for (let i = 0; i < 40; i++) {
      socket.emit('player:answer', { questionId: '00000000-0000-4000-8000-000000000000', optionIndex: 0 }, (res: Ack<unknown>) => {
        if (!res.ok && res.error.code === 'RATE_LIMITED') limited.push(res);
      });
    }
    expect(await gone).toBe('io server disconnect');
    expect(limited.length).toBeGreaterThan(0);
  });

  it('answers RATE_LIMITED to a short burst without disconnecting', async () => {
    const w = await createWorld();
    const socket = await connect(w.student);
    const replies = await Promise.all(
      Array.from(
        { length: 15 },
        () =>
          new Promise<Ack<unknown>>((resolve) => {
            socket.emit('player:join', { pin: '123456' }, resolve);
          }),
      ),
    );
    const limited = replies.filter((r) => !r.ok && r.error.code === 'RATE_LIMITED');
    expect(limited.length).toBeGreaterThanOrEqual(4);
    expect(limited.length).toBeLessThanOrEqual(5);
    expect(socket.connected).toBe(true);
  });
});

describe('live quiz feature switch', () => {
  it('refuses to join a live quiz when the school has live quizzes switched off', async () => {
    const w = await createWorld();
    const socket = await connect(w.student);
    await db
      .update(institutions)
      .set({ features: { ...DEFAULT_INSTITUTION_FEATURES, liveQuiz: false } })
      .where(eq(institutions.id, w.institution.id));
    invalidateInstitutionState(w.institution.id);
    const res = await new Promise<Ack<unknown>>((resolve) => socket.emit('player:join', { pin: '123456' }, resolve));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('FEATURE_DISABLED');
  });
});
