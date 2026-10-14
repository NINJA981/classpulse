'use client';
import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Save, Undo2 } from 'lucide-react';
import clsx from 'clsx';
import { DAYS, type Day, type Room, type Section, type Teacher, type TimetableSlot } from '@classiq/shared';
import { Badge, Button, Card, CardBody, InlineError, useToast } from '@/components/ui';
import { ApiError, api } from '@/lib/api';
import { adminKeys } from '../queries';
import { SlotDialog } from './slot-dialog';
import { DAY_LABELS, DEFAULT_PERIODS, cellKey, draftFromSlots, parseKey, sameDraft, toInput, type Draft, type DraftSlot } from './types';

const SHORT: Record<Day, string> = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat' };

/** Maps VALIDATION_FAILED details (`slots.3.endTime`) back to grid cells. */
function mapErrors(err: unknown, keys: string[]): { cells: Record<string, string[]>; general: string[] } {
  const cells: Record<string, string[]> = {};
  const general: string[] = [];
  if (!(err instanceof ApiError) || err.code !== 'VALIDATION_FAILED') return { cells, general };
  for (const [path, message] of Object.entries(err.fieldErrors)) {
    const m = /^slots\.(\d+)(?:\.(.+))?$/.exec(path);
    const key = m ? keys[Number(m[1])] : undefined;
    if (key) {
      const field = m?.[2];
      (cells[key] ??= []).push(field ? `${field}: ${message}` : message);
    } else {
      general.push(path ? `${path}: ${message}` : message);
    }
  }
  return { cells, general };
}

