import type { InviteStatus } from '@classiq/shared';
import { Badge, type BadgeTone } from '@/components/ui';

const LABELS: Record<InviteStatus, { label: string; tone: BadgeTone }> = {
  accepted: { label: 'Accepted', tone: 'success' },
  sent: { label: 'Email sent', tone: 'info' },
  queued: { label: 'Queued', tone: 'neutral' },
  failed: { label: 'Failed', tone: 'danger' },
  none: { label: 'Not sent', tone: 'neutral' },
};

/** Account invitation state for the teacher and student tables. */
export function InviteStatusBadge({ status }: { status: InviteStatus }) {
  const { label, tone } = LABELS[status];
  return <Badge tone={tone}>{label}</Badge>;
}
