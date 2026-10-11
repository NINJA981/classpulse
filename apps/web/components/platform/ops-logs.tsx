'use client';
import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { useQuery } from '@tanstack/react-query';
import { Download, Pause, Play, Search, Trash2 } from 'lucide-react';
import type { AppLogLine, AppLogPage, LogLevelName } from '@classpulse/shared';
import { Badge, Button, Card, CardBody, Checkbox, EmptyState, ErrorState, Field, Input, LoadingBlock, PageHeader, Select } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { downloadCsv, opsKeys, useSchoolOptions } from './ops-common';

const MAX_LINES = 2000;
const POLL_MS = 2000;

interface Filters {
  level: LogLevelName | '';
  service: string;
  institutionId: string;
  q: string;
}

const EMPTY: Filters = { level: '', service: '', institutionId: '', q: '' };

const LEVEL_CLASS: Record<string, string> = {
  fatal: 'text-danger',
  error: 'text-danger',
  warn: 'text-warning',
  info: 'text-ink-2',
};

const clock = (iso: string) =>
  new Intl.DateTimeFormat('en-IN', { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(
    new Date(iso),
  );

function query(f: Filters) {
  return { level: f.level || undefined, service: f.service || undefined, institutionId: f.institutionId || undefined, q: f.q || undefined };
}

function LogRow({ line }: { line: AppLogLine }) {
  const [open, setOpen] = useState(false);
  const hasDetails = Boolean(line.context || line.reqId || line.userId);
  return (
    <li className="border-b border-line last:border-b-0">
      <button
        type="button"
        aria-expanded={hasDetails ? open : undefined}
        disabled={!hasDetails}
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-7 w-full flex-wrap items-baseline gap-x-2 px-3 py-1 text-left font-mono text-xs hover:bg-surface-2 disabled:cursor-default"
      >
        <span className="shrink-0 text-muted tabular-nums">{clock(line.at)}</span>
        <span className={clsx('w-11 shrink-0 font-bold uppercase', LEVEL_CLASS[line.levelName] ?? 'text-muted')}>{line.levelName}</span>
        <span className="shrink-0 text-muted">{line.service}</span>
        {line.institutionName && <span className="shrink-0 text-muted">[{line.institutionName}]</span>}
        <span className="min-w-0 flex-1 basis-48 whitespace-pre-wrap break-words text-ink">{line.msg}</span>
      </button>
      {open && (
        <div className="bg-surface-2 px-3 py-2 font-mono text-xs text-ink-2">
          <p className="break-all">
            id {line.id}
            {line.reqId && ` · request ${line.reqId}`}
            {line.userId && ` · user ${line.userId}`}
            {line.institutionId && ` · school ${line.institutionId}`}
          </p>
          {line.context && <pre className="mt-1 max-h-80 overflow-auto whitespace-pre-wrap break-all">{JSON.stringify(line.context, null, 2)}</pre>}
        </div>
      )}
    </li>
  );
}

export function OpsLogsView() {
  const schools = useSchoolOptions();
  const [draft, setDraft] = useState<Filters>(EMPTY);
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [lines, setLines] = useState<AppLogLine[]>([]);
  const [paused, setPaused] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [tailError, setTailError] = useState<string | null>(null);
  const cursor = useRef<number | null>(null);
  const box = useRef<HTMLDivElement>(null);

  const initial = useQuery({
    queryKey: opsKeys.logs(filters),
    queryFn: () => api.get<AppLogPage>('/platform/ops/logs', { ...query(filters), limit: 200 }),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  // Seed the view (newest first from the API → oldest first on screen).
  useEffect(() => {
    if (!initial.data) return;
    const items = [...initial.data.items].reverse();
    setLines(items);
    cursor.current = Math.max(items.at(-1)?.id ?? 0, initial.data.latestId ?? 0);
  }, [initial.data]);

  // Live tail.
  useEffect(() => {
    if (paused || !initial.data) return;
    let cancelled = false;
    let busy = false;
    const tick = async () => {
      if (busy || cursor.current === null) return;
      busy = true;
      try {
        const page = await api.get<AppLogPage>('/platform/ops/logs', { ...query(filters), after: cursor.current, limit: 500 });
        if (cancelled) return;
        setTailError(null);
        if (page.items.length) {
          cursor.current = page.items.at(-1)!.id;
          setLines((prev) => {
            const next = [...prev, ...page.items];
            return next.length > MAX_LINES ? next.slice(next.length - MAX_LINES) : next;
          });
        }
      } catch (err) {
        if (!cancelled) setTailError(errorMessage(err));
      } finally {
        busy = false;
      }
    };
    const timer = setInterval(() => void tick(), POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [paused, filters, initial.data]);

  useEffect(() => {
    if (autoScroll && box.current) box.current.scrollTop = box.current.scrollHeight;
  }, [lines, autoScroll]);

  const apply = (next: Filters) => {
    setDraft(next);
    setFilters(next);
  };

  return (
    <>
      <PageHeader
        eyebrow="Operations"
        title="Logs"
        description="Warnings, errors, job messages and changes from the API and worker. Kept for 14 days."
        actions={
          <>
            <Button
              variant="secondary"
              icon={paused ? <Play className="size-4" aria-hidden /> : <Pause className="size-4" aria-hidden />}
              onClick={() => setPaused((p) => !p)}
              aria-pressed={paused}
            >
              {paused ? 'Resume live tail' : 'Pause live tail'}
            </Button>
            <Button variant="secondary" icon={<Download className="size-4" aria-hidden />} onClick={() => downloadCsv('/platform/ops/logs.csv', query(filters))}>
              Export CSV
            </Button>
          </>
        }
      />

      <Card className="mb-4">
        <CardBody>
          <form
            className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[repeat(4,minmax(0,1fr))_auto] lg:items-end"
            onSubmit={(e) => {
              e.preventDefault();
              apply(draft);
            }}
          >
            <Field label="Level">
              {(p) => (
                <Select {...p} value={draft.level} onChange={(e) => apply({ ...draft, level: e.target.value as Filters['level'] })}>
                  <option value="">All (info and above)</option>
                  <option value="warn">Warnings and errors</option>
                  <option value="error">Errors only</option>
                  <option value="fatal">Fatal only</option>
                </Select>
              )}
            </Field>
            <Field label="Service">
              {(p) => (
                <Select {...p} value={draft.service} onChange={(e) => apply({ ...draft, service: e.target.value })}>
                  <option value="">All services</option>
                  <option value="api">API</option>
                  <option value="worker">Worker</option>
                </Select>
              )}
            </Field>
            <Field label="School" hint={schools.data && schools.data.length === 0 ? 'School list unavailable' : undefined}>
              {(p) => (
                <Select {...p} value={draft.institutionId} onChange={(e) => apply({ ...draft, institutionId: e.target.value })}>
                  <option value="">All schools</option>
                  {(schools.data ?? []).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Message contains">
              {(p) => <Input {...p} type="search" value={draft.q} maxLength={200} onChange={(e) => setDraft({ ...draft, q: e.target.value })} />}
            </Field>
            <Button type="submit" variant="secondary" icon={<Search className="size-4" aria-hidden />}>
              Search
            </Button>
          </form>
        </CardBody>
      </Card>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-2.5">
          <p className="flex items-center gap-2 text-xs font-bold text-ink-2" role="status">
            {paused ? <Badge tone="warning">Paused</Badge> : <Badge tone="success">Live</Badge>}
            {lines.length.toLocaleString('en-IN')} line{lines.length === 1 ? '' : 's'}
            {lines.length >= MAX_LINES && ' (oldest dropped)'}
            {tailError && <span className="text-danger">· {tailError}</span>}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Checkbox label="Auto-scroll" checked={autoScroll} onChange={(e) => setAutoScroll(e.target.checked)} />
            <Button variant="ghost" size="sm" icon={<Trash2 className="size-3.5" aria-hidden />} onClick={() => setLines([])}>
              Clear view
            </Button>
          </div>
        </div>
        {initial.isPending ? (
          <LoadingBlock label="Loading logs…" />
        ) : initial.error ? (
          <ErrorState error={initial.error} onRetry={() => void initial.refetch()} />
        ) : lines.length === 0 ? (
          <EmptyState
            title="No log lines"
            description={paused ? 'Resume the live tail to see new lines.' : 'Nothing matches these filters yet. New lines appear here automatically.'}
          />
        ) : (
          <div ref={box} tabIndex={0} role="log" aria-label="Log lines" aria-live="off" className="max-h-[65vh] overflow-y-auto">
            <ul>
              {lines.map((l) => (
                <LogRow key={l.id} line={l} />
              ))}
            </ul>
          </div>
        )}
      </Card>
    </>
  );
}
