import { Badge, type BadgeTone } from '@/components/ui';

const LABELS: Record<string, string> = {
  draft: 'Draft',
  recording: 'Recording',
  queued: 'Queued',
  transcribing: 'Transcribing',
  generating: 'Generating',
  ready_for_review: 'In review',
  published: 'Published',
  failed: 'Failed',
};

const TONES: Record<string, BadgeTone> = {
  draft: 'neutral',
  recording: 'warning',
  queued: 'info',
  transcribing: 'info',
  generating: 'info',
  ready_for_review: 'accent',
  published: 'success',
  failed: 'danger',
};

export const lessonStatusLabel = (status: string) => LABELS[status] ?? status.replace(/_/g, ' ');

export function LessonStatusBadge({ status }: { status: string }) {
  return <Badge tone={TONES[status] ?? 'neutral'}>{lessonStatusLabel(status)}</Badge>;
}
