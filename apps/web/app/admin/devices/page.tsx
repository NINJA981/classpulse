'use client';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Cpu, Plus, ShieldOff } from 'lucide-react';
import type { Device, DeviceStatus } from '@classpulse/shared';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingBlock,
  PageHeader,
  Spinner,
  StatusDot,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
  useToast,
} from '@/components/ui';
import { api } from '@/lib/api';
import { formatDateTime, formatRelative } from '@/lib/format';
import { adminKeys } from '@/components/admin/queries';
import { ConfirmDialog } from '@/components/admin/common';
import { EnrollDeviceDialog } from '@/components/admin/devices/enroll-dialog';

const STATUS: Record<DeviceStatus, { tone: 'success' | 'warning' | 'danger' | 'neutral'; label: string }> = {
  online: { tone: 'success', label: 'Online' },
  recording: { tone: 'warning', label: 'Recording' },
  offline: { tone: 'neutral', label: 'Offline' },
  error: { tone: 'danger', label: 'Error' },
};

function formatDisk(mb: number | null | undefined): string {
  if (mb == null) return '—';
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${Math.round(mb)} MB`;
}

export default function DevicesPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [enrolling, setEnrolling] = useState(false);
  const [revoking, setRevoking] = useState<Device | null>(null);

  const devices = useQuery({
    queryKey: adminKeys.devices,
    queryFn: ({ signal }) => api.get<Device[]>('/admin/devices', undefined, signal),
    refetchInterval: 15_000,
  });

  const revoke = useMutation({
    mutationFn: (d: Device) => api.delete(`/admin/devices/${d.id}`),
    onSuccess: (_, d) => {
      void qc.invalidateQueries({ queryKey: adminKeys.devices });
      void qc.invalidateQueries({ queryKey: adminKeys.rooms });
      void qc.invalidateQueries({ queryKey: adminKeys.overview });
      toast(`Device “${d.name}” revoked`);
      setRevoking(null);
    },
  });

  const addButton = (
    <Button icon={<Plus className="size-4" aria-hidden />} onClick={() => setEnrolling(true)}>
      Add classroom device
    </Button>
  );

  return (
    <>
      <PageHeader
        eyebrow="Hardware"
        title="Classroom devices"
        description="Raspberry Pi recorders installed in rooms. Status refreshes every 15 seconds."
        actions={addButton}
      />
      <Card>
        {devices.isPending ? (
          <LoadingBlock label="Loading devices…" />
        ) : devices.error && !devices.data ? (
          <ErrorState error={devices.error} onRetry={() => devices.refetch()} />
        ) : devices.data.length === 0 ? (
          <EmptyState
            icon={<Cpu className="size-8" aria-hidden />}
            title="No classroom devices yet"
            description="Add a device to get an enrollment token, then install the ClassPulse agent on the Raspberry Pi in that room."
            action={addButton}
          />
        ) : (
          <div className="relative">
            {devices.isFetching && (
              <span className="absolute right-3 top-2">
                <Spinner className="size-4" label="Refreshing" />
              </span>
            )}
            {devices.error && (
              <p role="alert" className="border-b border-line bg-danger-soft px-4 py-2 text-xs font-semibold text-danger">
                Couldn’t refresh device status. Showing the last known values.
              </p>
            )}
            <Table>
              <THead>
                <tr>
                  <TH>Device</TH>
                  <TH>Room</TH>
                  <TH>Status</TH>
                  <TH>Last heartbeat</TH>
                  <TH className="text-right">CPU temp</TH>
                  <TH className="text-right">Disk free</TH>
                  <TH>Mic</TH>
                  <TH className="text-right">Upload backlog</TH>
                  <TH>Agent</TH>
                  <TH>
                    <span className="sr-only">Actions</span>
                  </TH>
                </tr>
              </THead>
              <TBody>
                {devices.data.map((d) => {
                  const st = STATUS[d.status] ?? STATUS.offline;
                  return (
                    <TR key={d.id}>
                      <TD>
                        <p className="font-semibold">{d.name}</p>
                        <p className="font-mono text-xs text-muted">{d.deviceId}</p>
                        {d.stats?.lastError && (
                          <p className="mt-1 max-w-64 text-xs font-semibold text-danger" title={d.stats.lastError}>
                            {d.stats.lastError}
                          </p>
                        )}
                      </TD>
                      <TD className="text-ink-2">{d.room.name}</TD>
                      <TD>
                        <StatusDot tone={st.tone} label={st.label} />
                      </TD>
                      <TD className="whitespace-nowrap text-ink-2">
                        <time dateTime={d.lastHeartbeatAt ?? undefined} title={formatDateTime(d.lastHeartbeatAt)}>
                          {formatRelative(d.lastHeartbeatAt)}
                        </time>
                      </TD>
                      <TD className="text-right tabular-nums">{d.stats?.cpuTempC != null ? `${Math.round(d.stats.cpuTempC)} °C` : '—'}</TD>
                      <TD className="text-right tabular-nums">{formatDisk(d.stats?.diskFreeMb)}</TD>
                      <TD>
                        {!d.stats ? (
                          <span className="text-muted">—</span>
                        ) : d.stats.micOk ? (
                          <Badge tone="success">OK</Badge>
                        ) : (
                          <Badge tone="danger">No mic</Badge>
                        )}
                        {d.stats?.micName && <p className="mt-0.5 max-w-40 truncate text-xs text-muted">{d.stats.micName}</p>}
                      </TD>
                      <TD className="text-right tabular-nums">
                        {d.stats ? (
                          d.stats.backlogChunks > 0 ? (
                            <Badge tone="warning">{d.stats.backlogChunks} chunks</Badge>
                          ) : (
                            '0'
                          )
                        ) : (
                          '—'
                        )}
                      </TD>
                      <TD className="font-mono text-xs">{d.agentVersion ?? '—'}</TD>
                      <TD>
                        <div className="flex justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={<ShieldOff className="size-3.5" aria-hidden />}
                            aria-label={`Revoke device ${d.name}`}
                            onClick={() => {
                              revoke.reset();
                              setRevoking(d);
                            }}
                          >
                            Revoke
                          </Button>
                        </div>
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          </div>
        )}
      </Card>

      {enrolling && <EnrollDeviceDialog onClose={() => setEnrolling(false)} />}
      <ConfirmDialog
        open={revoking !== null}
        onClose={() => setRevoking(null)}
        title="Revoke device?"
        description={
          revoking && (
            <>
              <strong>{revoking.name}</strong> ({revoking.deviceId}) in {revoking.room.name} will lose access immediately. To use it
              again you will need a new enrollment token.
              {revoking.activeRecordingId && (
                <span className="mt-2 block font-semibold text-danger">This device is recording right now.</span>
              )}
            </>
          )
        }
        confirmLabel="Revoke device"
        onConfirm={() => revoking && revoke.mutate(revoking)}
        pending={revoke.isPending}
        error={revoke.error}
      />
    </>
  );
}
