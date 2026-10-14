'use client';
import { useCallback, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays } from 'lucide-react';
import type { TimetableSlot } from '@classiq/shared';
import { ButtonLink, Card, EmptyState, ErrorState, Field, LoadingBlock, PageHeader, Select } from '@/components/ui';
import { api } from '@/lib/api';
import { adminKeys, useRooms, useSections, useTeachers } from '@/components/admin/queries';
import { ConfirmDialog } from '@/components/admin/common';
import { TimetableEditor } from '@/components/admin/timetable/timetable-editor';

export default function TimetablePage() {
  const sections = useSections();
  const teachers = useTeachers();
  const rooms = useRooms();
  const [chosenId, setChosenId] = useState('');
  const [dirty, setDirty] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);

  // Default to the first section once the list loads.
  const sectionId = chosenId || sections.data?.[0]?.id || '';
  const section = sections.data?.find((s) => s.id === sectionId);

  const timetable = useQuery({
    queryKey: adminKeys.timetable(sectionId),
    queryFn: ({ signal }) => api.get<TimetableSlot[]>('/admin/timetable', { sectionId }, signal),
    enabled: Boolean(sectionId),
    // Don't refetch on focus while the admin may be editing the grid.
    refetchOnWindowFocus: false,
  });

  const onDirtyChange = useCallback((d: boolean) => setDirty(d), []);

  function choose(id: string) {
    if (dirty) setPendingId(id);
    else setChosenId(id);
  }

  const refs = [sections, teachers, rooms] as const;
  const refError = refs.find((r) => r.error)?.error;

  return (
    <>
      <PageHeader
        eyebrow="Academics"
        title="Timetable"
        description="Each section’s weekly periods. Click a cell to edit it, then save the week."
        actions={
          sections.data && sections.data.length > 0 ? (
            <Field label="Section" className="w-64">
              {(p) => (
                <Select {...p} value={sectionId} onChange={(e) => choose(e.target.value)}>
                  {sections.data.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          ) : undefined
        }
      />

      {refs.some((r) => r.isPending) ? (
        <LoadingBlock label="Loading timetable…" />
      ) : refError ? (
        <Card>
          <ErrorState
            error={refError}
            onRetry={() => {
              for (const r of refs) if (r.error) void r.refetch();
            }}
          />
        </Card>
      ) : !section ? (
        <Card>
          <EmptyState
            icon={<CalendarDays className="size-8" aria-hidden />}
            title="No sections yet"
            description="Create a section first; each section has its own weekly timetable."
            action={<ButtonLink href="/admin/sections">Go to sections</ButtonLink>}
          />
        </Card>
      ) : timetable.isPending ? (
        <LoadingBlock label="Loading timetable…" />
      ) : timetable.error ? (
        <Card>
          <ErrorState error={timetable.error} onRetry={() => timetable.refetch()} />
        </Card>
      ) : (
        <TimetableEditor
          key={section.id}
          section={section}
          initial={timetable.data}
          teachers={teachers.data ?? []}
          rooms={rooms.data ?? []}
          onDirtyChange={onDirtyChange}
        />
      )}

      <ConfirmDialog
        open={pendingId !== null}
        onClose={() => setPendingId(null)}
        title="Discard unsaved changes?"
        description="You have edits to this timetable that haven’t been saved. Switching sections discards them."
        confirmLabel="Discard and switch"
        onConfirm={() => {
          if (pendingId) setChosenId(pendingId);
          setDirty(false);
          setPendingId(null);
        }}
      />
    </>
  );
}
