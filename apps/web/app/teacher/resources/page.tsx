'use client';
import { useState } from 'react';
import Link from 'next/link';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Plus, Sparkles } from 'lucide-react';
import { RESOURCE_TYPES, type ResourceSummary, type ResourceType } from '@classiq/shared';
import {
  ButtonLink,
  Card,
  EmptyState,
  ErrorState,
  Field,
  Input,
  LoadingBlock,
  PageHeader,
  Select,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Tabs,
} from '@/components/ui';
import { RESOURCE_TYPE_INFO, RESOURCE_TYPE_LABEL, ResourceStatusBadge } from '@/components/teacher/resources/meta';
import { api } from '@/lib/api';
import { formatRelative, languageLabel } from '@/lib/format';

type Scope = 'mine' | 'shared';

export default function ResourcesPage() {
  const [scope, setScope] = useState<Scope>('mine');
  const [type, setType] = useState<ResourceType | ''>('');
  const [q, setQ] = useState('');
  const filters = { scope, type: type || undefined, q: q.trim() || undefined };
  const list = useQuery({
    queryKey: ['resources', 'list', filters],
    queryFn: () => api.get<ResourceSummary[]>('/resources', filters),
    placeholderData: keepPreviousData,
    refetchInterval: (query) => (query.state.data?.some((r) => r.status === 'queued' || r.status === 'generating') ? 5_000 : false),
  });
  const filtered = Boolean(type || q.trim());

  return (
    <>
      <PageHeader
        eyebrow="Teacher studio"
        title="AI teaching tools"
        description="Lesson plans, worksheets, question papers and presentations grounded in your courses, recorded lessons and notes. Share the good ones with your school."
        actions={
          <ButtonLink href="/teacher/resources/new" icon={<Plus className="size-4" aria-hidden />}>
            Create resource
          </ButtonLink>
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {RESOURCE_TYPES.map((t) => {
          const Icon = RESOURCE_TYPE_INFO[t].icon;
          return (
            <Link
              key={t}
              href={`/teacher/resources/new?type=${t}`}
              className="flex items-start gap-3 border border-line bg-surface p-4 shadow-card rounded-card hover:border-line-strong"
            >
              <Icon className="mt-0.5 size-5 shrink-0" aria-hidden />
              <span>
                <span className="block font-display font-extrabold">New {RESOURCE_TYPE_LABEL[t].toLowerCase()}</span>
                <span className="block text-xs text-muted">{RESOURCE_TYPE_INFO[t].description}</span>
              </span>
            </Link>
          );
        })}
      </div>

      <Tabs
        label="Resources"
        value={scope}
        onChange={setScope}
        tabs={[
          { value: 'mine', label: 'Mine' },
          { value: 'shared', label: 'School library' },
        ]}
      />
      <div className="my-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:max-w-2xl">
        <Field label="Type">
          {(p) => (
            <Select {...p} value={type} onChange={(e) => setType(e.target.value as ResourceType | '')}>
              <option value="">All types</option>
              {RESOURCE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {RESOURCE_TYPE_LABEL[t]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Search titles">
          {(p) => <Input {...p} type="search" value={q} onChange={(e) => setQ(e.target.value)} />}
        </Field>
      </div>

      <Card>
        {list.isPending ? (
          <LoadingBlock label="Loading resources…" />
        ) : list.isError ? (
          <ErrorState error={list.error} onRetry={() => void list.refetch()} />
        ) : list.data.length === 0 ? (
          <EmptyState
            icon={<Sparkles className="size-8" aria-hidden />}
            title={filtered ? 'No resources match these filters' : scope === 'mine' ? 'No resources yet' : 'Nothing shared yet'}
            description={
              filtered
                ? 'Try another type or search.'
                : scope === 'mine'
                  ? 'Create a lesson plan, worksheet, question paper or presentation in a minute.'
                  : 'When colleagues share resources with the school, they appear here.'
            }
            action={
              !filtered && scope === 'mine' ? (
                <ButtonLink href="/teacher/resources/new" icon={<Plus className="size-4" aria-hidden />}>
                  Create resource
                </ButtonLink>
              ) : undefined
            }
          />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Resource</TH>
                <TH>Type</TH>
                <TH>Status</TH>
                {scope === 'shared' && <TH>Teacher</TH>}
                <TH>Updated</TH>
              </TR>
            </THead>
            <TBody>
              {list.data.map((r) => (
                <TR key={r.id}>
                  <TD className="min-w-56">
                    <Link href={`/teacher/resources/${r.id}`} className="font-bold underline-offset-4 hover:underline">
                      {r.title}
                    </Link>
                    <p className="text-xs text-muted">
                      {r.course ? `${r.course.title} · ` : ''}
                      {languageLabel(r.language)}
                      {r.shared && scope === 'mine' ? ' · Shared with school' : ''}
                    </p>
                  </TD>
                  <TD className="whitespace-nowrap">{RESOURCE_TYPE_LABEL[r.type]}</TD>
                  <TD>
                    <ResourceStatusBadge status={r.status} />
                  </TD>
                  {scope === 'shared' && <TD className="whitespace-nowrap">{r.teacher.name}</TD>}
                  <TD className="whitespace-nowrap text-muted">{formatRelative(r.updatedAt)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </>
  );
}
