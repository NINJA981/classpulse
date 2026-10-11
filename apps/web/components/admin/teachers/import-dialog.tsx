'use client';
import { ImportTeachersInput, type ImportTeachersResult } from '@classpulse/shared';
import { api } from '@/lib/api';
import { adminKeys } from '../queries';
import { CsvImportDialog, type CsvImportConfig } from '../csv-import-dialog';

type Row = ImportTeachersInput['rows'][number];

const TEACHER_IMPORT: CsvImportConfig<'name' | 'email' | 'department', Row> = {
  noun: { one: 'teacher', many: 'teachers' },
  title: 'Import teachers from CSV',
  columns: [
    { key: 'name', label: 'Name', aliases: ['name', 'teachername', 'fullname'], required: true },
    { key: 'email', label: 'Email', aliases: ['email', 'emailaddress', 'mail'], required: true },
    { key: 'department', label: 'Department', aliases: ['department', 'dept', 'subject'] },
  ],
  uniqueKey: 'email',
  rowSchema: ImportTeachersInput.shape.rows.element,
  maxRows: 500,
  template: {
    filename: 'classpulse-teachers-template.csv',
    examples: [
      ['Neha Sharma', 'neha.sharma@example.com', 'Mathematics'],
      ['Arjun Mehta', 'arjun.mehta@example.com', 'Science'],
    ],
  },
  login: { label: 'Email', csvHeader: 'email' },
  credentialsFilePrefix: 'teacher-credentials',
  invalidate: [adminKeys.teachers, adminKeys.overview],
};

/** Import teachers from a CSV; each one is emailed an invitation to set their password. */
export function ImportTeachersDialog({ onClose }: { onClose: () => void }) {
  return (
    <CsvImportDialog
      config={TEACHER_IMPORT}
      description="Columns: name, email, department (optional). Each teacher is emailed an invitation to set their own password."
      onClose={onClose}
      submit={async (rows) => {
        const res = await api.post<ImportTeachersResult>('/admin/teachers/import', { rows });
        return {
          created: res.created.map((c) => ({ ...c, login: c.email })),
          skipped: res.skipped.map((s) => ({ login: s.email, reason: s.reason })),
        };
      }}
    />
  );
}
