'use client';
import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import QRCode from 'qrcode';
import type { CreateEnrollmentTokenInput, EnrollmentToken } from '@classiq/shared';
import { Button, ButtonLink, Dialog, Field, InlineError, Input, Select, Skeleton, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { adminKeys, fieldErrorsOf, formLevelError, useRooms } from '../queries';
import { Callout, CopyButton, SecretValue } from '../common';

/** "Room 101 Pi" → "room-101-pi"; always matches the device id pattern ^[a-z0-9][a-z0-9-]{2,63}$. */
export function suggestDeviceId(name: string): string {
  let slug = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
    .replace(/-+$/g, '');
  if (!slug) slug = 'classroom-device';
  if (slug.length < 3) slug = `${slug}-pi`;
  return slug;
}

const INSTALL_COMMANDS = 'sudo ./install.sh\nsudo systemctl enable --now classpulse-agent';

function CodeBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <p className="eyebrow">{label}</p>
        <CopyButton value={value} label={`Copy ${label}`} variant="ghost">
          Copy
        </CopyButton>
      </div>
      <pre className="overflow-x-auto border border-line bg-surface-2 p-3 font-mono text-xs leading-relaxed text-ink rounded-control">
        <code>{value}</code>
      </pre>
    </div>
  );
}

function TokenQr({ token }: { token: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(token, { margin: 1, width: 192, errorCorrectionLevel: 'M' })
      .then((url) => !cancelled && setSrc(url))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [token]);
  if (failed) return <p className="text-xs text-muted">QR code unavailable — copy the token instead.</p>;
  if (!src) return <Skeleton className="size-48" />;
  return <img src={src} alt="QR code of the enrollment token" width={192} height={192} className="size-48 border border-line-strong bg-surface" />;
}

function EnrollmentResult({ result, onClose }: { result: EnrollmentToken; onClose: () => void }) {
  // Only rendered in the browser after the token is created, so window is available.
  const origin = window.location.origin;
  const config = JSON.stringify(
    {
      server_url: origin,
      device_id: suggestDeviceId(result.name),
      enrollment_token: result.token,
      alsa_device: 'default',
    },
    null,
    2,
  );

  return (
    <Dialog
      open
      onClose={onClose}
      title="Enrollment token created"
      description={`${result.name} · ${result.room.name}`}
      size="lg"
      footer={<Button onClick={onClose}>Done</Button>}
    >
      <div className="flex flex-col gap-5">
        <Callout title="This token is shown only once">
          Copy it (or the config below) now. It expires {formatDateTime(result.expiresAt)} and can be used to register one device.
        </Callout>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <TokenQr token={result.token} />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <p className="eyebrow">Enrollment token</p>
            <SecretValue value={result.token} label="Enrollment token" />
            <p className="text-xs text-muted">Expires {formatDateTime(result.expiresAt)}</p>
          </div>
        </div>

        <ol className="flex list-decimal flex-col gap-4 pl-5 text-sm">
          <li>
            <p className="mb-2">
              On the Raspberry Pi, copy the <code className="font-mono">classroom-agent</code> folder and run the installer:
            </p>
            <CodeBlock label="install commands" value={INSTALL_COMMANDS} />
          </li>
          <li>
            <p className="mb-2">
              Write this to <code className="font-mono">/etc/classpulse/agent.json</code> (change <code className="font-mono">alsa_device</code> if the
              USB microphone isn’t the default input):
            </p>
            <CodeBlock label="agent.json" value={config} />
          </li>
          <li>
            Restart the agent with <code className="font-mono">sudo systemctl restart classpulse-agent</code>. The device registers itself and appears
            in the devices list within a minute.
          </li>
        </ol>
      </div>
    </Dialog>
  );
}

/** Room + name → POST /admin/devices/enrollment-tokens → token, QR and setup instructions (shown once). */
export function EnrollDeviceDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const rooms = useRooms();
  const [roomId, setRoomId] = useState('');
  const [name, setName] = useState('');

  const create = useMutation({
    mutationFn: (body: CreateEnrollmentTokenInput) => api.post<EnrollmentToken>('/admin/devices/enrollment-tokens', body),
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: adminKeys.devices });
      toast(`Enrollment token created for ${res.name}`);
    },
  });

  if (create.data) return <EnrollmentResult result={create.data} onClose={onClose} />;

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    create.mutate({ roomId, name: name.trim() });
  }

  const fe = fieldErrorsOf(create.error);
  const noRooms = rooms.data?.length === 0;
  return (
    <Dialog
      open
      onClose={onClose}
      title="Add classroom device"
      description="Creates a one-time enrollment token for a Raspberry Pi recorder installed in a room."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="enroll-form" loading={create.isPending} disabled={!roomId || !name.trim()}>
            Create enrollment token
          </Button>
        </>
      }
    >
      {noRooms ? (
        <div className="flex flex-col items-start gap-3">
          <p className="text-sm text-muted">Devices are installed in rooms. Add a room first.</p>
          <ButtonLink href="/admin/rooms">Go to rooms</ButtonLink>
        </div>
      ) : (
        <form id="enroll-form" onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <Field label="Room" required error={fe.roomId ?? (rooms.error ? 'Could not load rooms' : undefined)}>
            {(p) => (
              <Select {...p} value={roomId} onChange={(e) => setRoomId(e.target.value)} disabled={rooms.isPending}>
                <option value="">Choose a room…</option>
                {rooms.data?.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                    {r.deviceCount > 0 ? ` (${r.deviceCount} device${r.deviceCount === 1 ? '' : 's'})` : ''}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field
            label="Device name"
            required
            error={fe.name}
            hint={name.trim() ? `Suggested device ID: ${suggestDeviceId(name)}` : 'e.g. Room 101 recorder'}
          >
            {(p) => <Input {...p} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />}
          </Field>
          <InlineError error={formLevelError(create.error, ['roomId', 'name'])} />
        </form>
      )}
    </Dialog>
  );
}
