'use client';
import { useState, type FormEvent } from 'react';
import type { Day, Room, Teacher } from '@classpulse/shared';
import { Button, Dialog, Field, Input, Select } from '@/components/ui';
import { DAY_LABELS, type DraftSlot } from './types';

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Edit or clear one timetable cell. Changes apply to the local draft; "Save timetable" persists them. */
export function SlotDialog({
  day,
  period,
  slot,
  defaults,
  teachers,
  rooms,
  serverErrors,
  onApply,
  onClear,
  onClose,
}: {
  day: Day;
  period: number;
  slot: DraftSlot | null;
  /** Prefill for a new cell (e.g. times used by the same period on another day, the section's room). */
  defaults: Partial<DraftSlot>;
  teachers: Teacher[];
  rooms: Room[];
  serverErrors?: string[];
  onApply: (slot: DraftSlot) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const init = slot ?? defaults;
  const [subject, setSubject] = useState(init.subject ?? '');
  const [startTime, setStartTime] = useState(init.startTime ?? '');
  const [endTime, setEndTime] = useState(init.endTime ?? '');
  const [teacherId, setTeacherId] = useState(init.teacher?.id ?? '');
  const [roomId, setRoomId] = useState(init.room?.id ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Keep a slot's current teacher/room selectable even if it is no longer in the list.
  const teacherOptions = [...teachers.map((t) => ({ id: t.id, name: t.name }))];
  if (init.teacher && !teachers.some((t) => t.id === init.teacher!.id)) teacherOptions.push(init.teacher);
  const roomOptions = [...rooms.map((r) => ({ id: r.id, name: r.name }))];
  if (init.room && !rooms.some((r) => r.id === init.room!.id)) roomOptions.push(init.room);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!subject.trim()) next.subject = 'Enter a subject';
    if (!HHMM.test(startTime)) next.startTime = 'Use HH:MM';
    if (!HHMM.test(endTime)) next.endTime = 'Use HH:MM';
    else if (HHMM.test(startTime) && startTime >= endTime) next.endTime = 'End time must be after the start time';
    setErrors(next);
    if (Object.keys(next).length) return;
    onApply({
      subject: subject.trim(),
      startTime,
      endTime,
      teacher: teacherOptions.find((t) => t.id === teacherId) ?? null,
      room: roomOptions.find((r) => r.id === roomId) ?? null,
    });
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={`${DAY_LABELS[day]} · Period ${period}`}
      description="Changes are kept in the grid until you press “Save timetable”."
      footer={
        <>
          {slot && (
            <Button variant="danger" onClick={onClear} className="mr-auto">
              Clear slot
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="slot-form">
            Apply
          </Button>
        </>
      }
    >
      <form id="slot-form" onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2" noValidate>
        {serverErrors && serverErrors.length > 0 && (
          <ul role="alert" className="border border-danger/40 bg-danger-soft px-3 py-2 text-sm font-semibold text-danger rounded-control sm:col-span-2">
            {serverErrors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}
        <Field label="Subject" required error={errors.subject} className="sm:col-span-2">
          {(p) => <Input {...p} value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={120} autoFocus />}
        </Field>
        <Field label="Start time" required error={errors.startTime}>
          {(p) => <Input {...p} type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />}
        </Field>
        <Field label="End time" required error={errors.endTime}>
          {(p) => <Input {...p} type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />}
        </Field>
        <Field label="Teacher">
          {(p) => (
            <Select {...p} value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
              <option value="">No teacher</option>
              {teacherOptions.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Room">
          {(p) => (
            <Select {...p} value={roomId} onChange={(e) => setRoomId(e.target.value)}>
              <option value="">No room</option>
              {roomOptions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </form>
    </Dialog>
  );
}
