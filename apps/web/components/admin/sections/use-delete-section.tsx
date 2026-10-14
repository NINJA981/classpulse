'use client';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Section } from '@classiq/shared';
import { useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { adminKeys } from '../queries';
import { ConfirmDialog } from '../common';

/** Delete-section mutation + confirm dialog (shows the 409 message when the section has lessons). */
export function useDeleteSection(onDeleted?: (s: Section) => void) {
  const qc = useQueryClient();
  const toast = useToast();
  const [target, setTarget] = useState<Section | null>(null);
  const remove = useMutation({
    mutationFn: (s: Section) => api.delete(`/admin/sections/${s.id}`),
    onSuccess: (_, s) => {
      qc.setQueryData<Section[]>(adminKeys.sections, (list) => list?.filter((x) => x.id !== s.id));
      void qc.invalidateQueries({ queryKey: adminKeys.sections });
      void qc.invalidateQueries({ queryKey: adminKeys.students });
      void qc.invalidateQueries({ queryKey: adminKeys.teachers });
      void qc.invalidateQueries({ queryKey: adminKeys.overview });
      toast(`Section “${s.name}” deleted`);
      setTarget(null);
      onDeleted?.(s);
    },
  });

  const dialog = (
    <ConfirmDialog
      open={target !== null}
      onClose={() => setTarget(null)}
      title="Delete section?"
      description={
        target && (
          <>
            <strong>{target.name}</strong> and its enrolments and timetable will be removed. Sections that already have lessons
            can’t be deleted.
          </>
        )
      }
      confirmLabel="Delete section"
      onConfirm={() => target && remove.mutate(target)}
      pending={remove.isPending}
      error={remove.error}
    />
  );

  return {
    open: (s: Section) => {
      remove.reset();
      setTarget(s);
    },
    dialog,
  };
}
