import { z } from 'zod';
import type { Id, IsoDate } from './common.js';

/*
 * Notifications: "your background job is done". The API records one row per recipient when an AI job or a
 * long-running process finishes (or fails), pushes it live to open sessions (socket event
 * `notification:new`), and — if the person turned it on — to their phone/desktop via Web Push.
 *
 * School users read theirs at /api/notifications; super admins at /api/platform/notifications (the platform
 * host has no sockets, so the platform console polls).
 */

export const NOTIFICATION_KINDS = [
  /** A recording/upload finished transcribing (transcription-only run). */
  'lesson.transcribed',
  /** Quiz questions were written and are waiting for the teacher's review. */
  'lesson.ready',
  /** The lesson pipeline failed after its last retry, or timed out. */
  'lesson.failed',
  /** An AI teaching resource (lesson plan, worksheet, question paper, presentation) is ready. */
  'resource.ready',
  'resource.failed',
  /** Super admins: a redeploy/restart they started finished. */
  'deploy.succeeded',
  'deploy.failed',
] as const;
export const NotificationKind = z.enum(NOTIFICATION_KINDS);
export type NotificationKind = z.infer<typeof NotificationKind>;

export const NOTIFICATION_TONES = ['success', 'error', 'info'] as const;
export type NotificationTone = (typeof NOTIFICATION_TONES)[number];

export interface NotificationDto {
  id: Id;
  kind: NotificationKind;
  tone: NotificationTone;
  /** Short, complete sentence, e.g. "Questions are ready for “Photosynthesis”." */
  title: string;
  /** Optional second line (e.g. the failure reason in plain words). */
  body: string | null;
  /** Same-origin path to open, e.g. "/teacher/lessons/<id>". Never an absolute URL. */
  link: string | null;
  createdAt: IsoDate;
  readAt: IsoDate | null;
}

/** GET /api/notifications (and /api/platform/notifications): newest first, cursor-paginated. */
export const NotificationListQuery = z.object({
  /** createdAt of the last item from the previous page (exclusive). */
  before: z.iso.datetime().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  /** "true"/"false" (also 1/0, yes/no). Not z.coerce.boolean(): that reads the string "false" as true. */
  unreadOnly: z.stringbool().default(false),
});
export type NotificationListQuery = z.infer<typeof NotificationListQuery>;

export interface NotificationListResponse {
  items: NotificationDto[];
  unreadCount: number;
  /** Pass as `before` to get the next page; null when there are no more. */
  nextBefore: IsoDate | null;
}

/** Per-person channel switches. In-app (bell + live toast) is always on. */
export const NotificationPrefs = z
  .object({
    /** Phone/desktop push (Web Push) for this person's subscribed devices. */
    push: z.boolean(),
  })
  .strict();
export type NotificationPrefs = z.infer<typeof NotificationPrefs>;
export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = { push: true };

/**
 * Push services a subscription endpoint may point at (the server POSTs to it, so anything else is refused:
 * no SSRF into private networks). Chrome/Edge/Android use FCM, Firefox Mozilla autopush, legacy Edge WNS,
 * Safari (macOS/iOS) Apple's service. An entry starting with "*." matches any subdomain (not the bare domain).
 */
export const PUSH_ENDPOINT_HOSTS = ['fcm.googleapis.com', '*.push.services.mozilla.com', '*.notify.windows.com', 'web.push.apple.com'] as const;
/** Longest accepted push endpoint URL. */
export const PUSH_ENDPOINT_MAX_LENGTH = 500;
/** Push subscriptions (devices/browsers) kept per account; subscribing another one drops the oldest. */
export const MAX_PUSH_SUBSCRIPTIONS = 10;

/** https, no userinfo, default port, host on PUSH_ENDPOINT_HOSTS. */
export function isAllowedPushEndpoint(value: string): boolean {
  if (value.length > PUSH_ENDPOINT_MAX_LENGTH) return false;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) return false;
  const host = url.hostname.toLowerCase();
  return PUSH_ENDPOINT_HOSTS.some((h) => (h.startsWith('*.') ? host.endsWith(h.slice(1)) && host.length > h.length - 1 : host === h));
}

const PushEndpoint = z
  .string()
  .max(PUSH_ENDPOINT_MAX_LENGTH)
  .refine(isAllowedPushEndpoint, { message: 'Not a supported push service address' });

/** POST …/notifications/push-subscriptions — the browser's PushSubscription.toJSON(). */
export const PushSubscriptionInput = z
  .object({
    endpoint: PushEndpoint,
    expirationTime: z.number().nullable().optional(),
    keys: z
      .object({
        /** base64url P-256 public key (65 bytes → 87 chars). */
        p256dh: z.string().min(16).max(128),
        /** base64url 16-byte auth secret (22 chars). */
        auth: z.string().min(8).max(64),
      })
      .strict(),
  })
  .strict();
export type PushSubscriptionInput = z.infer<typeof PushSubscriptionInput>;

/** DELETE …/notifications/push-subscriptions */
export const PushUnsubscribeInput = z.object({ endpoint: z.string().min(1).max(PUSH_ENDPOINT_MAX_LENGTH) }).strict();
export type PushUnsubscribeInput = z.infer<typeof PushUnsubscribeInput>;

/** GET …/notifications/push-key — null when push isn't configured on this server (no VAPID keys). */
export interface PushKeyResponse {
  publicKey: string | null;
}

/** The payload the service worker receives in a `push` event (kept small: Web Push caps payloads at ~4 KB). */
export interface PushPayload {
  id: Id;
  title: string;
  body: string | null;
  link: string | null;
  tone: NotificationTone;
}

/** POST …/notifications/read-all */
export interface MarkAllReadResponse {
  /** How many notifications were unread and are now read. */
  updated: number;
}

/**
 * How long notifications are kept before the daily retention sweep deletes them: read ones after `read`
 * days, every notification (read or not) after `all` days.
 */
export const NOTIFICATION_RETENTION_DAYS = { read: 90, all: 180 } as const;
