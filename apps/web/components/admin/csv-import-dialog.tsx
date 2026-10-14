'use client';
import { useState, type ChangeEvent, type ReactNode } from 'react';
import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { Download, FileDown, FileUp } from 'lucide-react';
import clsx from 'clsx';
import type { EmailDelivery } from '@classiq/shared';
import { Badge, Button, Dialog, Field, InlineError, Input, Table, TBody, TD, TH, THead, TR, useToast } from '@/components/ui';
import { Callout, downloadFile } from './common';
import { normalizeHeader, parseCsv, readFileAsText, toCsv } from './csv';

export interface CsvColumn<K extends string> {
  /** Field name in the request row; also the header written to the template. */
  key: K;
  /** Column heading in the preview table. */
  label: string;
  /** Accepted header spellings, already normalised (see normalizeHeader). */
  aliases: readonly string[];
  required?: boolean;
  mono?: boolean;
}

/** The subset of a zod schema this dialog needs (the web app has no direct zod dependency). */
export interface RowParser<Row> {
  safeParse(
    input: unknown,
  ): { success: true; data: Row } | { success: false; error: { issues: readonly { path: readonly PropertyKey[]; message: string }[] } };
}

/** An import response, normalised across kinds. `login` is the email or roll number. */
export interface ImportOutcome {
  created: { id: string; name: string; login: string; initialPassword: string; invite: EmailDelivery }[];
  skipped: { login: string; reason: string }[];
}

export interface CsvImportConfig<K extends string, Row> {
  noun: { one: string; many: string };
  title: string;
  columns: readonly CsvColumn<K>[];
  /** Values of this column must be unique in the file (compared case-insensitively). */
  uniqueKey: K;
  rowSchema: RowParser<Row>;
  maxRows: number;
  /** Template download: the header row is the column keys. */
  template: { filename: string; examples: string[][] };
  /** Heading of the login column in results and the credentials CSV header. */
  login: { label: string; csvHeader: string };
  credentialsFilePrefix: string;
  /** Query keys to invalidate after a successful import. */
  invalidate: QueryKey[];
}

interface PreviewRow<K extends string, Row> {
  line: number;
  raw: Record<K, string>;
  row: Row | null;
  errors: string[];
}

