/** /api/notifications and /api/platform/notifications: listing, read state, prefs, push subscriptions, isolation. */
import cookieParser from 'cookie-parser';
import { eq } from 'drizzle-orm';
import express from 'express';
import request from 'supertest';
import webpush from 'web-push';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MAX_PUSH_SUBSCRIPTIONS, type NotificationDto } from '@classiq/shared';
import { env } from '../src/config/env.js';
import { db } from '../src/db/client.js';
import { institutions, notifications, platformAdmins, pushSubscriptions, users } from '../src/db/schema/index.js';
import { sha256Hex } from '../src/lib/crypto.js';
import { errorHandler } from '../src/middleware/errorHandler.js';
import { notificationTestRouter } from '../src/modules/testing/routes.js';
import { anon, as, createWorld, sessionCookie } from './helpers.js';
import { asPlatform, createPlatformAdmin } from './platform.helpers.js';

type World = Awaited<ReturnType<typeof createWorld>>;
type UserRow = World['teacher'];

const SCHOOL = '/api/notifications';
const PLATFORM = '/api/platform/notifications';
const MISSING = '00000000-0000-4000-8000-000000000000';
const keys = { p256dh: 'B'.repeat(87), auth: 'A'.repeat(22) };
const fcm = (n: number | string) => `https://fcm.googleapis.com/fcm/send/device-${n}`;

/** Insert `n` notifications for a user, 1 s apart, newest last (title "n<i>"). */
async function seed(user: UserRow, n: number, opts: { read?: boolean; start?: number } = {}) {
  const start = opts.start ?? Date.now() - 3600_000;
  await db.insert(notifications).values(
    Array.from({ length: n }, (_, i) => ({
      userId: user.id,
      institutionId: user.institutionId,
      kind: 'lesson.ready' as const,
      tone: 'success' as const,
      title: `n${i}`,
      createdAt: new Date(start + i * 1000),
      readAt: opts.read ? new Date() : null,
    })),
  );
}

async function seedPlatform(adminId: string, title = 'Deploy finished.') {
  const [row] = await db
    .insert(notifications)
    .values({ platformAdminId: adminId, kind: 'deploy.succeeded', tone: 'success', title })
    .returning();
  return row!;
}

let w: World;
beforeEach(async () => {
  w = await createWorld();
  env.VAPID_PUBLIC_KEY = '';
  env.VAPID_PRIVATE_KEY = '';
});
afterEach(() => {
  env.VAPID_PUBLIC_KEY = '';
  env.VAPID_PRIVATE_KEY = '';
});

describe('GET /api/notifications', () => {
  it('requires a session (401) and works for every role', async () => {
    expect((await anon().get(SCHOOL)).status).toBe(401);
    for (const user of [w.admin, w.teacher, w.student]) {
      const res = await as(user).get(SCHOOL);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ items: [], unreadCount: 0, nextBefore: null });
    }
  });

  it('lists newest first with a `before` cursor, unreadOnly and unreadCount', async () => {
    await seed(w.teacher, 5);
    await seed(w.teacher, 2, { read: true, start: Date.now() - 7200_000 });

    const page1 = await as(w.teacher).get(`${SCHOOL}?limit=3`);
    expect(page1.status).toBe(200);
    expect(page1.body.items.map((n: NotificationDto) => n.title)).toEqual(['n4', 'n3', 'n2']);
    expect(page1.body.unreadCount).toBe(5);
    expect(page1.body.nextBefore).toBe(page1.body.items[2].createdAt);

    const page2 = await as(w.teacher).get(`${SCHOOL}?limit=3&before=${encodeURIComponent(page1.body.nextBefore)}`);
    expect(page2.body.items.map((n: NotificationDto) => n.title)).toEqual(['n1', 'n0', 'n1']);
    const page3 = await as(w.teacher).get(`${SCHOOL}?limit=3&before=${encodeURIComponent(page2.body.nextBefore)}`);
    expect(page3.body.items.map((n: NotificationDto) => n.title)).toEqual(['n0']);
    expect(page3.body.nextBefore).toBeNull();

    const unread = await as(w.teacher).get(`${SCHOOL}?unreadOnly=true&limit=50`);
    expect(unread.body.items).toHaveLength(5);
    expect(unread.body.items.every((n: NotificationDto) => n.readAt === null)).toBe(true);
    const all = await as(w.teacher).get(`${SCHOOL}?unreadOnly=false&limit=50`);
    expect(all.body.items).toHaveLength(7);
  });

  it('validates the query (limit ≤ 50, ISO cursor)', async () => {
    expect((await as(w.teacher).get(`${SCHOOL}?limit=51`)).status).toBe(400);
    expect((await as(w.teacher).get(`${SCHOOL}?limit=0`)).status).toBe(400);
    expect((await as(w.teacher).get(`${SCHOOL}?before=yesterday`)).status).toBe(400);
  });

  it("never shows another person's or another school's notifications", async () => {
    const other = await createWorld();
    await seed(w.otherTeacher, 2);
    await seed(other.teacher, 2);
    const admin = await createPlatformAdmin();
    await seedPlatform(admin.id);
    const res = await as(w.teacher).get(SCHOOL);
    expect(res.body).toEqual({ items: [], unreadCount: 0, nextBefore: null });
  });
});

