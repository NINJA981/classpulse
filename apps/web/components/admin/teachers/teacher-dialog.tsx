'use client';
import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CreatedWithPassword, CreateTeacherInput, Teacher, UpdateTeacherInput } from '@classiq/shared';
import { Button, Dialog, Field, InlineError, Input, Select, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { adminKeys, fieldErrorsOf, formLevelError, optional } from '../queries';

const FIELDS = ['name', 'email', 'department', 'status'];

/**
 * Create (teacher = null) or edit a teacher. On create, `onCreated` receives the
 * generated initial password so the caller can show it once.
 */
export function TeacherDialog({
  teacher,
  onClose,
  onCreated,
}: {
  teacher: Teacher | null;
  onClose: () => void;
  onCreated: (result: CreatedWithPassword<Teacher>) => void;
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const [name, setName] = useState(teacher?.name ?? '');
  const [email, setEmail] = useState(teacher?.email ?? '');
  const [department, setDepartment] = useState(teacher?.department ?? '');
  const [status, setStatus] = useState<Teacher['status']>(teacher?.status ?? 'active');

  const create = useMutation({
    mutationFn: (body: CreateTeacherInput) => api.post<CreatedWithPassword<Teacher>>('/admin/teachers', body),
    onSuccess: (result) => {
      void qc.invalidateQueries({ queryKey: adminKeys.teachers });
      void qc.invalidateQueries({ queryKey: adminKeys.overview });
      toast(`Teacher “${result.record.name}” added`);
      onCreated(result);
    },
  });
  const update = useMutation({
    mutationFn: (body: UpdateTeacherInput) => api.patch<Teacher>(`/admin/teachers/${teacher!.id}`, body),
    onSuccess: (saved) => {
      void qc.invalidateQueries({ queryKey: adminKeys.teachers });
      void qc.invalidateQueries({ queryKey: adminKeys.sections });
      toast(`Teacher “${saved.name}” updated`);
      onClose();
    },
  });
  const m = teacher ? update : create;

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (teacher) {
      update.mutate({ name: name.trim(), email: email.trim(), department: department.trim() || null, status });
    } else {
      create.mutate({ name: name.trim(), email: email.trim(), department: optional(department) });
    }
  }

  const fe = fieldErrorsOf(m.error);
  return (
    <Dialog
      open
      onClose={onClose}
      title={teacher ? `Edit ${teacher.name}` : 'Add teacher'}
      description={teacher ? undefined : 'An initial password is generated and shown once after the teacher is created.'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="teacher-form" loading={m.isPending} disabled={!name.trim() || !email.trim()}>
            {teacher ? 'Save teacher' : 'Create teacher'}
          </Button>
        </>
      }
    >
      <form id="teacher-form" onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <Field label="Full name" required error={fe.name}>
          {(p) => <Input {...p} value={name} onChange={(e) => setName(e.target.value)} maxLength={120} autoFocus />}
        </Field>
        <Field label="Email" required error={fe.email} hint="Used to sign in">
          {(p) => <Input {...p} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" />}
        </Field>
        <Field label="Department" error={fe.department}>
          {(p) => <Input {...p} value={department} onChange={(e) => setDepartment(e.target.value)} maxLength={120} />}
        </Field>
        {teacher && (
          <Field label="Account status" error={fe.status} hint="Disabled teachers can’t sign in. Their lessons are kept.">
            {(p) => (
              <Select {...p} value={status} onChange={(e) => setStatus(e.target.value as Teacher['status'])}>
                <option value="active">Active</option>
                <option value="disabled">Disabled</option>
              </Select>
            )}
          </Field>
        )}
        <InlineError error={formLevelError(m.error, FIELDS)} />
      </form>
    </Dialog>
  );
}
