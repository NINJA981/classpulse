'use client';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { AlertTriangle, Info, Wrench } from 'lucide-react';
import type { PlatformNotice, PlatformStatus } from '@classpulse/shared';
import { api } from '@/lib/api';

const BANNER_TONE = {
  info: 'border-line bg-info-soft text-ink',
  warning: 'border-warning/40 bg-warning-soft text-warning',
  critical: 'border-danger/40 bg-danger-soft text-danger',
} as const;

/** The platform banner and maintenance message (from /api/auth/me or /api/status). */
export function NoticeBanners({ notice, className }: { notice: PlatformNotice | null | undefined; className?: string }) {
  if (!notice?.banner && !notice?.maintenance) return null;
  return (
    <div className={clsx('flex flex-col gap-2', className)}>
      {notice.maintenance && (
        <p role="status" className="flex items-start gap-2 border border-warning/40 bg-warning-soft px-3 py-2 text-sm font-semibold text-warning rounded-control">
          <Wrench className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{notice.maintenance.message}</span>
        </p>
      )}
      {notice.banner && (
        <p role="status" className={clsx('flex items-start gap-2 border px-3 py-2 text-sm font-semibold rounded-control', BANNER_TONE[notice.banner.level])}>
          {notice.banner.level === 'info' ? (
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          ) : (
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          )}
          <span>{notice.banner.message}</span>
        </p>
      )}
    </div>
  );
}

/** Public platform status for the sign-in pages. Silent when the API can't be reached. */
export function LoginNotice({ className }: { className?: string }) {
  const { data } = useQuery({
    queryKey: ['status'],
    queryFn: () => api.get<PlatformStatus>('/status'),
    staleTime: 60_000,
    retry: false,
  });
  return <NoticeBanners notice={data} className={className} />;
}