describe('marking read', () => {
  it('marks one notification read (idempotent) and all of them', async () => {
    await seed(w.teacher, 3);
    const list = await as(w.teacher).get(SCHOOL);
    const id = list.body.items[0].id as string;

    const first = await as(w.teacher).post(`${SCHOOL}/${id}/read`);
    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({ id, readAt: expect.any(String) });
    const again = await as(w.teacher).post(`${SCHOOL}/${id}/read`);
    expect(again.body.readAt).toBe(first.body.readAt);
    expect((await as(w.teacher).get(SCHOOL)).body.unreadCount).toBe(2);

    const all = await as(w.teacher).post(`${SCHOOL}/read-all`);
    expect(all.status).toBe(200);
    expect(all.body).toEqual({ updated: 2 });
    expect((await as(w.teacher).get(SCHOOL)).body.unreadCount).toBe(0);
    expect((await as(w.teacher).post(`${SCHOOL}/read-all`)).body).toEqual({ updated: 0 });
  });

  it("user A can neither read nor mark user B's notifications (same or other school)", async () => {
    const other = await createWorld();
    await seed(w.otherTeacher, 1);
    await seed(other.teacher, 1);
    const [mineB] = await db.select().from(notifications).where(eq(notifications.userId, w.otherTeacher.id));
    const [otherSchool] = await db.select().from(notifications).where(eq(notifications.userId, other.teacher.id));

    for (const target of [mineB!, otherSchool!]) {
      const res = await as(w.teacher).post(`${SCHOOL}/${target.id}/read`);
      expect(res.status).toBe(404);
    }
    expect((await as(w.teacher).post(`${SCHOOL}/read-all`)).body).toEqual({ updated: 0 });
    const rows = await db.select({ readAt: notifications.readAt }).from(notifications);
    expect(rows.every((r) => r.readAt === null)).toBe(true);
    expect((await as(w.otherTeacher).get(SCHOOL)).body.unreadCount).toBe(1);
  });

  it('404 for an unknown id, 400 for a malformed one, 401 without a session', async () => {
    expect((await as(w.teacher).post(`${SCHOOL}/${MISSING}/read`)).status).toBe(404);
    expect((await as(w.teacher).post(`${SCHOOL}/not-an-id/read`)).status).toBe(400);
    expect((await anon().post(`${SCHOOL}/${MISSING}/read`)).status).toBe(401);
    expect((await anon().post(`${SCHOOL}/read-all`)).status).toBe(401);
  });
});

