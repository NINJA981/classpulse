'use client';
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

export type ToastTone = 'success' | 'error' | 'info';

export interface ToastOptions {
  /** A link shown after the message, e.g. { label: 'Open', href: '/teacher/lessons/…' } (same-origin paths only). */
  action?: { label: string; href: string };
  /** Optional second line. */
  description?: string | null;
}

interface ToastItem extends ToastOptions {
  id: number;
  tone: ToastTone;
  message: string;
}

type PushToast = (message: string, tone?: ToastTone, options?: ToastOptions) => void;

const ToastContext = createContext<PushToast | null>(null);

/** In-app links only: exactly one leading '/'. */
const isLocalPath = (href: string) => href.startsWith('/') && !href.startsWith('//') && !href.includes('\\');

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const dismiss = useCallback((id: number) => setItems((xs) => xs.filter((x) => x.id !== id)), []);
  const push = useCallback<PushToast>(
    (message, tone = 'success', options) => {
      const id = Date.now() + Math.random();
      const action = options?.action && isLocalPath(options.action.href) ? options.action : undefined;
      setItems((xs) => [...xs, { id, tone, message, description: options?.description ?? null, action }]);
      // Toasts with something to click stay a little longer.
      setTimeout(() => dismiss(id), action ? 9000 : tone === 'error' ? 7000 : 4000);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div aria-live="polite" className="fixed bottom-4 right-4 z-[60] flex w-[min(380px,calc(100%-2rem))] flex-col gap-2">
        {items.map((t) => {
          const Icon = t.tone === 'success' ? CheckCircle2 : t.tone === 'error' ? AlertTriangle : Info;
          return (
            <div
              key={t.id}
              role={t.tone === 'error' ? 'alert' : 'status'}
              className={clsx(
                'flex items-start gap-3 border bg-surface px-4 py-3 text-sm font-semibold shadow-pop rounded-card',
                t.tone === 'error' ? 'border-danger text-danger' : 'border-line-strong text-ink',
              )}
            >
              <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
              <div className="min-w-0 flex-1">
                <p>{t.message}</p>
                {t.description && <p className="mt-0.5 text-xs font-medium text-muted">{t.description}</p>}
                {t.action && (
                  <Link
                    href={t.action.href}
                    onClick={() => dismiss(t.id)}
                    className="mt-2 inline-flex items-center border border-line-strong bg-accent px-2.5 py-1 text-xs font-bold text-accent-ink rounded-control hover:shadow-hard"
                  >
                    {t.action.label}
                  </Link>
                )}
              </div>
              {t.action && (
                <button
                  type="button"
                  onClick={() => dismiss(t.id)}
                  aria-label="Dismiss"
                  className="-m-1 p-1 text-muted hover:text-ink rounded-control"
                >
                  <X className="size-4" aria-hidden />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

/** `toast(message, tone?, { action?, description? })`. */
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}
