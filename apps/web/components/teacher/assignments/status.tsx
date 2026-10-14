import type { AssignmentStatus, TrackerStatus } from '@classiq/shared';
import { Badge, type BadgeTone } from '@/components/ui';

const ASSIGNMENT_STATUS: Record<AssignmentStatus, { label: string; tone: BadgeTone }> = {
  draft: { label: 'Draft', tone: 'neutral' },
  published: { label: 'Published', tone: 'success' },
  closed: { label: 'Closed', tone: 'solid' },
};

export const ASSIGNMENT_STATUS_LABEL: Record<AssignmentStatus, string> = {
  draft: 'Draft',
  published: 'Published',
  closed: 'Closed',
};

export function AssignmentStatusBadge({ status }: { status: AssignmentStatus }) {
  const s = ASSIGNMENT_STATUS[status];
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

const TRACKER: Record<TrackerStatus, { label: string; tone: BadgeTone }> = {
  missing: { label: 'Missing', tone: 'neutral' },
  submitted: { label: 'Submitted', tone: 'info' },
  late: { label: 'Late', tone: 'warning' },
  returned: { label: 'Returned', tone: 'success' },
};

export function TrackerBadge({ status }: { status: TrackerStatus }) {
  const s = TRACKER[status];
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

/** "12.5 / 15", or a dash when not graded. */
export const marksText = (total: number | null, max: number) => (total == null ? '—' : `${total} / ${max}`);