describe('prefs', () => {
  it('defaults to push on and saves a strict body', async () => {
    expect((await as(w.teacher).get(`${SCHOOL}/prefs`)).body).toEqual({ push: true });
    const put = await as(w.teacher).put(`${SCHOOL}/prefs`).send({ push: false });
    expect(put.status).toBe(200);
    expect(put.body).toEqual({ push: false });
    expect((await as(w.teacher).get(`${SCHOOL}/prefs`)).body).toEqual({ push: false });
    // Only the signed-in user's prefs change.
    expect((await as(w.otherTeacher).get(`${SCHOOL}/prefs`)).body).toEqual({ push: true });
    const [row] = await db.select({ prefs: users.notificationPrefs }).from(users).where(eq(users.id, w.teacher.id));
    expect(row!.prefs).toEqual({ push: false });
  });

  it('rejects unknown fields and wrong types (400) and requires a session', async () => {
    expect((await as(w.teacher).put(`${SCHOOL}/prefs`).send({ push: false, email: true })).status).toBe(400);
    expect((await as(w.teacher).put(`${SCHOOL}/prefs`).send({ push: 'no' })).status).toBe(400);
    expect((await as(w.teacher).put(`${SCHOOL}/prefs`).send({})).status).toBe(400);
    expect((await anon().put(`${SCHOOL}/prefs`).send({ push: false })).status).toBe(401);
    expect((await anon().get(`${SCHOOL}/prefs`)).status).toBe(401);
  });
});

