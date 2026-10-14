'use client';
import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Section, SectionInput } from '@classiq/shared';
import { Button, Checkbox, Dialog, Field, InlineError, Input, Select, Skeleton, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { adminKeys, fieldErrorsOf, formLevelError, optional, useRooms, useTeachers } from '../queries';

const FIELDS = ['name', 'grade', 'subject', 'roomId', 'teacherIds'];

/** Create (section = null) or edit a section. Mount only while open. */
export function SectionDialog({ section, onClose }: { section: Section | null; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const rooms = useRooms();
  const teachers = useTeachers();

  const [name, setName] = useState(section?.name ?? '');
  const [grade, setGrade] = useState(section?.grade ?? '');
  const [subject, setSubject] = useState(section?.subject ?? '');
  const [roomId, setRoomId] = useState(section?.room?.id ?? '');
  const [teacherIds, setTeacherIds] = useState<string[]>(section?.teachers.map((t) => t.id) ?? []);

  const save = useMutation({
    mutationFn: (body: SectionInput) =>
      section ? api.patch<Section>(`/admin/sections/${section.id}`, body) : api.post<Section>('/admin/sections', body),
    onSuccess: (saved) => {
      void qc.invalidateQueries({ queryKey: adminKeys.sections });
      void qc.invalidateQueries({ queryKey: adminKeys.teachers });
      void qc.invalidateQueries({ queryKey: adminKeys.overview });
      toast(section ? `Section “${saved.name}” updated` : `Section “${saved.name}” created — join code ${saved.joinCode}`);
      onClose();
    },
  });

  function toggleTeacher(id: string, on: boolean) {
    setTeacherIds((ids) => (on ? [...ids, id] : ids.filter((x) => x !== id)));
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    save.mutate({
      name: name.trim(),
      // On edit an empty string clears the value; on create it is omitted.
      grade: section ? grade.trim() : optional(grade),
      subject: section ? subject.trim() : optional(subject),
      roomId: roomId || null,
      teacherIds,
    });
  }

  const fe = fieldErrorsOf(save.error);
  const knownTeacherIds = new Set(teachers.data?.map((t) => t.id));
  const missingTeachers = section?.teachers.filter((t) => teachers.data && !knownTeacherIds.has(t.id)) ?? [];

  return (
    <Dialog
      open
      onClose={onClose}
      title={section ? `Edit ${section.name}` : 'Create section'}
      description={section ? undefined : 'A section is a class cohort, e.g. “10-B Physics”. A join code is generated automatically.'}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="section-form" loading={save.isPending} disabled={!name.trim()}>
            {section ? 'Save section' : 'Create section'}
          </Button>
        </>
      }
    >
      <form id="section-form" onSubmit={onSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2" noValidate>
        <Field label="Section name" required error={fe.name} className="sm:col-span-2">
          {(p) => <Input {...p} value={name} onChange={(e) => setName(e.target.value)} maxLength={120} autoFocus />}
        </Field>
        <Field label="Grade" error={fe.grade} hint="e.g. 10">
          {(p) => <Input {...p} value={grade} onChange={(e) => setGrade(e.target.value)} maxLength={20} />}
        </Field>
        <Field label="Subject" error={fe.subject}>
          {(p) => <Input {...p} value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={120} />}
        </Field>
        <Field
          label="Room"
          error={fe.roomId ?? (rooms.error ? 'Could not load rooms' : undefined)}
          hint="Classroom devices in this room can record this section’s classes."
          className="sm:col-span-2"
        >
          {(p) => (
            <Select {...p} value={roomId} onChange={(e) => setRoomId(e.target.value)} disabled={rooms.isPending}>
              <option value="">No room</option>
              {rooms.data?.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                  {r.building ? ` — ${r.building}` : ''}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <fieldset className="flex flex-col gap-2 sm:col-span-2">
          <legend className="mb-1.5 text-xs font-bold text-ink-2">Teachers</legend>
          {teachers.isPending ? (
            <Skeleton className="h-20" />
          ) : teachers.error ? (
            <InlineError error={teachers.error} />
          ) : teachers.data.length === 0 ? (
            <p className="text-sm text-muted">No teachers yet. Add teachers first, then assign them here.</p>
          ) : (
            <div className="grid grid-cols-1 max-h-48 gap-2 overflow-y-auto border border-line p-3 sm:grid-cols-2 rounded-control">
              {teachers.data.map((t) => (
                <Checkbox
                  key={t.id}
                  checked={teacherIds.includes(t.id)}
                  onChange={(e) => toggleTeacher(t.id, e.target.checked)}
                  label={
                    <span>
                      {t.name}
                      {t.status === 'disabled' && <span className="text-muted"> (disabled)</span>}
                    </span>
                  }
                />
              ))}
              {missingTeachers.map((t) => (
                <Checkbox key={t.id} checked={teacherIds.includes(t.id)} onChange={(e) => toggleTeacher(t.id, e.target.checked)} label={t.name} />
              ))}
            </div>
          )}
          {fe.teacherIds && <p className="text-xs font-semibold text-danger">{fe.teacherIds}</p>}
        </fieldset>

        <div className="sm:col-span-2">
          <InlineError error={formLevelError(save.error, FIELDS)} />
        </div>
      </form>
    </Dialog>
  );
}
