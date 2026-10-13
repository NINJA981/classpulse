'use client';
import { useCallback, useEffect, useId, useRef, useState, type RefObject } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { AlertTriangle, Bell, CheckCircle2, Info, X } from 'lucide-react';
import type { NotificationDto } from '@classpulse/shared';
import { Button } from '@/components/ui/button';
import { ErrorState, Spinner } from '@/components/ui/states';
import { useNotifications } from './provider';
import { PushToggle } from './push';
import { relativeTime, safeLink } from './shared';

const TONE_ICON = { success: CheckCircle2, error: AlertTriangle, info: Info } as const;
const TONE_COLOR = { success: 'text-success', error: 'text-danger', info: 'text-ink-2' } as const;

/**
 * The bell: an icon button with the unread count, opening the notifications panel.
 * Desktop: a panel beside the sidebar. Phones: a full-width sheet from the bottom.
 */
export function NotificationBell({ className, onNavigate }: { className?: string; onNavigate?: () => void }) {
  const { unreadCount } = useNotifications();
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  const close = useCallback((returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) trigger.current?.focus();
  }, []);

  const label = unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications';
  const shown = unreadCount > 99 ? '99+' : String(unreadCount);

  return (
    <>
      <button
        ref={trigger}
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-haspopup="dialog"
        onClick={() => (open ? close(false) : setOpen(true))}
        className={clsx(
          'relative inline-flex size-9 shrink-0 items-center justify-center border rounded-control',
          open ? 'border-line-strong bg-surface-2' : 'border-transparent hover:bg-surface-2',
          className,
        )}
      >
        <Bell className="size-5" aria-hidden />
        {unreadCount > 0 && (
          <span
            aria-hidden
            className="absolute -right-1 -top-1 inline-flex h-[18px] min-w-[18px] items-center justify-center border border-line-strong bg-accent px-1 text-[10px] font-black leading-none text-accent-ink rounded-full"
          >
            {shown}
          </span>
        )}
      </button>
      {open && (
        <NotificationPanel
          id={panelId}
          trigger={trigger}
          onClose={close}
          onNavigate={() => {
            close(false);
            onNavigate?.();
          }}
        />
      )}
    </>
  );
}

function NotificationPanel({
  id,
  trigger,
  onClose,
  onNavigate,
}: {
  id: string;
  trigger: RefObject<HTMLButtonElement | null>;
  onClose: (returnFocus: boolean) => void;
  onNavigate: () => void;
}) {
  const {
    scope,
    items,
    unreadCount,
    isLoading,
    error,
    refetch,
    hasMore,
    loadingMore,
    loadMore,
    markRead,
    markAllRead,
    markingAll,
  } = useNotifications();
  const panel = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const titleId = `${id}-title`;
  const [now, setNow] = useState(() => Date.now());

  // Focus moves into the panel; Esc closes and returns focus to the bell; a click outside closes.
  useEffect(() => {
    heading.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose(true);
      }
    };
    const onPointer = (e: PointerEvent) => {
      const t = e.target as Node;
      if (panel.current?.contains(t) || trigger.current?.contains(t)) return;
      onClose(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    const tick = setInterval(() => setNow(Date.now()), 30_000);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
      clearInterval(tick);
    };
  }, [onClose, trigger]);

  const empty =
    scope === 'platform'
      ? "Nothing yet. When a redeploy you started finishes, you'll see it here."
      : "Nothing yet. When a lesson or resource finishes, you'll see it here.";

  return (
    <>
      {/* Phones: dim the page behind the sheet. */}
      <div aria-hidden className="fixed inset-0 z-50 bg-black/40 lg:hidden" />
      <div
        ref={panel}
        id={id}
        role="dialog"
        aria-labelledby={titleId}
        className={clsx(
          'fixed z-50 flex flex-col border border-line-strong bg-surface text-ink shadow-pop',
          // Phone: full-width bottom sheet.
          'inset-x-0 bottom-0 max-h-[85dvh] rounded-t-card',
          // Desktop: beside the sidebar, anchored to the bottom.
          'lg:inset-x-auto lg:bottom-4 lg:left-[260px] lg:max-h-[min(640px,calc(100dvh-2rem))] lg:w-[400px] lg:rounded-card',
        )}
      >
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <h2
            ref={heading}
            id={titleId}
            tabIndex={-1}
            className="font-display text-lg font-extrabold outline-none"
          >
            Notifications
          </h2>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" onClick={markAllRead} loading={markingAll}>
                Mark all as read
              </Button>
            )}
            <button
              type="button"
              onClick={() => onClose(true)}
              aria-label="Close notifications"
              className="p-1.5 hover:bg-surface-2 rounded-control"
            >
              <X className="size-5" aria-hidden />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-muted">
              <Spinner /> Loading notifications…
            </div>
          ) : error && items.length === 0 ? (
            <div className="p-4">
              <ErrorState error={error} onRetry={refetch} />
            </div>
          ) : items.length === 0 ? (
            <div className="px-6 py-10 text-center">
              <span className="mx-auto mb-3 inline-flex size-11 items-center justify-center border border-line-strong bg-accent-soft rounded-full">
                <Bell className="size-5" aria-hidden />
              </span>
              <p className="text-sm font-semibold text-ink-2">{empty}</p>
            </div>
          ) : (
            <ul aria-label="Notifications" className="divide-y divide-line">
              {items.map((n) => (
                <NotificationItem key={n.id} n={n} now={now} onOpen={markRead} onNavigate={onNavigate} />
              ))}
            </ul>
          )}
          {hasMore && items.length > 0 && (
            <div className="border-t border-line p-3 text-center">
              <Button variant="secondary" size="sm" onClick={loadMore} loading={loadingMore}>
                Load more
              </Button>
            </div>
          )}
        </div>

        <div className="border-t border-line bg-surface-2 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] rounded-b-card">
          <PushToggle scope={scope} />
        </div>
      </div>
    </>
  );
}

function NotificationItem({
  n,
  now,
  onOpen,
  onNavigate,
}: {
  n: NotificationDto;
  now: number;
  onOpen: (id: string) => void;
  onNavigate: () => void;
}) {
  const Icon = TONE_ICON[n.tone];
  const unread = !n.readAt;
  const link = safeLink(n.link);
  const content = (
    <>
      <span className={clsx('mt-0.5 shrink-0', TONE_COLOR[n.tone])}>
        <Icon className="size-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className={clsx('block text-sm', unread ? 'font-bold text-ink' : 'font-medium text-ink-2')}>
          {n.title}
        </span>
        {n.body && <span className="mt-0.5 block text-xs text-muted">{n.body}</span>}
        <time
          dateTime={n.createdAt}
          title={new Date(n.createdAt).toLocaleString()}
          className="mt-1 block text-xs text-muted"
        >
          {relativeTime(n.createdAt, now)}
        </time>
      </span>
      {unread && (
        <span className="mt-1.5 shrink-0">
          <span aria-hidden className="block size-2 bg-accent ring-1 ring-line-strong rounded-full" />
          <span className="sr-only">Unread</span>
        </span>
      )}
    </>
  );
  const cls = clsx(
    'flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-surface-2 focus-visible:bg-surface-2',
    unread && 'bg-accent-soft/40',
  );

  return (
    <li>
      {link ? (
        <Link
          href={link}
          className={cls}
          onClick={() => {
            if (unread) onOpen(n.id);
            onNavigate();
          }}
        >
          {content}
        </Link>
      ) : (
        <button type="button" className={cls} onClick={() => unread && onOpen(n.id)}>
          {content}
        </button>
      )}
    </li>
  );
}