describe('push key and subscriptions', () => {
  it('push-key is null until VAPID keys are configured', async () => {
    expect((await as(w.student).get(`${SCHOOL}/push-key`)).body).toEqual({ publicKey: null });
    const pair = webpush.generateVAPIDKeys();
    env.VAPID_PUBLIC_KEY = pair.publicKey;
    env.VAPID_PRIVATE_KEY = pair.privateKey;
    expect((await as(w.student).get(`${SCHOOL}/push-key`)).body).toEqual({ publicKey: pair.publicKey });
    env.VAPID_PRIVATE_KEY = '';
    expect((await as(w.student).get(`${SCHOOL}/push-key`)).body).toEqual({ publicKey: null });
  });

  it('saves a subscription (hash-keyed) and re-subscribing updates it in place', async () => {
    const res = await as(w.teacher).post(`${SCHOOL}/push-subscriptions`).set('User-Agent', 'TestBrowser/1.0').send({ endpoint: fcm(1), expirationTime: null, keys });
    expect(res.status).toBe(204);
    const [row] = await db.select().from(pushSubscriptions);
    expect(row).toMatchObject({
      userId: w.teacher.id,
      institutionId: w.institution.id,
      platformAdminId: null,
      endpoint: fcm(1),
      endpointHash: sha256Hex(fcm(1)),
      userAgent: 'TestBrowser/1.0',
    });
    await as(w.teacher).post(`${SCHOOL}/push-subscriptions`).send({ endpoint: fcm(1), keys: { ...keys, auth: 'C'.repeat(22) } });
    const rows = await db.select().from(pushSubscriptions);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.auth).toBe('C'.repeat(22));
  });

  it('accepts the allow-listed push services', async () => {
    for (const endpoint of [
      fcm('a'),
      'https://updates.push.services.mozilla.com/wpush/v2/abc',
      'https://wns2-par02p.notify.windows.com/w/?token=abc',
      'https://web.push.apple.com/QGx1',
    ]) {
      expect((await as(w.teacher).post(`${SCHOOL}/push-subscriptions`).send({ endpoint, keys })).status).toBe(204);
    }
    expect(await db.$count(pushSubscriptions)).toBe(4);
  });

  it('refuses endpoints outside the push-service allow-list (SSRF guard) with 400', async () => {
    for (const endpoint of [
      'http://10.0.0.112:8000',
      'http://10.0.0.112:8000/push',
      'https://10.0.0.112/push',
      'https://evil.example.com/push',
      'https://fcm.googleapis.com.evil.example/push',
      'https://push.services.mozilla.com/x', // bare domain: only subdomains are push endpoints
      'http://fcm.googleapis.com/fcm/send/x',
      'https://fcm.googleapis.com:8443/fcm/send/x',
      'https://user:pass@fcm.googleapis.com/fcm/send/x',
      `https://fcm.googleapis.com/fcm/send/${'x'.repeat(500)}`,
      'not a url',
    ]) {
      const res = await as(w.teacher).post(`${SCHOOL}/push-subscriptions`).send({ endpoint, keys });
      expect(res.status, endpoint).toBe(400);
    }
    expect(await db.$count(pushSubscriptions)).toBe(0);
  });

  it('validates the body strictly (extra fields, oversized keys) and requires a session', async () => {
    const post = (body: unknown) => as(w.teacher).post(`${SCHOOL}/push-subscriptions`).send(body as object);
    expect((await post({ endpoint: fcm(1), keys, extra: 1 })).status).toBe(400);
    expect((await post({ endpoint: fcm(1), keys: { ...keys, extra: 'x' } })).status).toBe(400);
    expect((await post({ endpoint: fcm(1), keys: { ...keys, p256dh: 'B'.repeat(129) } })).status).toBe(400);
    expect((await post({ endpoint: fcm(1), keys: { ...keys, auth: 'A'.repeat(65) } })).status).toBe(400);
    expect((await post({ endpoint: fcm(1) })).status).toBe(400);
    expect((await anon().post(`${SCHOOL}/push-subscriptions`).send({ endpoint: fcm(1), keys })).status).toBe(401);
    expect((await anon().delete(`${SCHOOL}/push-subscriptions`).send({ endpoint: fcm(1) })).status).toBe(401);
  });

  it('moves an endpoint already owned by another account to the caller (never duplicated)', async () => {
    await as(w.otherTeacher).post(`${SCHOOL}/push-subscriptions`).send({ endpoint: fcm(1), keys });
    await as(w.teacher).post(`${SCHOOL}/push-subscriptions`).send({ endpoint: fcm(1), keys });
    const rows = await db.select().from(pushSubscriptions);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.userId).toBe(w.teacher.id);
  });

  it(`keeps at most ${MAX_PUSH_SUBSCRIPTIONS} subscriptions per account, dropping the oldest`, async () => {
    for (let i = 0; i < MAX_PUSH_SUBSCRIPTIONS + 2; i++) {
      expect((await as(w.teacher).post(`${SCHOOL}/push-subscriptions`).send({ endpoint: fcm(i), keys })).status).toBe(204);
    }
    await as(w.otherTeacher).post(`${SCHOOL}/push-subscriptions`).send({ endpoint: fcm('other'), keys });
    const mine = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, w.teacher.id));
    expect(mine).toHaveLength(MAX_PUSH_SUBSCRIPTIONS);
    expect(mine.map((r) => r.endpoint)).not.toContain(fcm(0));
    expect(mine.map((r) => r.endpoint)).not.toContain(fcm(1));
    expect(mine.map((r) => r.endpoint)).toContain(fcm(MAX_PUSH_SUBSCRIPTIONS + 1));
    expect(await db.$count(pushSubscriptions, eq(pushSubscriptions.userId, w.otherTeacher.id))).toBe(1);
  });

  it("unsubscribes only the caller's own subscription", async () => {
    await as(w.teacher).post(`${SCHOOL}/push-subscriptions`).send({ endpoint: fcm(1), keys });
    await as(w.otherTeacher).post(`${SCHOOL}/push-subscriptions`).send({ endpoint: fcm(2), keys });

    // Someone else's endpoint: no-op (still 204, nothing revealed).
    expect((await as(w.teacher).delete(`${SCHOOL}/push-subscriptions`).send({ endpoint: fcm(2) })).status).toBe(204);
    expect(await db.$count(pushSubscriptions)).toBe(2);
    expect((await as(w.teacher).delete(`${SCHOOL}/push-subscriptions`).send({ endpoint: fcm(1) })).status).toBe(204);
    const left = await db.select().from(pushSubscriptions);
    expect(left.map((r) => r.userId)).toEqual([w.otherTeacher.id]);
    expect((await as(w.teacher).delete(`${SCHOOL}/push-subscriptions`).send({ endpoint: fcm(1), extra: true })).status).toBe(400);
  });
});

