'use client';
import { useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import type { Paginated, Section, Student } from '@classiq/shared';
import { Button, Checkbox, Dialog, Field, InlineError, Input, Skeleton, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { adminKeys } from '../queries';
import { useDebounced } from '../use-debounced';
import { Pager } from '../pager';

const PAGE_SIZE = 50;

type Picked = Pick<Student, 'id' | 'name' | 'rollNumber'>;

/** Multi-select the students enrolled in a section, then replace the roster (PUT /:id/students). */
export function RosterDialog({ section, enrolled, onClose }: { section: Section; enrolled: Student[]; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const debouncedQ = useDebounced(q.trim(), 300);
  const [picked, setPicked] = useState<Map<string, Picked>>(() => new Map(enrolled.map((s) => [s.id, s])));

  const params = { q: debouncedQ, page, sectionId: '', pageSize: PAGE_SIZE };
  const list = useQuery({
    queryKey: adminKeys.studentList(params),
    queryFn: ({ signal }) =>
      api.get<Paginated<Student>>('/admin/students', { q: debouncedQ, page, pageSize: PAGE_SIZE }, signal),
    placeholderData: keepPreviousData,
  });

  const save = useMutation({
    mutationFn: (studentIds: string[]) => api.put<Student[]>(`/admin/sections/${section.id}/students`, { studentIds }),
    onSuccess: (students) => {
      qc.setQueryData(adminKeys.sectionStudents(section.id), students);
      void qc.invalidateQueries({ queryKey: adminKeys.sectionStudents(section.id) });
      void qc.invalidateQueries({ queryKey: adminKeys.sections });
      void qc.invalidateQueries({ queryKey: adminKeys.students });
      toast(`Roster saved — ${students.length} ${students.length === 1 ? 'student' : 'students'} in ${section.name}`);
      onClose();
    },
  });

  function toggle(s: Picked, on: boolean) {
    setPicked((prev) => {
      const next = new Map(prev);
      if (on) next.set(s.id, { id: s.id, name: s.name, rollNumber: s.rollNumber });
      else next.delete(s.id);
      return next;
    });
  }

  const pickedList = [...picked.values()].sort((a, b) => a.rollNumber.localeCompare(b.rollNumber, undefined, { numeric: true }));

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Edit roster — ${section.name}`}
      description="Tick the students who belong to this section. Saving replaces the current roster."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => save.mutate([...picked.keys()])} loading={save.isPending}>
            Save roster ({picked.size})
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <div className="flex flex-col gap-3">
          <Field label="Search students" hint="Name or roll number">
            {(p) => (
              <Input
                {...p}
                type="search"
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(1);
                }}
              />
            )}
          </Field>
          <fieldset className="flex flex-col gap-2">
            <legend className="sr-only">Students</legend>
            {list.isPending ? (
              <Skeleton className="h-48" />
            ) : list.error ? (
              <InlineError error={list.error} />
            ) : list.data.items.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted">{debouncedQ ? 'No students match your search.' : 'No students yet. Add students first.'}</p>
            ) : (
              <div className="flex max-h-72 flex-col gap-2 overflow-y-auto border border-line p-3 rounded-control">
                {list.data.items.map((s) => (
                  <Checkbox
                    key={s.id}
                    checked={picked.has(s.id)}
                    onChange={(e) => toggle(s, e.target.checked)}
                    label={
                      <span>
                        <span className="font-mono text-xs text-muted">{s.rollNumber}</span> {s.name}
                      </span>
                    }
                  />
                ))}
              </div>
            )}
          </fieldset>
          {list.data && <Pager page={list.data.page} pageSize={list.data.pageSize} total={list.data.total} onPage={setPage} />}
        </div>

        <div className="flex flex-col gap-2">
          <p className="eyebrow">Selected ({picked.size})</p>
          {pickedList.length === 0 ? (
            <p className="text-sm text-muted">No students selected. Saving will empty this section.</p>
          ) : (
            <ul className="flex max-h-96 flex-col overflow-y-auto border border-line rounded-control">
              {pickedList.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-2 border-b border-line px-3 py-1.5 text-sm last:border-b-0">
                  <span className="min-w-0 truncate">
                    <span className="font-mono text-xs text-muted">{s.rollNumber}</span> {s.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => toggle(s, false)}
                    className="p-1 hover:bg-surface-2 rounded-control"
                    aria-label={`Remove ${s.name} from selection`}
                  >
                    <X className="size-3.5" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <div className="mt-4">
        <InlineError error={save.error} />
      </div>
    </Dialog>
  );
}
