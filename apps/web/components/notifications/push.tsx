'use client';
import { useCallback, useEffect, useId, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  isAllowedPushEndpoint,
  type NotificationPrefs,
  type PushKeyResponse,
  type PushSubscriptionInput,
} from '@classpulse/shared';
import { ApiError, api } from '@/lib/api';
import { notificationBase, notificationKeys, type NotificationScope } from './shared';

/** Why this device can't (yet) receive push, or null when it can. */
type Blocker = 'unsupported' | 'ios-install' | 'no-worker' | 'server-off' | 'denied' | null;

type DeviceState =
  | { checking: true }
  | {
      checking: false;
      registration: ServiceWorkerRegistration | null;
      subscription: PushSubscription | null;
    };

function isIos(): boolean {
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1);
}

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

const pushSupported = () =>
  'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

class PushTimeout extends Error {}

/** VAPID public key (base64url) → bytes for `applicationServerKey`. */
function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const padded = (base64url + '='.repeat((4 - (base64url.length % 4)) % 4))
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const raw = atob(padded);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

/** The service worker registration, if one is (or becomes, within a few seconds) active. */
async function findRegistration(): Promise<ServiceWorkerRegistration | null> {
  const existing = await navigator.serviceWorker.getRegistration('/').catch(() => undefined);
  if (existing) return existing;
  return Promise.race([
    navigator.serviceWorker.ready.catch(() => null),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000)),
  ]);
}

