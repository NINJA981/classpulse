'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { BookOpen, Library, Plus } from 'lucide-react';
import type { Course } from '@classiq/shared';
import { Button, Card, EmptyState, ErrorState, Field, Input, LoadingBlock, PageHeader, Select, Table, TBody, TD, TH, THead, TR } from '@/components/ui';
import { CatalogDialog } from '@/components/teacher/curriculum/catalog-dialog';
import { CourseDialog } from '@/components/teacher/curriculum/course-dialog';
import { useSessionUser } from '@/lib/session-context';
import { api } from '@/lib/api';

export default function CoursesPage() {
  const router = useRouter();
  const user = useSessionUser();
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [q, setQ] = useState('');
  const [mine, setMine] = useState<'' | 'true'>('');
  const filters = { q: q.trim() || undefined, mine: mine || undefined };
  const list = useQuery({
    queryKey: ['curriculum', 'courses', filters],
    queryFn: () => api.get<Course[]>('/curriculum/courses', filters),
    placeholderData: keepPreviousData,
  });
  const filtered = Boolean(q.trim() || mine);

  const actions = (
    <>
      <Button variant="secondary" icon={<Library className="size-4" aria-hidden />} onClick={() => setImporting(true)}>
        Import from catalog
      </Button>
      <Button icon={<Plus className="size-4" aria-hidden />} onClick={() => setCreating(true)}>
        New course
      </Button>
    </>
  );

  return (
    <>
      <PageHeader
        eyebrow="Teacher studio"
        title="Courses & materials"
        description="Your school's courses — any level, from Class 6 to college — with their units and your notes. AI teaching tools use them to stay on-syllabus."
        actions={actions}
      />

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:max-w-2xl">
        <Field label="Search courses">{(p) => <Input {...p} type="search" value={q} onChange={(e) => setQ(e.target.value)} />}</Field>
        <Field label="Show">
          {(p) => (
            <Select {...p} value={mine} onChange={(e) => setMine(e.target.value as '' | 'true')}>
              <option value="">All school courses</option>
              <option value="true">Courses I created</option>
            </Select>
          )}
        </Field>
      </div>

      <Card>
        {list.isPending ? (
          <LoadingBlock label="Loading courses…" />
        ) : list.isError ? (
          <ErrorState error={list.error} onRetry={() => void list.refetch()} />
        ) : list.data.length === 0 ? (
          <EmptyState
            icon={<BookOpen className="size-8" aria-hidden />}
            title={filtered ? 'No courses match' : 'No courses yet'}
            description={filtered ? 'Try another search.' : 'Create a course, or import NCERT/CBSE chapters or a college starter outline.'}
            action={filtered ? undefined : <div className="flex flex-wrap justify-center gap-2">{actions}</div>}
          />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Course</TH>
                <TH>Level</TH>
                <TH>Board</TH>
                <TH className="text-right">Units</TH>
                <TH>Created by</TH>
              </TR>
            </THead>
            <TBody>
              {list.data.map((c) => (
                <TR key={c.id}>
                  <TD className="min-w-56">
                    <Link href={`/teacher/courses/${c.id}`} className="font-bold underline-offset-4 hover:underline">
                      {c.title}
                    </Link>
                    <p className="text-xs text-muted">
                      {c.subject ?? ''}
                      {c.section ? `${c.subject ? ' · ' : ''}${c.section.name}` : ''}
                    </p>
                  </TD>
                  <TD className="whitespace-nowrap">{c.level ?? '—'}</TD>
                  <TD className="whitespace-nowrap">{c.board ?? '—'}</TD>
                  <TD className="text-right tabular-nums">{c.unitCount}</TD>
                  <TD className="whitespace-nowrap text-muted">{c.createdBy ? (c.createdBy.id === user.id ? 'You' : c.createdBy.name) : '—'}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      {creating && <CourseDialog open onClose={() => setCreating(false)} onSaved={(c) => router.push(`/teacher/courses/${c.id}`)} />}
      {importing && <CatalogDialog open onClose={() => setImporting(false)} />}
    </>
  );
}
