'use client';
import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CreatedWithPassword, CreateStudentInput, Student, UpdateStudentInput } from '@classiq/shared';
import { Button, Dialog, Field, InlineError, Input, Select, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { adminKeys, fieldErrorsOf, formLevelError, optional, useSections } from '../queries';

const FIELDS = ['name', 'rollNumber', 'email', 'sectionId', 'status'];

/** Create (student = null) or edit a student. Mount only while open. */
export function StudentDialog({
  student,
  defaultSectionId,
  onClose,
  onCreated,
}: {
  student: Student | null;
  defaultSectionId?: string;
  onClose: () => void;
  onCreated: (result: CreatedWithPassword<Student>) => void;
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const sections = useSections();
  const [name, setName] = useState(student?.name ?? '');
  const [rollNumber, setRollNumber] = useState(student?.rollNumber ?? '');
  const [email, setEmail] = useState(student?.email ?? '');
  const [sectionId, setSectionId] = useState(defaultSectionId ?? '');
  const [status, setStatus] = useState<Student['status']>(student?.status ?? 'active');

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: adminKeys.students });
    void qc.invalidateQueries({ queryKey: adminKeys.sections });
    void qc.invalidateQueries({ queryKey: adminKeys.overview });
  };

  const create = useMutation({
    mutationFn: (body: CreateStudentInput) => api.post<CreatedWithPassword<Student>>('/admin/students', body),
    onSuccess: (result) => {
      invalidate();
      toast(`Student “${result.record.name}” added`);
      onCreated(result);
    },
  });
  const update = useMutation({
    mutationFn: (body: UpdateStudentInput) => api.patch<Student>(`/admin/students/${student!.id}`, body),
    onSuccess: (saved) => {
      invalidate();
      toast(`Student “${saved.name}” updated`);
      onClose();
    },
  });
  const m = student ? update : create;

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (student) {
      update.mutate({ name: name.trim(), email: email.trim() || null, status });
    } else {
      create.mutate({
        name: name.trim(),
        rollNumber: rollNumber.trim(),
        email: optional(email),
        sectionId: sectionId || undefined,
      });
    }
  }

  const fe = fieldErrorsOf(m.error);
  return (
    <Dialog
      open
      onClose={onClose}
      title={student ? `Edit ${student.name}` : 'Add student'}
      description={student ? `Roll number ${student.rollNumber}` : 'An initial password is generated and shown once after the student is created.'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="student-form" loading={m.isPending} disabled={!name.trim() || (!student && !rollNumber.trim())}>
            {student ? 'Save student' : 'Create student'}
          </Button>
        </>
      }
    >
      <form id="student-form" onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <Field label="Full name" required error={fe.name}>
          {(p) => <Input {...p} value={name} onChange={(e) => setName(e.target.value)} maxLength={120} autoFocus />}
        </Field>
        {!student && (
          <Field label="Roll number" required error={fe.rollNumber} hint="Students sign in with this, e.g. 10B-01">
            {(p) => <Input {...p} value={rollNumber} onChange={(e) => setRollNumber(e.target.value)} maxLength={40} autoComplete="off" />}
          </Field>
        )}
        <Field label="Email" error={fe.email} hint="Optional">
          {(p) => <Input {...p} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" />}
        </Field>
        {student ? (
          <Field label="Account status" error={fe.status} hint="Disabled students can’t sign in.">
            {(p) => (
              <Select {...p} value={status} onChange={(e) => setStatus(e.target.value as Student['status'])}>
                <option value="active">Active</option>
                <option value="disabled">Disabled</option>
              </Select>
            )}
          </Field>
        ) : (
          <Field label="Section" error={fe.sectionId ?? (sections.error ? 'Could not load sections' : undefined)} hint="Optional — enrol the student right away">
            {(p) => (
              <Select {...p} value={sectionId} onChange={(e) => setSectionId(e.target.value)} disabled={sections.isPending}>
                <option value="">No section</option>
                {sections.data?.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}
        <InlineError error={formLevelError(m.error, FIELDS)} />
      </form>
    </Dialog>
  );
}
