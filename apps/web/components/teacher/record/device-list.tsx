'use client';
import Link from 'next/link';
import clsx from 'clsx';
import { Mic, MicOff } from 'lucide-react';
import type { Device } from '@classiq/shared';
import { DeviceStatusDot, heartbeatLabel } from '@/components/teacher/status';

/** Classroom devices for the chosen section, with health. Online devices are selectable. */
export function DeviceList({
  devices,
  selectedId,
  onSelect,
}: {
  devices: Device[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-xs font-bold text-ink-2">Classroom device</legend>
      <ul className="space-y-2">
        {devices.map((d) => {
          const usable = d.status === 'online';
          const micOk = d.stats?.micOk ?? false;
          return (
            <li key={d.id}>
              <label
                className={clsx(
                  'flex items-start gap-3 border p-3 rounded-control',
                  usable ? 'cursor-pointer border-line hover:bg-surface-2' : 'border-line opacity-80',
                  selectedId === d.id && 'border-line-strong bg-surface-2',
                )}
              >
                <input
                  type="radio"
                  name="device"
                  className="mt-1 size-4 accent-[var(--cp-ink)]"
                  checked={selectedId === d.id}
                  disabled={!usable}
                  onChange={() => onSelect(d.id)}
                />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="font-bold">{d.name}</span>
                    <DeviceStatusDot status={d.status} />
                    <span className={clsx('inline-flex items-center gap-1 text-xs font-semibold', micOk ? 'text-success' : 'text-danger')}>
                      {micOk ? <Mic className="size-3.5" aria-hidden /> : <MicOff className="size-3.5" aria-hidden />}
                      {d.stats ? (micOk ? 'Microphone OK' : 'Microphone not detected') : 'Microphone unknown'}
                    </span>
                  </span>
                  <span className="mt-1 block text-xs text-muted">
                    {d.room.name} · {heartbeatLabel(d.lastHeartbeatAt)}
                    {d.stats?.micName ? ` · ${d.stats.micName}` : ''}
                  </span>
                  {d.stats?.lastError && <span className="mt-1 block text-xs text-danger">Last error: {d.stats.lastError}</span>}
                  {d.status === 'recording' && d.activeRecordingId && (
                    <Link
                      href={`/teacher/record?recording=${d.activeRecordingId}`}
                      className="mt-1 inline-flex min-h-6 items-center text-xs font-bold underline underline-offset-4"
                    >
                      View the recording in progress
                    </Link>
                  )}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}
