import type { InfiniteData } from '@tanstack/react-query';
import type { NotificationDto, NotificationListResponse } from '@classiq/shared';

/** School users read /api/notifications; super admins /api/platform/notifications (no sockets there: it polls). */
export type NotificationScope = 'school' | 'platform';

export const notificationBase = (scope: NotificationScope) =>
  scope === 'platform' ? '/platform/notifications' : '/notifications';

export const notificationKeys = {
  list: (scope: NotificationScope) => ['notifications', scope] as const,
  prefs: (scope: NotificationScope) => ['notifications', scope, 'prefs'] as const,
  pushKey: (scope: NotificationScope) => ['notifications', scope, 'push-key'] as const,
};

export type NotificationPages = InfiniteData<NotificationListResponse, string | null>;

/**
 * Notification links are opened in-app, so they must be same-origin paths: exactly one leading '/',
 * no scheme, no backslashes or control characters. Anything else is treated as "no link".
 */
export function safeLink(link: string | null | undefined): string | null {
  if (typeof link !== 'string' || link.length > 2048) return null;
  if (!link.startsWith('/') || link.startsWith('//')) return null;
  if (link.includes('\\') || [...link].some((c) => c.charCodeAt(0) < 0x20 || c.charCodeAt(0) === 0x7f))
    return null;
  return link;
}

const rtf = typeof Intl !== 'undefined' ? new Intl.RelativeTimeFormat('en', { numeric: 'auto' }) : null;
const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['week', 7 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
];

/** "just now", "5 minutes ago", "yesterday"… */
export function relativeTime(iso: string, now = Date.now()): string {
  const seconds = Math.round((new Date(iso).getTime() - now) / 1000);
  if (!rtf || Number.isNaN(seconds)) return '';
  if (Math.abs(seconds) < 45) return 'just now';
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit);
  }
  return rtf.format(Math.round(seconds / 60), 'minute');
}

/** Insert a notification at the top of the first page (no-op if it is already there). */
export function prependNotification(
  data: NotificationPages | undefined,
  n: NotificationDto,
): NotificationPages | undefined {
  if (!data || data.pages.length === 0) return data;
  if (data.pages.some((p) => p.items.some((x) => x.id === n.id))) return data;
  const [first, ...rest] = data.pages;
  return {
    ...data,
    pages: [
      { ...first!, items: [n, ...first!.items], unreadCount: first!.unreadCount + (n.readAt ? 0 : 1) },
      ...rest,
    ],
  };
}

/** Mark one (id) or all (null) notifications read in the cached pages. */
export function markReadInCache(
  data: NotificationPages | undefined,
  id: string | null,
): NotificationPages | undefined {
  if (!data) return data;
  const now = new Date().toISOString();
  let changed = 0;
  const pages = data.pages.map((p) => ({
    ...p,
    items: p.items.map((x) => {
      if (x.readAt || (id !== null && x.id !== id)) return x;
      changed += 1;
      return { ...x, readAt: now };
    }),
  }));
  const [first, ...rest] = pages;
  if (!first) return data;
  const unreadCount = id === null ? 0 : Math.max(0, first.unreadCount - changed);
  return { ...data, pages: [{ ...first, unreadCount }, ...rest] };
}
