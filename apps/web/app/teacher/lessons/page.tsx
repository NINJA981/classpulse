'use client';
import { Suspense } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { BookOpen, ChevronLeft, ChevronRight, Mic } from 'lucide-react';
import { LESSON_STATUSES, type LessonStatus, type LessonSummary, type Paginated } from '@classpulse/shared';
import {
  Button,
  ButtonLink,
  Card,
  EmptyState,
  ErrorState,
  Field,
  LoadingBlock,
  PageHeader,
  Select,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from '@/components/ui';
import { useTeacherSections } from '@/components/teacher/common';
import { LESSON_STATUS_LABEL, LessonStatusBadge } from '@/components/teacher/status';
import { api } from '@/lib/api';
import { formatDate, formatDuration } from '@/lib/format';

const PAGE_SIZE = 20;

export default function LessonsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Teacher studio"
        title="Lessons"
        description="Every recorded or uploaded class, its generated quiz, and its review status."
        actions={
          <ButtonLink href="/teacher/record" icon={<Mic className="size-4" aria-hidden />}>
            Record or upload
          </ButtonLink>
        }
      />
      <Suspense fallback={<LoadingBlock />}>
        <LessonsContent />
      </Suspense>
    </>
  );
}

function LessonsContent() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const statusParam = params.get('status');
  const status = LESSON_STATUSES.includes(statusParam as LessonStatus) ? (statusParam as LessonStatus) : undefined;
  const sectionId = params.get('sectionId') ?? undefined;
  const page = Math.max(1, Number(params.get('page')) || 1);

  const sectionsQ = useTeacherSections();
  const filters = { status, sectionId, page, pageSize: PAGE_SIZE };
  const q = useQuery({
    queryKey: ['lessons', filters],
    queryFn: () => api.get<Paginated<LessonSummary>>('/lessons', filters),
    placeholderData: keepPreviousData,
  });

  function setParams(next: Record<string, string | undefined>) {
    const sp = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v) sp.set(k, v);
      else sp.delete(k);
    }
    const qs = sp.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }

  const totalPages = q.data ? Math.max(1, Math.ceil(q.data.total / q.data.pageSize)) : 1;
  const filtered = Boolean(status || sectionId);

  return (
    <Card>
      <div className="flex flex-col gap-4 border-b border-line p-5 sm:flex-row sm:items-end">
        <Field label="Status" className="sm:w-56">
          {(p) => (
            <Select {...p} value={status ?? ''} onChange={(e) => setParams({ status: e.target.value || undefined, page: undefined })}>
              <option value="">All statuses</option>
              {LESSON_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {LESSON_STATUS_LABEL[s]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Section" className="sm:w-64">
          {(p) => (
            <Select
              {...p}
              value={sectionId ?? ''}
              disabled={sectionsQ.isPending}
              onChange={(e) => setParams({ sectionId: e.target.value || undefined, page: undefined })}
            >
              <option value="">All sections</option>
              {(sectionsQ.data ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        {filtered && (
          <Button variant="ghost" size="sm" className="sm:mb-1" onClick={() => setParams({ status: undefined, sectionId: undefined, page: undefined })}>
            Clear filters
          </Button>
        )}
      </div>

      {q.isPending ? (
        <LoadingBlock label="Loading lessons…" />
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : q.data.items.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="size-8" aria-hidden />}
          title={filtered ? 'No lessons match these filters' : 'No lessons yet'}
          description={
            filtered
              ? 'Try another status or section.'
              : 'Record a class with the classroom device or upload an audio file to generate your first quiz.'
          }
          action={
            filtered ? (
              <Button variant="secondary" onClick={() => setParams({ status: undefined, sectionId: undefined, page: undefined })}>
                Clear filters
              </Button>
            ) : (
              <ButtonLink href="/teacher/record">Record or upload</ButtonLink>
            )
          }
        />
      ) : (
        <>
          <Table aria-busy={q.isFetching}>
            <THead>
              <tr>
                <TH>Lesson</TH>
                <TH>Section</TH>
                <TH>Status</TH>
                <TH className="text-right">Questions</TH>
                <TH className="text-right">Length</TH>
                <TH>Created</TH>
              </tr>
            </THead>
            <TBody>
              {q.data.items.map((l) => (
                <TR key={l.id}>
                  <TD>
                    <Link href={`/teacher/lessons/${l.id}`} className="font-bold underline-offset-4 hover:underline">
                      {l.title}
                    </Link>
                    <p className="text-xs text-muted">{l.subject}</p>
                  </TD>
                  <TD className="text-ink-2">{l.section.name}</TD>
                  <TD>
                    <LessonStatusBadge status={l.status} />
                  </TD>
                  <TD className="text-right tabular-nums">{l.questionCount}</TD>
                  <TD className="text-right tabular-nums">{formatDuration(l.durationSec)}</TD>
                  <TD className="whitespace-nowrap text-ink-2">{formatDate(l.createdAt)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
          <div className="flex items-center justify-between gap-4 border-t border-line px-5 py-3 text-sm">
            <p className="text-muted">
              {q.data.total} {q.data.total === 1 ? 'lesson' : 'lessons'} · page {q.data.page} of {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                icon={<ChevronLeft className="size-4" aria-hidden />}
                disabled={page <= 1}
                onClick={() => setParams({ page: page - 1 > 1 ? String(page - 1) : undefined })}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setParams({ page: String(page + 1) })}
              >
                Next
                <ChevronRight className="size-4" aria-hidden />
              </Button>
            </div>
          </div>
        </>
      )}
    </Card>
  );
}
