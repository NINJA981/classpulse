import {
  LESSON_PROCESSING_STATUSES,
  type DeviceStatus,
  type LessonStatus,
  type QuestionStatus,
  type RecordingStatus,
} from '@classpulse/shared';
import { Badge, StatusDot, type BadgeTone } from '@/components/ui';
import { formatRelative } from '@/lib/format';

export const LESSON_STATUS_LABEL: Record<LessonStatus, string> = {
  draft: 'Draft',
  recording: 'Recording',
  queued: 'Queued',
  transcribing: 'Transcribing',
  generating: 'Generating',
  ready_for_review: 'Needs review',
  published: 'Published',
  failed: 'Failed',
};

const LESSON_STATUS_TONE: Record<LessonStatus, BadgeTone> = {
  draft: 'neutral',
  recording: 'info',
  queued: 'info',
  transcribing: 'info',
  generating: 'info',
  ready_for_review: 'warning',
  published: 'success',
  failed: 'danger',
};

export function lessonStatusLabel(status: string): string {
  return LESSON_STATUS_LABEL[status as LessonStatus] ?? status;
}

export function isProcessing(status: LessonStatus): boolean {
  return LESSON_PROCESSING_STATUSES.includes(status);
}

export function LessonStatusBadge({ status }: { status: string }) {
  return <Badge tone={LESSON_STATUS_TONE[status as LessonStatus] ?? 'neutral'}>{lessonStatusLabel(status)}</Badge>;
}

const QUESTION_STATUS: Record<QuestionStatus, { label: string; tone: BadgeTone }> = {
  draft: { label: 'Pending review', tone: 'warning' },
  approved: { label: 'Approved', tone: 'success' },
  rejected: { label: 'Rejected', tone: 'danger' },
};

export function QuestionStatusBadge({ status }: { status: QuestionStatus }) {
  const s = QUESTION_STATUS[status];
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

export const RECORDING_TERMINAL: readonly RecordingStatus[] = ['finalized', 'failed', 'cancelled'];

const DEVICE_STATUS: Record<DeviceStatus, { label: string; tone: 'success' | 'warning' | 'danger' | 'neutral' }> = {
  online: { label: 'Online', tone: 'success' },
  recording: { label: 'Recording', tone: 'warning' },
  offline: { label: 'Offline', tone: 'neutral' },
  error: { label: 'Error', tone: 'danger' },
};

export function DeviceStatusDot({ status }: { status: DeviceStatus }) {
  const s = DEVICE_STATUS[status];
  return <StatusDot tone={s.tone} label={s.label} />;
}

export function heartbeatLabel(iso: string | null): string {
  return iso ? `Last heartbeat ${formatRelative(iso)}` : 'No heartbeat yet';
}

/** 0-based option index -> "A".."D". */
export const optionLetter = (i: number) => String.fromCharCode(65 + i);

/** ISO -> value for <input type="datetime-local"> in the browser's timezone. */
export function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
