/** notify(): record, de-duplicate, live socket event, Web Push delivery and bookkeeping, retention. */
import { eq } from 'drizzle-orm';
import webpush from 'web-push';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NotificationDto, PushPayload } from '@classiq/shared';
import { env } from '../src/config/env.js';
import { db } from '../src/db/client.js';
import { notifications, pushSubscriptions, users } from '../src/db/schema/index.js';
import { sha256Hex } from '../src/lib/crypto.js';
import { notify, type NotifyInput } from '../src/modules/notifications/notify.js';
import { MAX_PUSH_FAILURES, pushTransport } from '../src/modules/notifications/push.js';
import { purgeOldNotifications, purgeStalePushSubscriptions } from '../src/modules/notifications/retention.js';
import { setLocalEmitter } from '../src/realtime/notify.js';
import { createWorld } from './helpers.js';
import { createPlatformAdmin } from './platform.helpers.js';

const LESSON = '11111111-1111-4111-8111-111111111111';
const vapid = webpush.generateVAPIDKeys();
const emitted: { userId: string; event: string; payload: unknown }[] = [];

function installVapid() {
  env.VAPID_PUBLIC_KEY = vapid.publicKey;
  env.VAPID_PRIVATE_KEY = vapid.privateKey;
}

async function addSubscription(owner: { userId: string; institutionId: string } | { platformAdminId: string }, n = 1, extra = {}) {
  const endpoint = `https://fcm.googleapis.com/fcm/send/device-${n}-${Math.random().toString(36).slice(2)}`;
  const [row] = await db
    .insert(pushSubscriptions)
    .values({
      ...('userId' in owner ? { userId: owner.userId, institutionId: owner.institutionId } : { platformAdminId: owner.platformAdminId }),
      endpoint,
      endpointHash: sha256Hex(endpoint),
      p256dh: 'B'.repeat(87),
      auth: 'A'.repeat(22),
      ...extra,
    })
    .returning();
  return row!;
}

const sendSpy = () => vi.spyOn(pushTransport, 'send');
const ok = () => ({ statusCode: 201, body: '', headers: {} });
const pushError = (statusCode: number) => Object.assign(new Error(`Received unexpected response code ${statusCode}`), { statusCode });

beforeEach(() => {
  emitted.length = 0;
  setLocalEmitter((userId, event, payload) => emitted.push({ userId, event, payload }));
  env.VAPID_PUBLIC_KEY = '';
  env.VAPID_PRIVATE_KEY = '';
});

afterEach(() => {
  vi.restoreAllMocks();
  env.VAPID_PUBLIC_KEY = '';
  env.VAPID_PRIVATE_KEY = '';
});

