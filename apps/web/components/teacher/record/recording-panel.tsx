'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Loader2, Square, XCircle } from 'lucide-react';
import type { RecordingSession, RecordingStatus } from '@classpulse/shared';
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  CardBody,
  CardHeader,
  ErrorState,
  InlineError,
  LoadingBlock,
  useToast,
  type BadgeTone,
} from '@/components/ui';
import { api } from '@/lib/api';
import { formatDateTime, formatDuration } from '@/lib/format';
import { ConfirmDialog } from '@/components/teacher/common';
import { DeviceStatusDot, RECORDING_TERMINAL } from '@/components/teacher/status';
import { useNow, useRecordingEvents } from '@/components/teacher/hooks';

const STATUS: Record<RecordingStatus, { label: string; tone: BadgeTone }> = {
  pending: { label: 'Waiting for device', tone: 'info' },
  recording: { label: 'Recording', tone: 'danger' },
  stopping: { label: 'Uploading', tone: 'warning' },
  finalized: { label: 'Finished', tone: 'success' },
  failed: { label: 'Failed', tone: 'danger' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
};

/** Live status of a classroom-device recording, with Stop / Cancel. */
export function RecordingPanel({ recordingId, onNew }: { recordingId: string; onNew: () => void }) {
  const qc = useQueryClient();
  const router = useRouter();
  const toast = useToast();
  const key = ['recordings', recordingId];

  const q = useQuery({
    queryKey: key,
    queryFn: () => api.get<RecordingSession>(`/recordings/${recordingId}`),
    refetchInterval: (query) => {
      const s = query.state.data?.status;
      return s && RECORDING_TERMINAL.includes(s) ? false : 3000;
    },
  });

  const session = q.data;
  const terminal = session ? RECORDING_TERMINAL.includes(session.status) : false;

  useRecordingEvents((s) => {
    if (s.id === recordingId) qc.setQueryData(key, s);
  }, !terminal);

  // Redirect to the lesson once the audio is assembled (only when we saw the transition).
  const prevStatus = useRef<RecordingStatus | undefined>(undefined);
  useEffect(() => {
    if (!session) return;
    const prev = prevStatus.current;
    prevStatus.current = session.status;
    if (prev && prev !== 'finalized' && session.status === 'finalized') {
      toast('Recording saved. Transcribing the class…');
      qc.invalidateQueries({ queryKey: ['lessons'] });
      router.push(`/teacher/lessons/${session.lessonId}`);
    }
  }, [session, router, toast, qc]);

  const [confirm, setConfirm] = useState<'stop' | 'cancel' | null>(null);
  const action = useMutation({
    mutationFn: (kind: 'stop' | 'cancel') => api.post<RecordingSession>(`/recordings/${recordingId}/${kind}`),
    onSuccess: (s, kind) => {
      qc.setQueryData(key, s);
      setConfirm(null);
      toast(kind === 'stop' ? 'Recording stopped. Uploading the remaining audio…' : 'Recording cancelled.');
    },
  });

  const now = useNow(1000, session?.status === 'recording');

  if (q.isPending) return <LoadingBlock label="Loading recording…" />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const s = q.data;

  const startedMs = s.startedAt ? new Date(s.startedAt).getTime() : null;
  const endMs = s.stoppedAt ? new Date(s.stoppedAt).getTime() : now;
  const elapsedSec = startedMs ? (endMs - startedMs) / 1000 : null;
  const st = STATUS[s.status];
  const canStop = s.status === 'recording' || s.status === 'pending';
  const canCancel = s.status === 'pending' || s.status === 'recording' || s.status === 'stopping';

  return (
    <Card>
      <CardHeader
        eyebrow="Classroom recording"
        title={
          <span className="flex flex-wrap items-center gap-3">
            {s.device.name}
            <Badge tone={st.tone}>{st.label}</Badge>
          </span>
        }
        actions={<DeviceStatusDot status={s.device.status} />}
      />
      <CardBody className="space-y-6">
        <div aria-live="polite" className="border border-line bg-surface-2 p-6 text-center rounded-card">
          {s.status === 'pending' && (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="size-8 animate-spin text-muted" aria-hidden />
              <p className="font-display text-xl font-extrabold">Waiting for the classroom device…</p>
              <p className="text-sm text-muted">The device picks up the start command within a few seconds.</p>
            </div>
          )}
          {s.status === 'recording' && (
            <div className="flex flex-col items-center gap-2">
              <p className="inline-flex items-center gap-2 text-sm font-bold text-danger">
                <span className="size-2.5 animate-pulse rounded-full bg-danger" aria-hidden /> Recording
              </p>
              <p className="font-display text-6xl font-black tabular-nums" aria-label="Elapsed time">
                {formatDuration(elapsedSec ?? 0)}
              </p>
              <p className="text-sm text-muted">Teach as usual. Stop the recording when the class is over.</p>
            </div>
          )}
          {s.status === 'stopping' && (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="size-8 animate-spin text-muted" aria-hidden />
              <p className="font-display text-xl font-extrabold">Uploading remaining audio…</p>
              <p className="text-sm text-muted">
                The device is sending the last parts of the recording. You can leave this page; the lesson will continue
                processing.
              </p>
            </div>
          )}
          {s.status === 'finalized' && (
            <div className="flex flex-col items-center gap-3">
              <CheckCircle2 className="size-8 text-success" aria-hidden />
              <p className="font-display text-xl font-extrabold">Recording saved</p>
              <p className="text-sm text-muted">The class is being transcribed. Then choose the quiz settings on the lesson page.</p>
              <ButtonLink href={`/teacher/lessons/${s.lessonId}`}>Open the lesson</ButtonLink>
            </div>
          )}
          {s.status === 'failed' && (
            <div className="flex flex-col items-center gap-3">
              <XCircle className="size-8 text-danger" aria-hidden />
              <p className="font-display text-xl font-extrabold">The recording failed</p>
              <p className="max-w-md text-sm text-danger">{s.failureReason ?? 'The device reported an error.'}</p>
            </div>
          )}
          {s.status === 'cancelled' && (
            <div className="flex flex-col items-center gap-3">
              <XCircle className="size-8 text-muted" aria-hidden />
              <p className="font-display text-xl font-extrabold">Recording cancelled</p>
            </div>
          )}
        </div>

        <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <div>
            <dt className="eyebrow">Chunks received</dt>
            <dd className="mt-1 font-bold tabular-nums">
              {s.chunksReceived}
              {s.expectedChunks != null ? ` / ${s.expectedChunks}` : ''}
            </dd>
          </div>
          <div>
            <dt className="eyebrow">Duration</dt>
            <dd className="mt-1 font-bold tabular-nums">{formatDuration(elapsedSec)}</dd>
          </div>
          <div>
            <dt className="eyebrow">Started</dt>
            <dd className="mt-1 font-bold">{formatDateTime(s.startedAt)}</dd>
          </div>
          <div>
            <dt className="eyebrow">Stopped</dt>
            <dd className="mt-1 font-bold">{formatDateTime(s.stoppedAt)}</dd>
          </div>
        </dl>

        <div className="flex flex-wrap gap-2">
          {canStop && (
            <Button variant="danger" size="lg" icon={<Square className="size-4" aria-hidden />} onClick={() => setConfirm('stop')}>
              Stop recording
            </Button>
          )}
          {canCancel && (
            <Button variant="secondary" size="lg" onClick={() => setConfirm('cancel')}>
              Cancel recording
            </Button>
          )}
          {(s.status === 'failed' || s.status === 'cancelled') && (
            <>
              <Button onClick={onNew}>Record another class</Button>
              <ButtonLink variant="secondary" href={`/teacher/lessons/${s.lessonId}`}>
                Open the lesson
              </ButtonLink>
            </>
          )}
          {s.status === 'finalized' && (
            <Button variant="secondary" onClick={onNew}>
              Record another class
            </Button>
          )}
        </div>
        {!confirm && <InlineError error={action.error} />}
      </CardBody>

      <ConfirmDialog
        open={confirm === 'stop'}
        onClose={() => setConfirm(null)}
        title="Stop the recording?"
        description="The device will upload any remaining audio, then the class is transcribed automatically. You choose the quiz settings afterwards."
        confirmLabel="Stop and upload"
        danger
        loading={action.isPending}
        error={action.error}
        onConfirm={() => action.mutate('stop')}
      />
      <ConfirmDialog
        open={confirm === 'cancel'}
        onClose={() => setConfirm(null)}
        title="Cancel the recording?"
        description="The audio recorded so far is discarded and the lesson is marked as failed. This cannot be undone."
        confirmLabel="Discard recording"
        danger
        loading={action.isPending}
        error={action.error}
        onConfirm={() => action.mutate('cancel')}
      />
    </Card>
  );
}
