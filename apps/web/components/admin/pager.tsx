'use client';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui';

/** Previous / next page controls for a `Paginated<T>` result. */
export function Pager({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-3 text-xs text-muted">
      <span aria-live="polite">
        {from}–{to} of {total} · Page {page} of {pages}
      </span>
      <span className="flex gap-1">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onPage(page - 1)}
          disabled={page <= 1}
          icon={<ChevronLeft className="size-3.5" aria-hidden />}
        >
          Previous
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onPage(page + 1)}
          disabled={page >= pages}
          icon={<ChevronRight className="size-3.5" aria-hidden />}
        >
          Next
        </Button>
      </span>
    </nav>
  );
}
