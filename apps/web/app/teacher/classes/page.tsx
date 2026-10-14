'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Check, Copy, DoorOpen, Users } from 'lucide-react';
import type { Section } from '@classiq/shared';
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  ErrorState,
  LoadingBlock,
  PageHeader,
  useToast,
} from '@/components/ui';
import { useTeacherSections } from '@/components/teacher/common';
import { formatDate } from '@/lib/format';

export default function ClassesPage() {
  const q = useTeacherSections();

  return (
    <>
      <PageHeader
        eyebrow="Teacher studio"
        title="My classes"
        description="Sections you teach. Share a section’s join code so students can enrol themselves."
      />
      {q.isPending ? (
        <LoadingBlock label="Loading your sections…" />
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : q.data.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Users className="size-8" aria-hidden />}
            title="You are not assigned to any section"
            description="Sections are created by your institution’s admin. Ask them to add you as a teacher."
          />
        </Card>
      ) : (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {q.data.map((s) => (
            <li key={s.id}>
              <SectionCard section={s} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function SectionCard({ section: s }: { section: Section }) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const expired = new Date(s.joinCodeExpiresAt).getTime() < Date.now();

  async function copy() {
    try {
      await navigator.clipboard.writeText(s.joinCode);
      setCopied(true);
      toast('Join code copied');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast('Could not copy — select the code and copy it manually.', 'error');
    }
  }

  return (
    <Card className="flex h-full flex-col">
      <CardHeader
        eyebrow={[s.grade && `Grade ${s.grade}`, s.subject].filter(Boolean).join(' · ') || 'Section'}
        title={s.name}
        actions={
          <Badge tone="neutral">
            <Users className="size-3" aria-hidden /> {s.studentCount}
          </Badge>
        }
      />
      <CardBody className="flex flex-1 flex-col gap-4">
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="eyebrow">Students</dt>
            <dd className="mt-1 font-bold">{s.studentCount}</dd>
          </div>
          <div>
            <dt className="eyebrow">Classroom</dt>
            <dd className="mt-1 inline-flex items-center gap-1 font-bold">
              <DoorOpen className="size-3.5" aria-hidden />
              {s.room?.name ?? 'Not assigned'}
            </dd>
          </div>
          {s.teachers.length > 1 && (
            <div className="col-span-2">
              <dt className="eyebrow">Co-teachers</dt>
              <dd className="mt-1">{s.teachers.map((t) => t.name).join(', ')}</dd>
            </div>
          )}
        </dl>

        <div className="border border-line bg-surface-2 p-3 rounded-control">
          <p className="eyebrow">Join code</p>
          <div className="mt-1 flex items-center justify-between gap-3">
            <span className="font-mono text-2xl font-black tracking-[0.2em]">{s.joinCode}</span>
            <Button
              variant="secondary"
              size="sm"
              icon={copied ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
              onClick={copy}
              aria-label={`Copy join code for ${s.name}`}
            >
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>
          <p className="mt-1 text-xs text-muted">
            {expired ? (
              <span className="font-bold text-danger">Expired on {formatDate(s.joinCodeExpiresAt)} — ask your admin for a new code.</span>
            ) : (
              <>Valid until {formatDate(s.joinCodeExpiresAt)}</>
            )}
          </p>
        </div>

        <div className="mt-auto flex flex-wrap gap-2">
          <ButtonLink variant="secondary" size="sm" href={`/teacher/lessons?sectionId=${s.id}`}>
            View lessons
          </ButtonLink>
          <ButtonLink variant="ghost" size="sm" href={`/teacher/record?sectionId=${s.id}`}>
            Record a class
          </ButtonLink>
          <Link href={`/teacher/lessons?sectionId=${s.id}&status=ready_for_review`} className="inline-flex min-h-6 items-center self-center text-xs font-bold underline underline-offset-4">
            Needs review
          </Link>
        </div>
      </CardBody>
    </Card>
  );
}
