'use client';
import { useState } from 'react';
import { ImportStudentsInput, type ImportStudentsResult } from '@classiq/shared';
import { Field, Select } from '@/components/ui';
import { api } from '@/lib/api';
import { adminKeys, useSections } from '../queries';
import { CsvImportDialog, type CsvImportConfig } from '../csv-import-dialog';

type Row = ImportStudentsInput['rows'][number];

const STUDENT_IMPORT: CsvImportConfig<'name' | 'rollNumber' | 'email', Row> = {
  noun: { one: 'student', many: 'students' },
  title: 'Import students from CSV',
  columns: [
    { key: 'name', label: 'Name', aliases: ['name', 'studentname', 'fullname'], required: true },
    { key: 'rollNumber', label: 'Roll no.', aliases: ['rollnumber', 'roll', 'rollno', 'rollnum'], required: true, mono: true },
    { key: 'email', label: 'Email', aliases: ['email', 'emailaddress', 'mail'] },
  ],
  uniqueKey: 'rollNumber',
  rowSchema: ImportStudentsInput.shape.rows.element,
  maxRows: 2000,
  template: {
    filename: 'classiq-students-template.csv',
    examples: [
      ['Asha Rao', '10B-01', 'asha.rao@example.com'],
      ['Ravi Kumar', '10B-02', ''],
    ],
  },
  login: { label: 'Roll no.', csvHeader: 'rollNumber' },
  credentialsFilePrefix: 'student-credentials',
  invalidate: [adminKeys.students, adminKeys.sections, adminKeys.overview],
};

/** Import students from a CSV, optionally enrolling them all into one section. */
export function ImportStudentsDialog({ onClose }: { onClose: () => void }) {
  const sections = useSections();
  const [sectionId, setSectionId] = useState('');

  return (
    <CsvImportDialog
      config={STUDENT_IMPORT}
      description="Columns: name, rollNumber (or roll), email (optional). Students with an email get an invitation to set their own password."
      onClose={onClose}
      submit={async (rows) => {
        const res = await api.post<ImportStudentsResult>('/admin/students/import', { sectionId: sectionId || undefined, rows });
        return {
          created: res.created.map((c) => ({ ...c, login: c.rollNumber })),
          skipped: res.skipped.map((s) => ({ login: s.rollNumber, reason: s.reason })),
        };
      }}
      extraFields={
        <Field label="Enrol into section" hint="Optional — every imported student joins this section">
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
      }
    />
  );
}