describe('notify()', () => {
  async function teacherInput(overrides: Partial<NotifyInput> = {}) {
    const w = await createWorld();
    const input: NotifyInput = {
      recipient: { userId: w.teacher.id, institutionId: w.institution.id },
      kind: 'lesson.ready',
      tone: 'success',
      title: 'Questions are ready to review for “Photosynthesis”.',
      body: '8 questions written from the recording.',
      link: `/teacher/lessons/${LESSON}`,
      entity: { type: 'lesson', id: LESSON, attempt: 1 },
      ...overrides,
    };
    return { w, input };
  }

  it('records the notification and emits notification:new to the recipient', async () => {
    const { w, input } = await teacherInput();
    await notify(input);
    const rows = await db.select().from(notifications);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      userId: w.teacher.id,
      institutionId: w.institution.id,
      platformAdminId: null,
      kind: 'lesson.ready',
      tone: 'success',
      link: `/teacher/lessons/${LESSON}`,
      entityType: 'lesson',
      entityId: LESSON,
      entityAttempt: 1,
      readAt: null,
    });
    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toMatchObject({ userId: w.teacher.id, event: 'notification:new' });
    const dto = emitted[0]!.payload as NotificationDto;
    expect(dto).toEqual({
      id: rows[0]!.id,
      kind: 'lesson.ready',
      tone: 'success',
      title: input.title,
      body: input.body,
      link: input.link,
      createdAt: rows[0]!.createdAt.toISOString(),
      readAt: null,
    });
  });

  it('de-duplicates per recipient + kind + entity + attempt (a retry or recovery never notifies twice)', async () => {
    const { w, input } = await teacherInput();
    await notify(input);
    await notify(input);
    expect(await db.$count(notifications)).toBe(1);
    expect(emitted).toHaveLength(1);
    // A new attempt, another kind or another recipient is a new notification.
    await notify({ ...input, entity: { type: 'lesson', id: LESSON, attempt: 2 } });
    await notify({ ...input, kind: 'lesson.failed', tone: 'error' });
    await notify({ ...input, recipient: { userId: w.otherTeacher.id, institutionId: w.institution.id } });
    expect(await db.$count(notifications)).toBe(4);
    // Without an entity there is nothing to de-duplicate on.
    await notify({ ...input, entity: undefined });
    await notify({ ...input, entity: undefined });
    expect(await db.$count(notifications)).toBe(6);
  });

  it('keeps only same-origin links and cuts long text', async () => {
    const { input } = await teacherInput({ entity: undefined });
    for (const link of ['https://evil.example/x', '//evil.example/x', '/\\evil.example', 'javascript:alert(1)', '/a b', 'teacher/lessons']) {
      await notify({ ...input, link });
    }
    const rows = await db.select().from(notifications);
    expect(rows).toHaveLength(6);
    expect(rows.every((r) => r.link === null)).toBe(true);

    await db.delete(notifications);
    await notify({ ...input, title: `${'Long title '.repeat(40)}\n\u0007`, body: 'x'.repeat(900) });
    const [row] = await db.select().from(notifications);
    expect(row!.title.length).toBeLessThanOrEqual(200);
    expect(row!.title).not.toContain('\n');
    expect(row!.title).not.toContain('\u0007');
    expect(row!.body!.length).toBe(500);
  });

  it('drops (without throwing) a recipient that does not exist or a user/school mismatch', async () => {
    const { w, input } = await teacherInput();
    const other = await createWorld();
    await expect(notify({ ...input, recipient: { userId: w.teacher.id, institutionId: other.institution.id } })).resolves.toBeUndefined();
    await expect(notify({ ...input, recipient: { userId: LESSON, institutionId: w.institution.id } })).resolves.toBeUndefined();
    await expect(notify({ ...input, recipient: { userId: 'not-a-uuid', institutionId: w.institution.id } })).resolves.toBeUndefined();
    expect(await db.$count(notifications)).toBe(0);
    expect(emitted).toHaveLength(0);
  });

  it('never throws when the database fails', async () => {
    const { input } = await teacherInput();
    vi.spyOn(db, 'insert').mockImplementation(() => {
      throw new Error('connection terminated');
    });
    await expect(notify(input)).resolves.toBeUndefined();
  });

  it('records platform admin notifications without any socket event', async () => {
    const admin = await createPlatformAdmin();
    await notify({
      recipient: { platformAdminId: admin.id },
      kind: 'deploy.succeeded',
      tone: 'success',
      title: 'The redeploy finished.',
      link: '/platform/ops/deployments',
      entity: { type: 'deployment', id: LESSON },
    });
    const [row] = await db.select().from(notifications);
    expect(row).toMatchObject({ platformAdminId: admin.id, userId: null, institutionId: null, entityAttempt: 0 });
    expect(emitted).toHaveLength(0);
  });

  describe('Web Push', () => {
    it('sends a small payload to every subscribed device with TTL, urgency and a 5 s timeout', async () => {
      installVapid();
      const { w, input } = await teacherInput();
      const owner = { userId: w.teacher.id, institutionId: w.institution.id };
      const [a, b] = [await addSubscription(owner, 1), await addSubscription(owner, 2)];
      await addSubscription({ userId: w.otherTeacher.id, institutionId: w.institution.id }, 3);
      const send = sendSpy().mockResolvedValue(ok());

      await notify(input);

      expect(send).toHaveBeenCalledTimes(2);
      expect(send.mock.calls.map((c) => c[0].endpoint).sort()).toEqual([a.endpoint, b.endpoint].sort());
      const [sub, json, options] = send.mock.calls[0]!;
      expect(sub.keys).toEqual({ p256dh: 'B'.repeat(87), auth: 'A'.repeat(22) });
      const payload = JSON.parse(json as string) as PushPayload;
      const [row] = await db.select().from(notifications);
      expect(payload).toEqual({ id: row!.id, title: input.title, body: input.body, link: input.link, tone: 'success' });
      expect(Buffer.byteLength(json as string)).toBeLessThan(3000);
      expect(options).toMatchObject({ TTL: 86400, urgency: 'normal', timeout: 5000 });
      expect(options!.vapidDetails).toMatchObject({ publicKey: vapid.publicKey, subject: 'mailto:admin@benxsolutions.in' });
      const subs = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, w.teacher.id));
      expect(subs.every((s) => s.lastSuccessAt !== null && s.failureCount === 0)).toBe(true);
    });

    it('deletes a subscription the push service reports gone (410/404)', async () => {
      installVapid();
      const { w, input } = await teacherInput();
      const owner = { userId: w.teacher.id, institutionId: w.institution.id };
      const gone = await addSubscription(owner, 1);
      const missing = await addSubscription(owner, 2);
      const fine = await addSubscription(owner, 3);
      sendSpy().mockImplementation(async (sub) => {
        if (sub.endpoint === gone.endpoint) throw pushError(410);
        if (sub.endpoint === missing.endpoint) throw pushError(404);
        return ok();
      });
      await notify(input);
      const left = await db.select({ id: pushSubscriptions.id }).from(pushSubscriptions);
      expect(left.map((r) => r.id)).toEqual([fine.id]);
    });

    it('counts other failures and drops a subscription after MAX_PUSH_FAILURES; never throws', async () => {
      installVapid();
      const { w, input } = await teacherInput({ entity: undefined });
      const sub = await addSubscription({ userId: w.teacher.id, institutionId: w.institution.id }, 1, { failureCount: MAX_PUSH_FAILURES - 2 });
      sendSpy().mockRejectedValue(pushError(500));
      await expect(notify(input)).resolves.toBeUndefined();
      const [row] = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id));
      expect(row!.failureCount).toBe(MAX_PUSH_FAILURES - 1);
      await notify(input);
      expect(await db.$count(pushSubscriptions)).toBe(0);
      // The notifications themselves were recorded and emitted.
      expect(await db.$count(notifications)).toBe(2);
      expect(emitted).toHaveLength(2);
    });

    it('skips push when the person turned it off, or when VAPID keys are not configured', async () => {
      const { w, input } = await teacherInput({ entity: undefined });
      await addSubscription({ userId: w.teacher.id, institutionId: w.institution.id });
      const send = sendSpy().mockResolvedValue(ok());

      await notify(input); // no VAPID keys
      installVapid();
      await db.update(users).set({ notificationPrefs: { push: false } }).where(eq(users.id, w.teacher.id));
      await notify(input); // push off

      expect(send).not.toHaveBeenCalled();
      expect(await db.$count(notifications)).toBe(2);
      expect(emitted).toHaveLength(2);
    });

    it('pushes to platform admins (their own subscriptions only)', async () => {
      installVapid();
      const admin = await createPlatformAdmin();
      const other = await createPlatformAdmin();
      const mine = await addSubscription({ platformAdminId: admin.id });
      await addSubscription({ platformAdminId: other.id });
      const send = sendSpy().mockResolvedValue(ok());
      await notify({ recipient: { platformAdminId: admin.id }, kind: 'deploy.failed', tone: 'error', title: 'The redeploy failed.' });
      expect(send).toHaveBeenCalledTimes(1);
      expect(send.mock.calls[0]![0].endpoint).toBe(mine.endpoint);
    });

    it('never posts to a stored endpoint outside the push-service allow-list', async () => {
      installVapid();
      const { w, input } = await teacherInput({ entity: undefined });
      const endpoint = 'https://10.0.0.112/push';
      await db.insert(pushSubscriptions).values({
        userId: w.teacher.id,
        institutionId: w.institution.id,
        endpoint,
        endpointHash: sha256Hex(endpoint),
        p256dh: 'B'.repeat(87),
        auth: 'A'.repeat(22),
      });
      const send = sendSpy().mockResolvedValue(ok());
      await notify(input);
      expect(send).not.toHaveBeenCalled();
      expect(await db.$count(pushSubscriptions)).toBe(0);
    });
  });
});

