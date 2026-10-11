'use client';
import { Fragment, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, Download, Search } from 'lucide-react';
import type { AuditLogEntry, AuditLogPage } from '@classpulse/shared';
import { Badge, Button, Card, CardBody, EmptyState, ErrorState, Field, Input, LoadingBlock, PageHeader, Select, Table, TBody, TD, TH, THead, TR } from '@/components/ui';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { downloadCsv, localToIso, opsKeys, useSchoolOptions } from './ops-common';

const PAGE_SIZE = 50;

interface Filters {
  actor: string;
  institutionId: string;
  action: string;
  from: string;
  to: string;
}

const EMPTY: Filters = { actor: '', institutionId: '', action: '', from: '', to: '' };

function query(f: Filters) {
  return {
    actor: f.actor.trim() || undefined,
    institutionId: f.institutionId || undefined,
    action: f.action.trim() || undefined,
    from: localToIso(f.from),
    to: localToIso(f.to),
  };
}

function actorLabel(a: AuditLogEntry) {
  if (a.actorType === 'system') return 'System';
  if (a.actorType === 'anonymous') return a.actorName ?? 'Anonymous';
  return a.actorName ?? a.actorId ?? 'Unknown';
}

function AuditRow({ a }: { a: AuditLogEntry }) {
  const [open, setOpen] = useState(false);
  const hasMeta = Boolean(a.metadata && Object.keys(a.metadata).length) || Boolean(a.ip);
  return (
    <Fragment>
      <TR>
        <TD className="whitespace-nowrap text-ink-2">{formatDateTime(a.at)}</TD>
        <TD>
          <span className="font-semibold">{actorLabel(a)}</span>
          {a.actorRole && <span className="ml-1 text-xs text-muted">({a.actorRole})</span>}
        </TD>
        <TD className="text-ink-2">{a.institutionName ?? '—'}</TD>
        <TD>
          <Badge tone={a.action.startsWith('platform.') ? 'accent' : 'neutral'}>{a.action}</Badge>
        </TD>
        <TD className="max-w-48 truncate text-ink-2">{a.targetType ? `${a.targetType}${a.targetId ? ` ${a.targetId}` : ''}` : '—'}</TD>
        <TD className="text-right">
          {hasMeta && (
            <Button
              variant="ghost"
              size="sm"
              aria-expanded={open}
              aria-label={`${open ? 'Hide' : 'Show'} details for ${a.action} at ${formatDateTime(a.at)}`}
              icon={open ? <ChevronDown className="size-3.5" aria-hidden /> : <ChevronRight className="size-3.5" aria-hidden />}
              onClick={() => setOpen((o) => !o)}
            >
              Details
            </Button>
          )}
        </TD>
      </TR>
      {open && (
        <tr className="border-b border-line bg-surface-2">
          <td colSpan={6} className="px-4 py-3">
            {a.ip && <p className="text-xs text-muted">IP {a.ip}</p>}
            {a.metadata && (
              <pre className="mt-1 max-h-72 overflow-auto whitespace-pre-wrap break-all font-mono text-xs text-ink-2">{JSON.stringify(a.metadata, null, 2)}</pre>
            )}
          </td>
        </tr>
      )}
    </Fragment>
  );
}

export function OpsAuditView() {
  const schools = useSchoolOptions();
  const [draft, setDraft] = useState<Filters>(EMPTY);
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [page, setPage] = useState(1);

  const audit = useQuery({
    queryKey: opsKeys.audit({ ...filters, page }),
    queryFn: () => api.get<AuditLogPage>('/platform/ops/audit', { ...query(filters), page, pageSize: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  const pages = audit.data ? Math.max(1, Math.ceil(audit.data.total / audit.data.pageSize)) : 1;

  return (
    <>
      <PageHeader
        eyebrow="Operations"
        title="Audit log"
        description="Who did what, across the platform and every school. Kept for 365 days."
        actions={
          <Button variant="secondary" icon={<Download className="size-4" aria-hidden />} onClick={() => downloadCsv('/platform/ops/audit.csv', query(filters))}>
            Export CSV
          </Button>
        }
      />

      <Card className="mb-4">
        <CardBody>
          <form
            className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
            onSubmit={(e) => {
              e.preventDefault();
              setFilters(draft);
              setPage(1);
            }}
          >
            <Field label="Actor" hint="Name or id">
              {(p) => <Input {...p} type="search" value={draft.actor} maxLength={120} onChange={(e) => setDraft({ ...draft, actor: e.target.value })} />}
            </Field>
            <Field label="School">
              {(p) => (
                <Select {...p} value={draft.institutionId} onChange={(e) => setDraft({ ...draft, institutionId: e.target.value })}>
                  <option value="">All schools</option>
                  {(schools.data ?? []).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Action" hint="Exact action or prefix, e.g. platform. or auth.login">
              {(p) => <Input {...p} value={draft.action} maxLength={80} onChange={(e) => setDraft({ ...draft, action: e.target.value })} />}
            </Field>
            <Field label="From">
              {(p) => <Input {...p} type="datetime-local" value={draft.from} onChange={(e) => setDraft({ ...draft, from: e.target.value })} />}
            </Field>
            <Field label="To">
              {(p) => <Input {...p} type="datetime-local" value={draft.to} onChange={(e) => setDraft({ ...draft, to: e.target.value })} />}
            </Field>
            <div className="flex flex-wrap items-end gap-2">
              <Button type="submit" icon={<Search className="size-4" aria-hidden />}>
                Apply filters
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setDraft(EMPTY);
                  setFilters(EMPTY);
                  setPage(1);
                }}
              >
                Reset
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>

      <Card>
        {audit.isPending ? (
          <LoadingBlock label="Loading audit log…" />
        ) : audit.error ? (
          <ErrorState error={audit.error} onRetry={() => void audit.refetch()} />
        ) : audit.data.items.length === 0 ? (
          <EmptyState title="No audit entries" description="Nothing matches these filters. Try a wider date range or reset the filters." />
        ) : (
          <>
            <Table aria-label="Audit entries">
              <THead>
                <tr>
                  <TH>When</TH>
                  <TH>Actor</TH>
                  <TH>School</TH>
                  <TH>Action</TH>
                  <TH>Target</TH>
                  <TH>
                    <span className="sr-only">Details</span>
                  </TH>
                </tr>
              </THead>
              <TBody>
                {audit.data.items.map((a) => (
                  <AuditRow key={a.id} a={a} />
                ))}
              </TBody>
            </Table>
            <nav aria-label="Audit pages" className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 text-sm">
              <p className="text-muted">
                {audit.data.total.toLocaleString('en-IN')} entr{audit.data.total === 1 ? 'y' : 'ies'} · page {page} of {pages}
              </p>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" disabled={page <= 1 || audit.isFetching} onClick={() => setPage((p) => p - 1)}>
                  Previous page
                </Button>
                <Button variant="secondary" size="sm" disabled={page >= pages || audit.isFetching} onClick={() => setPage((p) => p + 1)}>
                  Next page
                </Button>
              </div>
            </nav>
          </>
        )}
      </Card>
    </>
  );
}