describe('/api/platform/notifications', () => {
  it('a school session gets 401 (and so does no session)', async () => {
    for (const user of [w.admin, w.teacher, w.student]) {
      expect((await as(user).get(PLATFORM)).status).toBe(401);
      expect((await as(user).post(`${PLATFORM}/read-all`)).status).toBe(401);
      expect((await as(user).get(`${PLATFORM}/prefs`)).status).toBe(401);
      expect((await as(user).post(`${PLATFORM}/push-subscriptions`).send({ endpoint: fcm(1), keys })).status).toBe(401);
    }
    expect((await anon().get(PLATFORM)).status).toBe(401);
  });

  it('a platform session cannot use the school routes', async () => {
    const admin = await createPlatformAdmin();
    expect((await asPlatform(admin).get(SCHOOL)).status).toBe(401);
  });

  it("lists and marks only the admin's own notifications (no IDOR)", async () => {
    const admin = await createPlatformAdmin();
    const other = await createPlatformAdmin();
    const mine = await seedPlatform(admin.id, 'Mine.');
    const theirs = await seedPlatform(other.id, 'Theirs.');
    await seed(w.teacher, 1);
    const [schoolRow] = await db.select().from(notifications).where(eq(notifications.userId, w.teacher.id));

    const list = await asPlatform(admin).get(PLATFORM);
    expect(list.status).toBe(200);
    expect(list.body.items.map((n: NotificationDto) => n.title)).toEqual(['Mine.']);
    expect(list.body.unreadCount).toBe(1);

    expect((await asPlatform(admin).post(`${PLATFORM}/${theirs.id}/read`)).status).toBe(404);
    expect((await asPlatform(admin).post(`${PLATFORM}/${schoolRow!.id}/read`)).status).toBe(404);
    expect((await asPlatform(admin).post(`${PLATFORM}/${mine.id}/read`)).status).toBe(200);
    expect((await asPlatform(admin).post(`${PLATFORM}/read-all`)).body).toEqual({ updated: 0 });
    const [theirsNow] = await db.select().from(notifications).where(eq(notifications.id, theirs.id));
    expect(theirsNow!.readAt).toBeNull();
    // A school user can't mark a platform admin's notification either.
    expect((await as(w.teacher).post(`${SCHOOL}/${mine.id}/read`)).status).toBe(404);
  });

  it('prefs and push subscriptions belong to the platform admin', async () => {
    const admin = await createPlatformAdmin();
    expect((await asPlatform(admin).get(`${PLATFORM}/prefs`)).body).toEqual({ push: true });
    expect((await asPlatform(admin).put(`${PLATFORM}/prefs`).send({ push: false })).body).toEqual({ push: false });
    const [row] = await db.select({ prefs: platformAdmins.notificationPrefs }).from(platformAdmins).where(eq(platformAdmins.id, admin.id));
    expect(row!.prefs).toEqual({ push: false });
    expect((await asPlatform(admin).get(`${PLATFORM}/push-key`)).body).toEqual({ publicKey: null });

    expect((await asPlatform(admin).post(`${PLATFORM}/push-subscriptions`).send({ endpoint: 'http://10.0.0.112:8000', keys })).status).toBe(400);
    expect((await asPlatform(admin).post(`${PLATFORM}/push-subscriptions`).send({ endpoint: fcm(1), keys })).status).toBe(204);
    const [sub] = await db.select().from(pushSubscriptions);
    expect(sub).toMatchObject({ platformAdminId: admin.id, userId: null, institutionId: null });

    // The same browser later used by a teacher: the endpoint moves to the teacher.
    await as(w.teacher).post(`${SCHOOL}/push-subscriptions`).send({ endpoint: fcm(1), keys });
    const rows = await db.select().from(pushSubscriptions);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ userId: w.teacher.id, platformAdminId: null, institutionId: w.institution.id });
  });
});