/** Weekly grid editor for one section. Mount with `key={sectionId}` so switching sections resets the draft. */
export function TimetableEditor({
  section,
  initial,
  teachers,
  rooms,
  onDirtyChange,
}: {
  section: Section;
  initial: TimetableSlot[];
  teachers: Teacher[];
  rooms: Room[];
  onDirtyChange: (dirty: boolean) => void;
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const [baseline, setBaseline] = useState<Draft>(() => draftFromSlots(initial));
  const [draft, setDraft] = useState<Draft>(baseline);
  const [editing, setEditing] = useState<{ day: Day; period: number } | null>(null);
  const [savedKeys, setSavedKeys] = useState<string[]>([]);

  const dirty = !sameDraft(draft, baseline);
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const save = useMutation({
    mutationFn: (input: ReturnType<typeof toInput>) =>
      api.put<TimetableSlot[]>(`/admin/timetable/${section.id}`, { slots: input.slots }),
    onMutate: (input) => setSavedKeys(input.keys),
    onSuccess: (slots) => {
      qc.setQueryData(adminKeys.timetable(section.id), slots);
      void qc.invalidateQueries({ queryKey: ['admin', 'timetable'] });
      const next = draftFromSlots(slots);
      setBaseline(next);
      setDraft(next);
      toast(`Timetable for ${section.name} saved`);
    },
  });

  const { cells: cellErrors, general } = mapErrors(save.error, savedKeys);
  const isValidation = save.error instanceof ApiError && save.error.code === 'VALIDATION_FAILED';

  const maxPeriod = Math.max(DEFAULT_PERIODS, ...Object.keys(draft).map((k) => parseKey(k).period));
  const periods = Array.from({ length: maxPeriod }, (_, i) => i + 1);

  function defaultsFor(period: number): Partial<DraftSlot> {
    const same = Object.entries(draft).find(([k]) => parseKey(k).period === period)?.[1];
    return {
      startTime: same?.startTime,
      endTime: same?.endTime,
      subject: section.subject ?? '',
      room: section.room,
    };
  }

  function setCell(key: string, slot: DraftSlot | null) {
    setDraft((d) => {
      const next = { ...d };
      if (slot) next[key] = slot;
      else delete next[key];
      return next;
    });
    setEditing(null);
  }

  const filled = Object.keys(draft).length;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-muted">
          <span>
            {filled} {filled === 1 ? 'period' : 'periods'} scheduled
          </span>
          {dirty && <Badge tone="warning">Unsaved changes</Badge>}
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            icon={<Undo2 className="size-4" aria-hidden />}
            onClick={() => {
              setDraft(baseline);
              save.reset();
            }}
            disabled={!dirty || save.isPending}
          >
            Discard changes
          </Button>
          <Button icon={<Save className="size-4" aria-hidden />} onClick={() => save.mutate(toInput(draft))} loading={save.isPending} disabled={!dirty}>
            Save timetable
          </Button>
        </div>
      </div>

      {save.error != null && (
        <div className="mb-4 flex flex-col gap-2">
          {isValidation ? (
            <div role="alert" className="border border-danger/40 bg-danger-soft px-3 py-2 text-sm text-danger rounded-control">
              <p className="font-bold">The timetable wasn’t saved. Fix the highlighted periods:</p>
              <ul className="mt-1 list-disc pl-5 font-semibold">
                {Object.entries(cellErrors).map(([k, msgs]) => {
                  const { day, period } = parseKey(k);
                  return (
                    <li key={k}>
                      {DAY_LABELS[day]} period {period} — {msgs.join('; ')}
                    </li>
                  );
                })}
                {general.map((g) => (
                  <li key={g}>{g}</li>
                ))}
                {Object.keys(cellErrors).length === 0 && general.length === 0 && <li>{save.error.message}</li>}
              </ul>
            </div>
          ) : (
            <InlineError error={save.error} />
          )}
        </div>
      )}

      <Card>
        <CardBody className="overflow-x-auto p-0">
          <table className="w-full min-w-[56rem] table-fixed border-collapse text-sm">
            <caption className="sr-only">Weekly timetable for {section.name}. Select a cell to edit it.</caption>
            <thead>
              <tr>
                <th scope="col" className="eyebrow w-20 border-b border-line-strong px-3 py-2.5 text-left">
                  Period
                </th>
                {DAYS.map((d) => (
                  <th key={d} scope="col" className="eyebrow border-b border-l border-line border-b-line-strong px-3 py-2.5 text-left">
                    <abbr title={DAY_LABELS[d]} className="no-underline">
                      {SHORT[d]}
                    </abbr>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {periods.map((p) => (
                <tr key={p} className="border-b border-line last:border-b-0">
                  <th scope="row" className="px-3 py-2 text-left font-display text-lg font-black tabular-nums">
                    {p}
                  </th>
                  {DAYS.map((d) => {
                    const key = cellKey(d, p);
                    const slot = draft[key];
                    const errs = cellErrors[key];
                    return (
                      <td key={d} className="border-l border-line p-1 align-top">
                        <button
                          type="button"
                          onClick={() => setEditing({ day: d, period: p })}
                          aria-label={`${DAY_LABELS[d]} period ${p}: ${slot ? `${slot.subject}, ${slot.startTime} to ${slot.endTime}` : 'empty'}${errs ? ', has errors' : ''}`}
                          className={clsx(
                            'flex h-full min-h-20 w-full flex-col items-start gap-0.5 border px-2 py-1.5 text-left rounded-control',
                            errs
                              ? 'border-danger bg-danger-soft'
                              : slot
                                ? 'border-line bg-surface hover:border-line-strong'
                                : 'border-dashed border-line text-muted hover:border-line-strong hover:text-ink',
                          )}
                        >
                          {slot ? (
                            <>
                              <span className="w-full truncate font-bold text-ink">{slot.subject}</span>
                              <span className="font-mono text-[11px] text-ink-2">
                                {slot.startTime}–{slot.endTime}
                              </span>
                              {slot.teacher && <span className="w-full truncate text-xs text-muted">{slot.teacher.name}</span>}
                              {slot.room && <span className="w-full truncate text-xs text-muted">{slot.room.name}</span>}
                            </>
                          ) : (
                            <span className="m-auto inline-flex items-center gap-1 text-xs font-semibold">
                              <Plus className="size-3" aria-hidden />
                              Add
                            </span>
                          )}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </CardBody>
      </Card>

      {editing && (
        <SlotDialog
          day={editing.day}
          period={editing.period}
          slot={draft[cellKey(editing.day, editing.period)] ?? null}
          defaults={defaultsFor(editing.period)}
          teachers={teachers}
          rooms={rooms}
          serverErrors={cellErrors[cellKey(editing.day, editing.period)]}
          onApply={(s) => setCell(cellKey(editing.day, editing.period), s)}
          onClear={() => setCell(cellKey(editing.day, editing.period), null)}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}
