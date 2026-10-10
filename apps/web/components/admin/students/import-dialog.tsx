'use client';
import { useState, type ChangeEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Download, FileUp } from 'lucide-react';
import clsx from 'clsx';
import { ImportStudentsInput, type ImportStudentsResult } from '@classpulse/shared';
import { Badge, Button, Dialog, Field, InlineError, Input, Select, Table, TBody, TD, TH, THead, TR, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { adminKeys, useSections } from '../queries';
import { Callout, downloadFile } from '../common';
import { normalizeHeader, parseCsv, readFileAsText, toCsv } from '../csv';

const MAX_ROWS = 2000;
const RowSchema = ImportStudentsInput.shape.rows.element;
type ImportRow = ImportStudentsInput['rows'][number];

const HEADER_ALIASES = {
  name: ['name', 'studentname', 'fullname'],
  rollNumber: ['rollnumber', 'roll', 'rollno', 'rollnum'],
  email: ['email', 'emailaddress', 'mail'],
} as const;

interface PreviewRow {
  line: number;
  raw: { name: string; rollNumber: string; email: string };
  row: ImportRow | null;
  errors: string[];
}

function findColumn(headers: string[], aliases: readonly string[]): string | undefined {
  return headers.find((h) => (aliases as readonly string[]).includes(normalizeHeader(h)));
}

function buildPreview(text: string): { rows: PreviewRow[]; error: string | null } {
  const { headers, records } = parseCsv(text);
  const nameCol = findColumn(headers, HEADER_ALIASES.name);
  const rollCol = findColumn(headers, HEADER_ALIASES.rollNumber);
  const emailCol = findColumn(headers, HEADER_ALIASES.email);
  if (!nameCol || !rollCol) {
    return { rows: [], error: 'The CSV needs a header row with “name” and “rollNumber” (or “roll”) columns. “email” is optional.' };
  }
  if (records.length === 0) return { rows: [], error: 'The CSV has a header row but no students.' };

  const seen = new Set<string>();
  const rows = records.map((rec, i): PreviewRow => {
    const raw = { name: rec[nameCol] ?? '', rollNumber: rec[rollCol] ?? '', email: emailCol ? (rec[emailCol] ?? '') : '' };
    const parsed = RowSchema.safeParse({ name: raw.name, rollNumber: raw.rollNumber, email: raw.email || undefined });
    const errors = parsed.success ? [] : parsed.error.issues.map((iss) => `${String(iss.path[0] ?? 'row')}: ${iss.message}`);
    const key = raw.rollNumber.trim().toLowerCase();
    if (key) {
      if (seen.has(key)) errors.push('rollNumber: duplicate in this file');
      seen.add(key);
    }
    return { line: i + 2, raw, row: parsed.success && errors.length === 0 ? parsed.data : null, errors };
  });
  return { rows, error: null };
}

/** Import students from a CSV file: parse + validate client-side, POST /import, then offer the credentials once. */
export function ImportStudentsDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const sections = useSections();
  const [fileName, setFileName] = useState<string | null>(null);
  const [sectionId, setSectionId] = useState('');
  const [preview, setPreview] = useState<PreviewRow[] | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportStudentsResult | null>(null);
  const [downloaded, setDownloaded] = useState(false);

  const validRows = preview?.flatMap((r) => (r.row ? [r.row] : [])) ?? [];
  const invalidCount = (preview?.length ?? 0) - validRows.length;
  const tooMany = validRows.length > MAX_ROWS;

  const importMut = useMutation({
    mutationFn: () =>
      api.post<ImportStudentsResult>('/admin/students/import', { sectionId: sectionId || undefined, rows: validRows }),
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: adminKeys.students });
      void qc.invalidateQueries({ queryKey: adminKeys.sections });
      void qc.invalidateQueries({ queryKey: adminKeys.overview });
      toast(`${res.created.length} students imported${res.skipped.length ? `, ${res.skipped.length} skipped` : ''}`);
      setResult(res);
    },
  });

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setPreview(null);
    setParseError(null);
    importMut.reset();
    if (!file) {
      setFileName(null);
      return;
    }
    setFileName(file.name);
    try {
      const { rows, error } = buildPreview(await readFileAsText(file));
      setParseError(error);
      setPreview(error ? null : rows);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Could not read the file.');
    }
  }

  function downloadCredentials() {
    if (!result) return;
    const csv = toCsv(
      ['rollNumber', 'name', 'initialPassword'],
      result.created.map((c) => [c.rollNumber, c.name, c.initialPassword]),
    );
    downloadFile(`student-credentials-${new Date().toISOString().slice(0, 10)}.csv`, csv);
    setDownloaded(true);
  }

  if (result) {
    return (
      <Dialog
        open
        onClose={onClose}
        title="Import complete"
        description={`${result.created.length} created · ${result.skipped.length} skipped`}
        size="lg"
        footer={
          <>
            <Button variant={downloaded ? 'primary' : 'secondary'} onClick={onClose}>
              Done
            </Button>
            {result.created.length > 0 && (
              <Button icon={<Download className="size-4" aria-hidden />} onClick={downloadCredentials} variant={downloaded ? 'secondary' : 'primary'}>
                Download credentials CSV
              </Button>
            )}
          </>
        }
      >
        <div className="flex flex-col gap-5">
          {result.created.length > 0 && (
            <Callout title="Initial passwords are shown only once">
              Download the credentials CSV now and hand each student their password privately. After closing this dialog the
              passwords can’t be shown again — you would have to reset them one by one.
            </Callout>
          )}
          {result.created.length > 0 && (
            <section aria-label="Created students">
              <p className="eyebrow mb-2">Created ({result.created.length})</p>
              <div className="max-h-64 overflow-y-auto border border-line rounded-control">
                <Table>
                  <THead>
                    <tr>
                      <TH>Roll no.</TH>
                      <TH>Name</TH>
                      <TH>Initial password</TH>
                    </tr>
                  </THead>
                  <TBody>
                    {result.created.map((c) => (
                      <TR key={c.id}>
                        <TD className="font-mono text-xs">{c.rollNumber}</TD>
                        <TD>{c.name}</TD>
                        <TD className="select-all font-mono text-xs font-bold">{c.initialPassword}</TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </div>
            </section>
          )}
          {result.skipped.length > 0 && (
            <section aria-label="Skipped rows">
              <p className="eyebrow mb-2">Skipped ({result.skipped.length})</p>
              <div className="max-h-48 overflow-y-auto border border-line rounded-control">
                <Table>
                  <THead>
                    <tr>
                      <TH>Roll no.</TH>
                      <TH>Reason</TH>
                    </tr>
                  </THead>
                  <TBody>
                    {result.skipped.map((s, i) => (
                      <TR key={`${s.rollNumber}-${i}`}>
                        <TD className="font-mono text-xs">{s.rollNumber}</TD>
                        <TD className="text-danger">{s.reason}</TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </div>
            </section>
          )}
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title="Import students from CSV"
      description="Columns: name, rollNumber (or roll), email (optional). The first row must be the header."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            icon={<FileUp className="size-4" aria-hidden />}
            onClick={() => importMut.mutate()}
            loading={importMut.isPending}
            disabled={validRows.length === 0 || tooMany}
          >
            Import {validRows.length || ''} {validRows.length === 1 ? 'student' : 'students'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="CSV file" required error={parseError} hint={fileName ?? 'Exported from Excel or Google Sheets as .csv'}>
            {(p) => <Input {...p} type="file" accept=".csv,text/csv" onChange={onFile} className="py-2 file:mr-3 file:border-0 file:bg-transparent file:font-bold" />}
          </Field>
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
        </div>

        {preview && (
          <section aria-label="Preview" className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="eyebrow">Preview</span>
              <Badge tone="success">{validRows.length} ready</Badge>
              {invalidCount > 0 && <Badge tone="danger">{invalidCount} with errors</Badge>}
            </div>
            {invalidCount > 0 && (
              <p className="text-xs text-muted">Rows with errors are not sent. Fix them in the file and choose it again, or import the valid rows now.</p>
            )}
            {tooMany && <Callout tone="danger">At most {MAX_ROWS} students can be imported at once. Split the file.</Callout>}
            <div className="max-h-80 overflow-y-auto border border-line rounded-control">
              <Table>
                <THead>
                  <tr>
                    <TH>Line</TH>
                    <TH>Name</TH>
                    <TH>Roll no.</TH>
                    <TH>Email</TH>
                    <TH>Check</TH>
                  </tr>
                </THead>
                <TBody>
                  {preview.map((r) => (
                    <TR key={r.line} className={clsx(r.errors.length > 0 && 'bg-danger-soft')}>
                      <TD className="tabular-nums text-muted">{r.line}</TD>
                      <TD>{r.raw.name || <span className="text-muted">—</span>}</TD>
                      <TD className="font-mono text-xs">{r.raw.rollNumber || <span className="text-muted">—</span>}</TD>
                      <TD className="text-ink-2">{r.raw.email || '—'}</TD>
                      <TD>
                        {r.errors.length === 0 ? (
                          <Badge tone="success">OK</Badge>
                        ) : (
                          <ul className="text-xs font-semibold text-danger">
                            {r.errors.map((e) => (
                              <li key={e}>{e}</li>
                            ))}
                          </ul>
                        )}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </div>
          </section>
        )}
        <InlineError error={importMut.error} />
      </div>
    </Dialog>
  );
}
