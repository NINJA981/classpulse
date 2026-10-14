'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CatalogEntry, CourseDetail } from '@classiq/shared';
import { Button, Dialog, EmptyState, ErrorState, Field, InlineError, Input, LoadingBlock, Select } from '@/components/ui';
import { api } from '@/lib/api';

/** Browse the built-in syllabus starter lists (NCERT/CBSE chapters, college outlines) and import one as a course. */
export function CatalogDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const qc = useQueryClient();
  const [level, setLevel] = useState('');
  const [board, setBoard] = useState('');
  const [subject, setSubject] = useState('');
  const catalog = useQuery({ queryKey: ['curriculum', 'catalog'], queryFn: () => api.get<CatalogEntry[]>('/curriculum/catalog'), enabled: open });

  const levels = useMemo(() => [...new Set((catalog.data ?? []).map((e) => e.level))], [catalog.data]);
  const boards = useMemo(() => [...new Set((catalog.data ?? []).map((e) => e.board))], [catalog.data]);
  const entries = (catalog.data ?? []).filter(
    (e) => (!level || e.level === level) && (!board || e.board === board) && (!subject.trim() || e.subject.toLowerCase().includes(subject.trim().toLowerCase())),
  );

  const importEntry = useMutation({
    mutationFn: (key: string) => api.post<CourseDetail>(`/curriculum/catalog/${key}/import`, {}),
    onSuccess: (course) => {
      void qc.invalidateQueries({ queryKey: ['curriculum', 'courses'] });
      onClose();
      router.push(`/teacher/courses/${course.id}`);
    },
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      title="Import from catalog"
      description="Starter chapter lists from current NCERT/CBSE textbooks and generic college outlines. You can edit everything after importing."
    >
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Field label="Level">
          {(p) => (
            <Select {...p} value={level} onChange={(e) => setLevel(e.target.value)}>
              <option value="">All levels</option>
              {levels.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Board">
          {(p) => (
            <Select {...p} value={board} onChange={(e) => setBoard(e.target.value)}>
              <option value="">All boards</option>
              {boards.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Subject">{(p) => <Input {...p} type="search" value={subject} onChange={(e) => setSubject(e.target.value)} />}</Field>
      </div>
      <InlineError error={importEntry.error} />
      {catalog.isPending ? (
        <LoadingBlock label="Loading catalog…" />
      ) : catalog.isError ? (
        <ErrorState error={catalog.error} onRetry={() => void catalog.refetch()} />
      ) : entries.length === 0 ? (
        <EmptyState title="No catalog entries match" description="Try another level, board or subject — or create your own course." />
      ) : (
        <ul className="divide-y divide-line border border-line rounded-card">
          {entries.map((e) => (
            <li key={e.key} className="flex flex-wrap items-start justify-between gap-3 p-3">
              <details className="min-w-0 flex-1">
                <summary className="cursor-pointer">
                  <span className="font-bold">{e.title}</span>
                  <span className="block text-xs text-muted">
                    {e.level} · {e.board} · {e.units.length} units
                  </span>
                </summary>
                <ol className="mt-2 list-decimal space-y-0.5 pl-5 text-xs text-ink-2">
                  {e.units.map((u) => (
                    <li key={u}>{u}</li>
                  ))}
                </ol>
              </details>
              <Button
                size="sm"
                variant="secondary"
                aria-label={`Import ${e.title}`}
                loading={importEntry.isPending && importEntry.variables === e.key}
                disabled={importEntry.isPending}
                onClick={() => importEntry.mutate(e.key)}
              >
                Import
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  );
}
