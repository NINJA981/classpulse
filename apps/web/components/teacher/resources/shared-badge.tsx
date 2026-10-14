import { Users } from 'lucide-react';
import type { ResourceSummary } from '@classiq/shared';
import { Badge } from '@/components/ui';

/**
 * Owner line + "Shared with school" badge for a teaching resource (library lists, resource header).
 * Pass `mine` (ResourceDetail.mine, or compare with the signed-in user) to show "By you".
 */
export function SharedBadge({
  resource,
  mine,
  className,
}: {
  resource: Pick<ResourceSummary, 'teacher' | 'shared'>;
  mine?: boolean;
  className?: string;
}) {
  return (
    <span className={['inline-flex flex-wrap items-center gap-2', className].filter(Boolean).join(' ')}>
      <span className="text-xs text-muted">
        By <span className="font-bold text-ink-2">{mine ? 'you' : resource.teacher.name}</span>
      </span>
      {resource.shared && (
        <Badge tone="accent">
          <Users className="size-3" aria-hidden />
          Shared with school
        </Badge>
      )}
    </span>
  );
}