describe('notification retention', () => {
  const daysAgo = (d: number) => new Date(Date.now() - d * 86400_000);

  it('deletes read notifications after 90 days and all notifications after 180 days', async () => {
    const w = await createWorld();
    const base = { userId: w.teacher.id, institutionId: w.institution.id, kind: 'lesson.ready' as const, tone: 'success' as const };
    await db.insert(notifications).values([
      { ...base, title: 'read-old', createdAt: daysAgo(91), readAt: daysAgo(80) },
      { ...base, title: 'read-recent', createdAt: daysAgo(30), readAt: daysAgo(29) },
      { ...base, title: 'unread-91', createdAt: daysAgo(91) },
      { ...base, title: 'unread-181', createdAt: daysAgo(181) },
    ]);
    expect(await purgeOldNotifications()).toBe(2);
    const left = await db.select({ title: notifications.title }).from(notifications);
    expect(left.map((r) => r.title).sort()).toEqual(['read-recent', 'unread-91']);
  });

  it('deletes push subscriptions that keep failing or have not delivered for 120 days', async () => {
    const w = await createWorld();
    const owner = { userId: w.teacher.id, institutionId: w.institution.id };
    const keep = await addSubscription(owner, 1, { lastSuccessAt: daysAgo(10), createdAt: daysAgo(400) });
    const keepNew = await addSubscription(owner, 2);
    await addSubscription(owner, 3, { failureCount: MAX_PUSH_FAILURES });
    await addSubscription(owner, 4, { createdAt: daysAgo(121) });
    await addSubscription(owner, 5, { lastSuccessAt: daysAgo(121), createdAt: daysAgo(200) });
    expect(await purgeStalePushSubscriptions()).toBe(3);
    const left = await db.select({ id: pushSubscriptions.id }).from(pushSubscriptions);
    expect(left.map((r) => r.id).sort()).toEqual([keep.id, keepNew.id].sort());
  });

  it('removes notifications and push subscriptions with their user', async () => {
    const w = await createWorld();
    await notify({ recipient: { userId: w.student.id, institutionId: w.institution.id }, kind: 'lesson.ready', tone: 'info', title: 'Hello.' });
    await addSubscription({ userId: w.student.id, institutionId: w.institution.id });
    await db.delete(users).where(eq(users.id, w.student.id));
    expect(await db.$count(notifications)).toBe(0);
    expect(await db.$count(pushSubscriptions)).toBe(0);
  });
});
