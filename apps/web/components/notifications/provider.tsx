'use client';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useInfiniteQuery, useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type { NotificationDto, NotificationListResponse } from '@classiq/shared';
import { useToast } from '@/components/ui/toast';
import { ApiError, api } from '@/lib/api';
import { connectSocket } from '@/lib/socket';
import {
  markReadInCache,
  notificationBase,
  notificationKeys,
  prependNotification,
  safeLink,
  type NotificationPages,
  type NotificationScope,
} from './shared';

const PAGE_SIZE = 20;
/** The platform console has no sockets: it polls. School tabs poll only while their socket is down. */
const PLATFORM_POLL_MS = 30_000;
const FALLBACK_POLL_MS = 60_000;
/** At most this many toasts for one batch of new notifications; the rest are in the bell. */
const MAX_TOASTS = 3;

interface NotificationsContextValue {
  scope: NotificationScope;
  items: NotificationDto[];
  unreadCount: number;
  isLoading: boolean;
  error: unknown;
  refetch: () => void;
  hasMore: boolean;
  loadingMore: boolean;
  loadMore: () => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  markingAll: boolean;
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

export function useNotifications(): NotificationsContextValue {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications must be used inside NotificationsProvider');
  return ctx;
}

/** Refresh the screens a finished job affects, so an open lesson/resource page updates by itself. */
function invalidateRelated(qc: QueryClient, n: NotificationDto) {
  if (n.kind.startsWith('lesson.')) {
    void qc.invalidateQueries({ queryKey: ['lessons'] });
    void qc.invalidateQueries({ queryKey: ['teacher', 'dashboard'] });
  } else if (n.kind.startsWith('resource.')) {
    void qc.invalidateQueries({ queryKey: ['resources'] });
  } else if (n.kind.startsWith('deploy.')) {
    void qc.invalidateQueries({ queryKey: ['platform', 'ops'] });
  }
}

type BadgeNavigator = Navigator & {
  setAppBadge?: (n?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

/**
 * Notifications for the signed-in person: the list (TanStack Query, newest first, cursor pages),
 * live arrivals (one socket per tab for school users; polling on the platform console), a toast for
 * each new one, and the installed app's icon badge.
 */
export function NotificationsProvider({
  scope,
  children,
}: {
  scope: NotificationScope;
  children: ReactNode;
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const key = useMemo(() => notificationKeys.list(scope), [scope]);
  const base = notificationBase(scope);
  const [socketUp, setSocketUp] = useState(false);

  const query = useInfiniteQuery({
    queryKey: key,
    queryFn: ({ pageParam, signal }) =>
      api.get<NotificationListResponse>(base, { limit: PAGE_SIZE, before: pageParam ?? undefined }, signal),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextBefore,
    refetchOnWindowFocus: true,
    refetchInterval: (q) => {
      // Rate limited: back off quietly.
      if (q.state.error instanceof ApiError && q.state.error.status === 429) return 5 * 60_000;
      return scope === 'platform' ? PLATFORM_POLL_MS : socketUp ? false : FALLBACK_POLL_MS;
    },
    refetchIntervalInBackground: false,
  });

  // School users: one socket per tab for `notification:new` (counts once toward the per-user socket cap).
  useEffect(() => {
    if (scope !== 'school') return;
    const key = notificationKeys.list(scope);
    const socket = connectSocket();
    let connectedBefore = false;
    const onConnect = () => {
      setSocketUp(true);
      // Back after a drop: pick up anything that arrived meanwhile.
      if (connectedBefore) void qc.invalidateQueries({ queryKey: key });
      connectedBefore = true;
    };
    const onDisconnect = () => setSocketUp(false);
    const onNotification = (n: NotificationDto) => {
      qc.setQueryData<NotificationPages>(key, (data) => prependNotification(data, n));
      // No list cached yet (first load still running): the fetch will include it.
    };
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('notification:new', onNotification);
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('notification:new', onNotification);
      socket.disconnect();
    };
  }, [scope, qc]);

  // Toast + refresh related screens for every notification that appears after the first load —
  // whether it came from the socket or a poll. Ids seen at first load are never toasted.
  const seen = useRef<Set<string> | null>(null);
  const firstPage = query.data?.pages[0];
  useEffect(() => {
    if (!firstPage) return;
    if (!seen.current) {
      seen.current = new Set(firstPage.items.map((n) => n.id));
      return;
    }
    const fresh = firstPage.items.filter((n) => !seen.current!.has(n.id));
    if (fresh.length === 0) return;
    for (const n of fresh) seen.current.add(n.id);
    for (const n of fresh) invalidateRelated(qc, n);
    const unread = fresh.filter((n) => !n.readAt);
    unread.slice(0, MAX_TOASTS).forEach((n) => {
      const link = safeLink(n.link);
      toast(n.title, n.tone, {
        description: n.body,
        action: link ? { label: 'Open', href: link } : undefined,
      });
    });
    if (unread.length > MAX_TOASTS)
      toast(`${unread.length - MAX_TOASTS} more in your notifications.`, 'info');
  }, [firstPage, qc, toast]);

  const unreadCount = firstPage?.unreadCount ?? 0;

  // Installed app: show the unread count on the icon (Chrome/Edge desktop, Android, iOS home-screen apps).
  useEffect(() => {
    const nav = navigator as BadgeNavigator;
    if (!nav.setAppBadge) return;
    const p = unreadCount > 0 ? nav.setAppBadge(unreadCount) : (nav.clearAppBadge?.() ?? nav.setAppBadge(0));
    p.catch(() => undefined);
  }, [unreadCount]);

  // Mark read: optimistic. A failure re-syncs quietly; when rate limited, wait a minute before re-syncing.
  const resync = useCallback(
    (err: unknown) => {
      const delay = err instanceof ApiError && err.status === 429 ? 60_000 : 0;
      setTimeout(() => void qc.invalidateQueries({ queryKey: key }), delay);
    },
    [qc, key],
  );
  const readOne = useMutation({
    mutationFn: (id: string) => api.post(`${base}/${encodeURIComponent(id)}/read`),
    onMutate: (id) => qc.setQueryData<NotificationPages>(key, (d) => markReadInCache(d, id)),
    onError: resync,
  });
  const readAll = useMutation({
    mutationFn: () => api.post(`${base}/read-all`),
    onMutate: () => qc.setQueryData<NotificationPages>(key, (d) => markReadInCache(d, null)),
    onError: resync,
  });

  const pending = useRef(new Set<string>());
  const markRead = useCallback(
    (id: string) => {
      // One request per notification, ever (double clicks and repeat opens don't re-send).
      if (pending.current.has(id)) return;
      const item = qc
        .getQueryData<NotificationPages>(key)
        ?.pages.flatMap((p) => p.items)
        .find((x) => x.id === id);
      if (item?.readAt) return;
      pending.current.add(id);
      readOne.mutate(id, { onSettled: () => pending.current.delete(id) });
    },
    [qc, key, readOne],
  );

  const items = useMemo(() => query.data?.pages.flatMap((p) => p.items) ?? [], [query.data]);
  const { refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = query;
  const value: NotificationsContextValue = {
    scope,
    items,
    unreadCount,
    isLoading: query.isPending,
    error: query.error,
    refetch: () => void refetch(),
    hasMore: Boolean(hasNextPage),
    loadingMore: isFetchingNextPage,
    loadMore: () => void fetchNextPage(),
    markRead,
    markAllRead: () => {
      if (unreadCount > 0 && !readAll.isPending) readAll.mutate();
    },
    markingAll: readAll.isPending,
  };

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}