describe('exports and offboarding', () => {
  async function seedBoth(world: World) {
    await db.insert(notifications).values({
      userId: world.student.id,
      institutionId: world.institution.id,
      kind: 'lesson.ready',
      tone: 'info',
      title: 'Your quiz is ready.',
      link: '/student',
    });
    await db.insert(pushSubscriptions).values({
      userId: world.student.id,
      institutionId: world.institution.id,
      endpoint: fcm(`export-${world.student.id}`),
      endpointHash: sha256Hex(fcm(`export-${world.student.id}`)),
      ...keys,
      userAgent: 'TestBrowser/1.0',
    });
  }

  it("the student data export (DPDP) includes their notifications and devices, never endpoints or keys", async () => {
    await seedBoth(w);
    const res = await as(w.admin).get(`/api/admin/students/${w.student.id}/export`);
    expect(res.status).toBe(200);
    expect(res.body.student.notificationPrefs).toEqual({ push: true });
    expect(res.body.notifications).toEqual([
      { kind: 'lesson.ready', title: 'Your quiz is ready.', body: null, link: '/student', createdAt: expect.any(String), readAt: null },
    ]);
    expect(res.body.pushDevices).toEqual([{ userAgent: 'TestBrowser/1.0', subscribedAt: expect.any(String), lastDeliveredAt: null }]);
    const text = JSON.stringify(res.body);
    expect(text).not.toContain('fcm.googleapis.com');
    expect(text).not.toContain(keys.p256dh);
  });

  it('the school export includes notifications but not push subscriptions; deleting the school removes both', async () => {
    const admin = await createPlatformAdmin();
    const other = await createWorld();
    await seedBoth(w);
    await seedBoth(other);
    const exported = await asPlatform(admin).post(`/api/platform/schools/${w.institution.id}/export`).send({});
    expect(exported.status).toBe(200);
    expect(exported.body.tables.notifications).toEqual([expect.objectContaining({ title: 'Your quiz is ready.', userId: w.student.id })]);
    expect(exported.body.tables.pushSubscriptions).toBeUndefined();
    expect(JSON.stringify(exported.body)).not.toContain('fcm.googleapis.com');

    await db.update(institutions).set({ status: 'suspended' }).where(eq(institutions.id, w.institution.id));
    const del = await asPlatform(admin).delete(`/api/platform/schools/${w.institution.id}`).send({ confirmCode: w.institution.code });
    expect(del.status).toBe(200);
    expect(del.body.counts).toMatchObject({ notifications: 1, pushSubscriptions: 1 });
    expect(await db.$count(notifications, eq(notifications.institutionId, w.institution.id))).toBe(0);
    expect(await db.$count(pushSubscriptions, eq(pushSubscriptions.institutionId, w.institution.id))).toBe(0);
    expect(await db.$count(notifications, eq(notifications.institutionId, other.institution.id))).toBe(1);
    expect(await db.$count(pushSubscriptions, eq(pushSubscriptions.institutionId, other.institution.id))).toBe(1);
  });
});

describe('POST /api/test/notifications (e2e helper)', () => {
  const sample = { kind: 'lesson.ready', tone: 'success', title: 'Questions are ready to review for “Test”.', link: '/teacher' };

  it('is not mounted when the e2e gate (E2E_MAIL_CAPTURE) is off', async () => {
    expect(env.E2E_MAIL_CAPTURE).toBe(false);
    expect((await as(w.teacher).post('/api/test/notifications').send(sample)).status).toBe(404);
    expect((await anon().post('/api/test/notifications').send(sample)).status).toBe(404);
    expect(await db.$count(notifications)).toBe(0);
  });

  it('when mounted: notifies the signed-in school user, with a strict body', async () => {
    const app = express().use(cookieParser()).use(express.json()).use('/api/test', notificationTestRouter()).use(errorHandler);
    const post = (body: object) => request(app).post('/api/test/notifications').set('Cookie', sessionCookie(w.teacher)).send(body);

    expect((await post(sample)).status).toBe(204);
    const list = await as(w.teacher).get(SCHOOL);
    expect(list.body.items).toEqual([expect.objectContaining({ kind: 'lesson.ready', tone: 'success', title: sample.title, link: '/teacher' })]);

    expect((await post({ ...sample, extra: 1 })).status).toBe(400);
    expect((await post({ ...sample, kind: 'nope' })).status).toBe(400);
    expect((await post({ ...sample, title: '' })).status).toBe(400);
    expect((await request(app).post('/api/test/notifications').send(sample)).status).toBe(401);
  });
});