function buildPreview<K extends string, Row>(
  config: CsvImportConfig<K, Row>,
  text: string,
): { rows: PreviewRow<K, Row>[]; error: string | null } {
  const { headers, records } = parseCsv(text);
  const columnOf = new Map<K, string | undefined>(
    config.columns.map((c) => [c.key, headers.find((h) => c.aliases.includes(normalizeHeader(h)))]),
  );
  const missing = config.columns.filter((c) => c.required && !columnOf.get(c.key));
  if (missing.length > 0) {
    const required = config.columns.filter((c) => c.required).map((c) => `“${c.key}”`);
    const optional = config.columns.filter((c) => !c.required).map((c) => `“${c.key}”`);
    return {
      rows: [],
      error: `The CSV needs a header row with ${required.join(' and ')} columns.${optional.length ? ` ${optional.join(', ')} ${optional.length === 1 ? 'is' : 'are'} optional.` : ''} Download the template to see the format.`,
    };
  }
  if (records.length === 0) return { rows: [], error: `The CSV has a header row but no ${config.noun.many}.` };

  const seen = new Set<string>();
  const rows = records.map((rec, i): PreviewRow<K, Row> => {
    const raw = Object.fromEntries(
      config.columns.map((c) => {
        const col = columnOf.get(c.key);
        return [c.key, col ? (rec[col] ?? '') : ''];
      }),
    ) as Record<K, string>;
    // Empty optional cells are omitted rather than sent as "".
    const candidate = Object.fromEntries(Object.entries(raw).filter(([, v]) => v !== ''));
    const parsed = config.rowSchema.safeParse(candidate);
    const errors = parsed.success ? [] : parsed.error.issues.map((iss) => `${String(iss.path[0] ?? 'row')}: ${iss.message}`);
    const key = raw[config.uniqueKey].trim().toLowerCase();
    if (key) {
      if (seen.has(key)) errors.push(`${config.uniqueKey}: duplicate in this file`);
      seen.add(key);
    }
    return { line: i + 2, raw, row: parsed.success && errors.length === 0 ? parsed.data : null, errors };
  });
  return { rows, error: null };
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * Bulk import from a CSV file: download a template, parse + validate client-side, submit,
 * then report invitation emails and offer the one-time passwords once as a credentials CSV.
 */
export function CsvImportDialog<K extends string, Row>({
  config,
  description,
  extraFields,
  submit,
  onClose,
}: {
  config: CsvImportConfig<K, Row>;
  description: string;
  /** Extra form controls shown next to the file picker (e.g. a section to enrol into). */
  extraFields?: ReactNode;
  submit: (rows: Row[]) => Promise<ImportOutcome>;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewRow<K, Row>[] | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportOutcome | null>(null);
  const [downloaded, setDownloaded] = useState(false);

  const validRows = preview?.flatMap((r) => (r.row ? [r.row] : [])) ?? [];
  const invalidCount = (preview?.length ?? 0) - validRows.length;
  const tooMany = validRows.length > config.maxRows;

  const importMut = useMutation({
    mutationFn: () => submit(validRows),
    onSuccess: (res) => {
      for (const queryKey of config.invalidate) void qc.invalidateQueries({ queryKey });
      toast(`${plural(res.created.length, config.noun.one, config.noun.many)} imported${res.skipped.length ? `, ${res.skipped.length} skipped` : ''}`);
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
      const { rows, error } = buildPreview(config, await readFileAsText(file));
      setParseError(error);
      setPreview(error ? null : rows);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Could not read the file.');
    }
  }

  function downloadTemplate() {
    downloadFile(config.template.filename, toCsv(config.columns.map((c) => c.key), config.template.examples));
  }

  function downloadCredentials() {
    if (!result) return;
    const csv = toCsv(
      [config.login.csvHeader, 'name', 'initialPassword', 'invitationEmail'],
      result.created.map((c) => [c.login, c.name, c.initialPassword, INVITE_CSV[c.invite]]),
    );
    downloadFile(`${config.credentialsFilePrefix}-${new Date().toISOString().slice(0, 10)}.csv`, csv);
    setDownloaded(true);
  }

  if (result) {
    const queued = result.created.filter((c) => c.invite === 'queued').length;
    const noEmail = result.created.filter((c) => c.invite === 'no_email').length;
    const emailOff = result.created.some((c) => c.invite === 'email_disabled');
    return (
      <Dialog
        open
        onClose={onClose}
        title="Import complete"
        description={`${result.created.length} created · ${result.skipped.length} skipped`}
        size="lg"
        footer={
          <>
            <Button variant={downloaded || result.created.length === 0 ? 'primary' : 'secondary'} onClick={onClose}>
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
            <p className="text-sm font-semibold text-ink" role="status">
              {plural(queued, 'invitation email', 'invitation emails')} queued, {noEmail} without email
            </p>
          )}
          {emailOff && (
            <Callout title="Email isn’t set up on this server">
              No invitations were sent. Hand each person their one-time password from the credentials CSV.
            </Callout>
          )}
          {result.created.length > 0 && (
            <Callout title="One-time passwords are shown only once">
              {queued > 0
                ? 'Invited people choose their own password from the email. The one-time passwords are a fallback for anyone without email or whose email doesn’t arrive. '
                : ''}
              Download the credentials CSV now and keep it private. After closing this dialog the passwords can’t be shown again.
            </Callout>
          )}
          {result.created.length > 0 && (
            <section aria-label={`Created ${config.noun.many}`}>
              <p className="eyebrow mb-2">Created ({result.created.length})</p>
              <div className="max-h-64 overflow-y-auto border border-line rounded-control">
                <Table>
                  <THead>
                    <tr>
                      <TH>{config.login.label}</TH>
                      <TH>Name</TH>
                      <TH>Invitation</TH>
                      <TH>One-time password</TH>
                    </tr>
                  </THead>
                  <TBody>
                    {result.created.map((c) => (
                      <TR key={c.id}>
                        <TD className="font-mono text-xs">{c.login}</TD>
                        <TD>{c.name}</TD>
                        <TD>
                          <Badge tone={c.invite === 'queued' ? 'success' : 'neutral'}>{INVITE_LABEL[c.invite]}</Badge>
                        </TD>
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
                      <TH>{config.login.label}</TH>
                      <TH>Reason</TH>
                    </tr>
                  </THead>
                  <TBody>
                    {result.skipped.map((s, i) => (
                      <TR key={`${s.login}-${i}`}>
                        <TD className="font-mono text-xs">{s.login}</TD>
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
      title={config.title}
      description={description}
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
            Import {validRows.length || ''} {validRows.length === 1 ? config.noun.one : config.noun.many}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-ink-2">
          <span>Start from the template so the columns are right.</span>
          <Button variant="secondary" size="sm" icon={<FileDown className="size-4" aria-hidden />} onClick={downloadTemplate}>
            Download template
          </Button>
        </div>
        <div className={clsx('grid grid-cols-1 gap-4', extraFields && 'sm:grid-cols-2')}>
          <Field label="CSV file" required error={parseError} hint={fileName ?? 'Exported from Excel or Google Sheets as .csv'}>
            {(p) => <Input {...p} type="file" accept=".csv,text/csv" onChange={onFile} className="py-2 file:mr-3 file:border-0 file:bg-transparent file:font-bold" />}
          </Field>
          {extraFields}
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
            {tooMany && (
              <Callout tone="danger">
                At most {config.maxRows} {config.noun.many} can be imported at once. Split the file.
              </Callout>
            )}
            <div className="max-h-80 overflow-y-auto border border-line rounded-control">
              <Table>
                <THead>
                  <tr>
                    <TH>Line</TH>
                    {config.columns.map((c) => (
                      <TH key={c.key}>{c.label}</TH>
                    ))}
                    <TH>Check</TH>
                  </tr>
                </THead>
                <TBody>
                  {preview.map((r) => (
                    <TR key={r.line} className={clsx(r.errors.length > 0 && 'bg-danger-soft')}>
                      <TD className="tabular-nums text-muted">{r.line}</TD>
                      {config.columns.map((c) => (
                        <TD key={c.key} className={clsx(c.mono ? 'font-mono text-xs' : 'text-ink-2')}>
                          {r.raw[c.key] || <span className="text-muted">—</span>}
                        </TD>
                      ))}
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

const INVITE_LABEL: Record<EmailDelivery, string> = {
  queued: 'Email queued',
  no_email: 'No email',
  email_disabled: 'Not sent',
};

const INVITE_CSV: Record<EmailDelivery, string> = {
  queued: 'queued',
  no_email: 'no email address',
  email_disabled: 'email not configured',
};
