/**
 * `notify()`: the one entry point producers (lesson pipeline, resources queue, platform deploys) call when a
 * background job finishes or fails. It
 *  1. records the notification (de-duplicated: one per recipient + kind + entity + attempt, so retries and
 *     crash recovery never notify twice — a duplicate is dropped silently, nothing is pushed again);
 *  2. pushes it live to the recipient's open sessions (socket `notification:new` in the `user:<id>` room via
 *     realtime/notify.ts; school users only — platform admins have no sockets and poll);
 *  3. sends Web Push to their subscribed devices when VAPID keys are configured and their `push` pref is on.
 *
 * It never throws (everything is caught and logged without the notification text) and works from both the
 * API process and the worker (DB + Redis). It resolves once delivery settled (push is bounded by a 5 s
 * timeout per device); producers that must not wait use `sendNotification()` (jobs/sendNotification.ts).
 */
import type { NotificationKind, NotificationTone } from '@classpulse/shared';
import { NOTIFICATION_KINDS, NOTIFICATION_TONES } from '@classpulse/shared';
import { db } from '../../db/client.js';
import { notifications } from '../../db/schema/index.js';
import { logger } from '../../lib/logger.js';
import { notifyUser } from '../../realtime/notify.js';
import { pushToOwner } from './push.js';
import { loadPrefs, ownerColumns, ownerKey, toNotificationDto, type Owner } from './repo.js';

export type NotificationRecipient =
  /** A school user (teacher/admin/student). */
  | { userId: string; institutionId: string }
  /** A super admin (platform console). */
  | { platformAdminId: string };

export interface NotifyInput {
  recipient: NotificationRecipient;
  kind: NotificationKind;
  tone: NotificationTone;
  /** Short complete sentence in plain words (no HTML). Cut at 200 characters. */
  title: string;
  /** Cut at 500 characters. */
  body?: string | null;
  /** Same-origin path, e.g. `/teacher/lessons/${id}`. Anything else (absolute or `//host` URLs) is dropped. */
  link?: string | null;
  /** What it's about, for de-duplication (one notification per kind per entity per attempt). */
  entity?: { type: 'lesson' | 'resource' | 'deployment'; id: string; attempt?: number };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LINK_MAX = 300;

/** Plain single-line text: control characters removed, whitespace collapsed, cut with an ellipsis. */
export function cleanText(value: string, max: number): string {
  // eslint-disable-next-line no-control-regex
  const s = value.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim();
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
}

/** A relative path starting with exactly one '/', no backslashes, whitespace or control characters. */
export function isSafeLink(link: string): boolean {
  if (link.length > LINK_MAX || [...link].some((c) => c.charCodeAt(0) < 0x20 || c.charCodeAt(0) === 0x7f)) return false;
  return /^\/(?![/\\])[^\s\\]*$/.test(link);
}

function toOwner(r: NotificationRecipient): Owner | null {
  if ('userId' in r) return UUID.test(r.userId) && UUID.test(r.institutionId) ? { type: 'user', userId: r.userId, institutionId: r.institutionId } : null;
  return UUID.test(r.platformAdminId) ? { type: 'platform', adminId: r.platformAdminId } : null;
}

async function deliver(input: NotifyInput): Promise<void> {
  const owner = toOwner(input.recipient);
  if (!owner || !NOTIFICATION_KINDS.includes(input.kind) || !NOTIFICATION_TONES.includes(input.tone)) {
    logger.warn({ kind: input.kind }, 'Notification dropped: invalid recipient, kind or tone');
    return;
  }
  const title = cleanText(String(input.title ?? ''), 200);
  if (!title) {
    logger.warn({ kind: input.kind }, 'Notification dropped: empty title');
    return;
  }
  const body = input.body ? cleanText(String(input.body), 500) || null : null;
  let link: string | null = null;
  if (input.link) {
    if (isSafeLink(input.link)) link = input.link;
    else logger.warn({ kind: input.kind }, 'Notification link dropped: not a same-origin path');
  }
  let entity = input.entity;
  if (entity && (!UUID.test(entity.id) || (entity.attempt !== undefined && !Number.isInteger(entity.attempt)))) {
    logger.warn({ kind: input.kind }, 'Notification entity ignored: invalid id or attempt');
    entity = undefined;
  }

  // Also confirms the recipient exists (and that the user belongs to that school).
  const prefs = await loadPrefs(owner);
  if (!prefs) {
    logger.warn({ kind: input.kind, recipient: ownerKey(owner) }, 'Notification dropped: recipient not found');
    return;
  }

  const attempt = entity ? (entity.attempt ?? 0) : null;
  const [row] = await db
    .insert(notifications)
    .values({
      ...ownerColumns(owner),
      kind: input.kind,
      tone: input.tone,
      title,
      body,
      link,
      entityType: entity?.type ?? null,
      entityId: entity?.id ?? null,
      entityAttempt: attempt,
      dedupeKey: entity ? `${ownerKey(owner)}:${input.kind}:${entity.type}:${entity.id}:${attempt}` : null,
    })
    .onConflictDoNothing({ target: notifications.dedupeKey })
    .returning();
  if (!row) return; // already notified for this attempt

  const dto = toNotificationDto(row);
  if (owner.type === 'user') notifyUser(owner.userId, 'notification:new', dto);
  if (prefs.push) await pushToOwner(owner, dto);
}

export async function notify(input: NotifyInput): Promise<void> {
  try {
    await deliver(input);
  } catch (err) {
    // First line of the message only: drizzle puts the bound parameters (the title) on later lines.
    const message = (err as Error)?.message?.split('\n')[0]?.slice(0, 200);
    const code = (err as { cause?: { code?: unknown } })?.cause?.code;
    logger.warn({ err: message, code: typeof code === 'string' ? code : undefined, kind: input?.kind }, 'Notification could not be recorded');
  }
}
