'use client';
import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Institution, InstitutionInput } from '@classiq/shared';
import { Button, Field, InlineError, Input, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { adminKeys, fieldErrorsOf, formLevelError, optional } from '../queries';

const FIELDS = ['name', 'code', 'timezone', 'academicYear'];

/** Create or update the school profile (PUT /admin/institution). `institution` is null before it exists. */
export function InstitutionForm({ institution }: { institution: Institution | null }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [name, setName] = useState(institution?.name ?? '');
  const [code, setCode] = useState(institution?.code ?? '');
  const [timezone, setTimezone] = useState(institution?.timezone ?? 'Asia/Kolkata');
  const [academicYear, setAcademicYear] = useState(institution?.academicYear ?? '');

  const save = useMutation({
    mutationFn: (body: InstitutionInput) => api.put<Institution>('/admin/institution', body),
    onSuccess: (saved) => {
      qc.setQueryData(adminKeys.institution, saved);
      void qc.invalidateQueries({ queryKey: adminKeys.overview });
      toast(institution ? 'School profile saved' : `School “${saved.name}” created`);
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    save.mutate({
      name: name.trim(),
      code: code.trim().toUpperCase(),
      timezone: timezone.trim() || 'Asia/Kolkata',
      academicYear: optional(academicYear),
    });
  }

  const fe = fieldErrorsOf(save.error);
  return (
    <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2" noValidate aria-label="School profile">
      <Field label="School name" required error={fe.name} className="sm:col-span-2">
        {(p) => <Input {...p} value={name} onChange={(e) => setName(e.target.value)} maxLength={200} />}
      </Field>
      <Field label="School code" required error={fe.code} hint="2–20 letters, digits or dashes, e.g. DPS-RKP">
        {(p) => (
          <Input
            {...p}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={20}
            autoCapitalize="characters"
            className="font-mono uppercase"
          />
        )}
      </Field>
      <Field label="Academic year" error={fe.academicYear} hint="e.g. 2026-27">
        {(p) => <Input {...p} value={academicYear} onChange={(e) => setAcademicYear(e.target.value)} maxLength={20} />}
      </Field>
      <Field label="Time zone" error={fe.timezone} hint="IANA name; timetables use this zone" className="sm:col-span-2">
        {(p) => <Input {...p} value={timezone} onChange={(e) => setTimezone(e.target.value)} maxLength={64} />}
      </Field>
      <div className="flex flex-col gap-3 sm:col-span-2">
        <InlineError error={formLevelError(save.error, FIELDS)} />
        <div>
          <Button type="submit" loading={save.isPending} disabled={!name.trim() || !code.trim()}>
            {institution ? 'Save school profile' : 'Create school profile'}
          </Button>
        </div>
      </div>
    </form>
  );
}