/** Toggle for Web Push on this device ("Notify me on this device"). */
export function PushToggle({ scope }: { scope: NotificationScope }) {
  const qc = useQueryClient();
  const base = notificationBase(scope);
  const labelId = useId();
  const [device, setDevice] = useState<DeviceState>({ checking: true });
  const [permission, setPermission] = useState<NotificationPermission | null>(null);
  const [env, setEnv] = useState<{ supported: boolean; iosNeedsInstall: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const key = useQuery({
    queryKey: notificationKeys.pushKey(scope),
    queryFn: () => api.get<PushKeyResponse>(`${base}/push-key`),
    staleTime: Infinity,
    retry: false,
  });
  const prefs = useQuery({
    queryKey: notificationKeys.prefs(scope),
    queryFn: () => api.get<NotificationPrefs>(`${base}/prefs`),
    staleTime: 5 * 60_000,
    retry: false,
  });

  const refreshDevice = useCallback(async () => {
    if (!pushSupported()) {
      setDevice({ checking: false, registration: null, subscription: null });
      return;
    }
    const registration = await findRegistration();
    const subscription = registration
      ? await registration.pushManager.getSubscription().catch(() => null)
      : null;
    setDevice({ checking: false, registration, subscription });
  }, []);

  useEffect(() => {
    const ios = isIos();
    setEnv({ supported: pushSupported(), iosNeedsInstall: ios && !isStandalone() });
    if ('Notification' in window) setPermission(Notification.permission);
    void refreshDevice();
  }, [refreshDevice]);

  if (!env || device.checking || key.isPending) {
    return <PushRow labelId={labelId} checked={false} hideSwitch note="Checking this device…" />;
  }

  const publicKey = key.data?.publicKey ?? null;
  const blocker: Blocker = env.iosNeedsInstall
    ? 'ios-install'
    : !env.supported
      ? 'unsupported'
      : !publicKey
        ? 'server-off'
        : !device.registration
          ? 'no-worker'
          : permission === 'denied'
            ? 'denied'
            : null;

  const on =
    blocker === null &&
    permission === 'granted' &&
    device.subscription !== null &&
    prefs.data?.push !== false;

  const BLOCKER_COPY: Record<Exclude<Blocker, null>, string> = {
    'ios-install':
      'On iPhone or iPad, add ClassPulse to your Home Screen first: tap Share, then Add to Home Screen. Open it from there and turn this on.',
    unsupported: "This browser can't show notifications. Try Chrome, Edge, Firefox or Safari.",
    'server-off': "Phone and desktop alerts aren't set up on this server yet.",
    'no-worker': "Alerts can't start on this page. Reload the page and try again.",
    denied:
      "Notifications are blocked for this site. Allow them in your browser's site settings, then reload the page.",
  };

  async function savePrefs(push: boolean) {
    const next = await api
      .put<NotificationPrefs>(`${base}/prefs`, { push } satisfies NotificationPrefs)
      .catch(() => null);
    qc.setQueryData(notificationKeys.prefs(scope), next ?? { push });
  }

  async function enable() {
    if (device.checking || !device.registration || !publicKey) return;
    const registration = device.registration;
    // Ask only now, on the person's click.
    const result =
      Notification.permission === 'default'
        ? await Notification.requestPermission()
        : Notification.permission;
    setPermission(result);
    if (result !== 'granted') {
      setMessage(result === 'denied' ? null : 'Allow notifications when your browser asks, then try again.');
      return;
    }
    const applicationServerKey = keyBytes(publicKey);
    let sub = await registration.pushManager.getSubscription();
    // A subscription made with an older server key can't be reused.
    if (sub && sub.options.applicationServerKey) {
      const current = new Uint8Array(sub.options.applicationServerKey);
      const same =
        current.length === applicationServerKey.length &&
        current.every((b, i) => b === applicationServerKey[i]);
      if (!same) {
        await sub.unsubscribe().catch(() => undefined);
        sub = null;
      }
    }
    // The browser's push service can hang (offline, blocked network): give up after 30 s.
    sub ??= await Promise.race([
      registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new PushTimeout()), 30_000)),
    ]);
    const unsupported = async (s: PushSubscription) => {
      // Not one of the push services the server accepts: don't leave a dangling local subscription.
      await s.unsubscribe().catch(() => undefined);
      setMessage("This browser's push service isn't supported. You'll still see notifications here.");
    };
    if (!isAllowedPushEndpoint(sub.endpoint)) {
      await unsupported(sub);
      return;
    }
    const json = sub.toJSON();
    const body: PushSubscriptionInput = {
      endpoint: sub.endpoint,
      expirationTime: sub.expirationTime ?? null,
      keys: { p256dh: json.keys?.p256dh ?? '', auth: json.keys?.auth ?? '' },
    };
    try {
      await api.post(`${base}/push-subscriptions`, body);
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) {
        await unsupported(sub);
        return;
      }
      throw err;
    }
    // The account switch must be on for any device to get pushes; it is only ever turned on from here.
    if (prefs.data?.push !== true) await savePrefs(true);
  }

  /** This device only: the person's other devices keep getting alerts (the account switch is left alone). */
  async function disable() {
    if (device.checking) return;
    const sub = device.subscription ?? (await device.registration?.pushManager.getSubscription()) ?? null;
    if (sub) {
      await api.delete(`${base}/push-subscriptions`, { endpoint: sub.endpoint }).catch(() => undefined);
      await sub.unsubscribe().catch(() => undefined);
    }
  }

  async function toggle() {
    setBusy(true);
    setMessage(null);
    try {
      if (on) await disable();
      else await enable();
    } catch (err) {
      setMessage(
        err instanceof ApiError && err.status === 429
          ? 'Too many changes in a short time. Try again in a few minutes.'
          : err instanceof PushTimeout
            ? "Couldn't reach your browser's push service. Check your connection and try again."
            : "Couldn't change alerts on this device. Try again.",
      );
    } finally {
      await refreshDevice();
      setBusy(false);
    }
  }

  const note =
    message ??
    (blocker
      ? BLOCKER_COPY[blocker]
      : on
        ? "On for this device. You'll get an alert here when a job finishes, even with ClassPulse closed."
        : 'Get an alert on this phone or computer when a job finishes, even with ClassPulse closed. Your other devices have their own setting.');

  return (
    <PushRow
      labelId={labelId}
      checked={on}
      disabled={busy}
      hideSwitch={blocker !== null && !on}
      busy={busy}
      onToggle={toggle}
      note={note}
      noteTone={message || blocker === 'denied' ? 'warn' : 'muted'}
    />
  );
}

function PushRow({
  labelId,
  checked,
  disabled,
  busy,
  onToggle,
  note,
  noteTone = 'muted',
  hideSwitch = false,
}: {
  labelId: string;
  checked: boolean;
  disabled?: boolean;
  busy?: boolean;
  onToggle?: () => void;
  note: string;
  noteTone?: 'muted' | 'warn';
  /** This device can't use push: show only the explanation. */
  hideSwitch?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p id={labelId} className="text-sm font-bold">
          Notify me on this device
        </p>
        <p
          className={clsx(
            'mt-0.5 text-xs',
            noteTone === 'warn' ? 'font-semibold text-warning' : 'text-muted',
          )}
        >
          {note}
        </p>
      </div>
      {!hideSwitch && (
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          aria-labelledby={labelId}
          aria-busy={busy || undefined}
          disabled={disabled}
          onClick={onToggle}
          className={clsx(
            'relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center border border-line-strong rounded-full transition-colors',
            'disabled:cursor-not-allowed disabled:opacity-50',
            checked ? 'bg-accent' : 'bg-surface-2',
          )}
        >
          <span
            aria-hidden
            className={clsx(
              'inline-block size-4 rounded-full border border-line-strong bg-surface transition-transform',
              checked ? 'translate-x-[22px]' : 'translate-x-[3px]',
            )}
          />
        </button>
      )}
    </div>
  );
}
