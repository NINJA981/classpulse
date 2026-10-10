'use client';
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Pencil, Trash2, UserPlus, Users } from 'lucide-react';
import type { Student } from '@classpulse/shared';
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
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from '@/components/ui';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { adminKeys, useSections } from '@/components/admin/queries';
import { InfoRow } from '@/components/admin/common';
import { SectionDialog } from '@/components/admin/sections/section-dialog';
import { JoinCodeCard, useRotateCode } from '@/components/admin/sections/join-code';
import { RosterDialog } from '@/components/admin/sections/roster-dialog';
import { useDeleteSection } from '@/components/admin/sections/use-delete-section';

const BACK = { href: '/admin/sections', label: 'All sections' };

export default function SectionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  // The API has no GET /sections/:id; the list is small and already cached by the sections page.
  const sections = useSections();
  const section = sections.data?.find((s) => s.id === id);

  const students = useQuery({
    queryKey: adminKeys.sectionStudents(id),
    queryFn: ({ signal }) => api.get<Student[]>(`/admin/sections/${id}/students`, undefined, signal),
    enabled: Boolean(section),
  });

  const [editing, setEditing] = useState(false);
  const [rosterOpen, setRosterOpen] = useState(false);
  const rotate = useRotateCode();
  const del = useDeleteSection(() => router.replace('/admin/sections'));

  if (sections.isPending) {
    return (
      <>
        <PageHeader title="Section" back={BACK} />
        <LoadingBlock label="Loading section…" />
      </>
    );
  }
  if (sections.error) {
    return (
      <>
        <PageHeader title="Section" back={BACK} />
        <Card>
          <ErrorState error={sections.error} onRetry={() => sections.refetch()} />
        </Card>
      </>
    );
  }
  if (!section) {
    return (
      <>
        <PageHeader title="Section not found" back={BACK} />
        <Card>
          <EmptyState
            title="This section doesn’t exist"
            description="It may have been deleted."
            action={<ButtonLink href="/admin/sections">Back to sections</ButtonLink>}
          />
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Section"
        title={section.name}
        back={BACK}
        actions={
          <>
            <Button variant="secondary" icon={<Pencil className="size-4" aria-hidden />} onClick={() => setEditing(true)}>
              Edit section
            </Button>
            <Button variant="secondary" icon={<Trash2 className="size-4" aria-hidden />} onClick={() => del.open(section)}>
              Delete section
            </Button>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader eyebrow="Details" title="Section info" />
          <CardBody>
            <dl>
              <InfoRow label="Grade">{section.grade || '—'}</InfoRow>
              <InfoRow label="Subject">{section.subject || '—'}</InfoRow>
              <InfoRow label="Room">{section.room?.name ?? '—'}</InfoRow>
              <InfoRow label="Teachers">
                {section.teachers.length ? (
                  <span className="flex flex-wrap gap-1">
                    {section.teachers.map((t) => (
                      <Badge key={t.id}>{t.name}</Badge>
                    ))}
                  </span>
                ) : (
                  '—'
                )}
              </InfoRow>
              <InfoRow label="Created">{formatDate(section.createdAt)}</InfoRow>
            </dl>
          </CardBody>
        </Card>
        <div className="lg:col-span-2">
          <JoinCodeCard section={section} onRotate={() => rotate.open(section)} />
        </div>
      </div>

      <Card className="mt-6">
        <CardHeader
          eyebrow={`${section.studentCount} enrolled`}
          title="Students"
          actions={
            <Button icon={<UserPlus className="size-4" aria-hidden />} onClick={() => setRosterOpen(true)} disabled={!students.data}>
              Edit roster
            </Button>
          }
        />
        <CardBody className="px-0 pb-2">
          {students.isPending ? (
            <LoadingBlock label="Loading students…" />
          ) : students.error ? (
            <ErrorState error={students.error} onRetry={() => students.refetch()} />
          ) : students.data.length === 0 ? (
            <EmptyState
              icon={<Users className="size-8" aria-hidden />}
              title="No students enrolled"
              description={`Add students with “Edit roster”, or share the join code ${section.joinCode} so students can enrol themselves.`}
              action={<Button onClick={() => setRosterOpen(true)}>Add students to roster</Button>}
            />
          ) : (
            <Table>
              <THead>
                <tr>
                  <TH>Roll no.</TH>
                  <TH>Name</TH>
                  <TH>Email</TH>
                  <TH>Status</TH>
                </tr>
              </THead>
              <TBody>
                {students.data.map((s) => (
                  <TR key={s.id}>
                    <TD className="font-mono text-xs">{s.rollNumber}</TD>
                    <TD className="font-semibold">{s.name}</TD>
                    <TD className="text-ink-2">{s.email ?? '—'}</TD>
                    <TD>{s.status === 'active' ? <Badge tone="success">Active</Badge> : <Badge>Disabled</Badge>}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardBody>
      </Card>

      {editing && <SectionDialog section={section} onClose={() => setEditing(false)} />}
      {rosterOpen && students.data && <RosterDialog section={section} enrolled={students.data} onClose={() => setRosterOpen(false)} />}
      {rotate.dialog}
      {del.dialog}
    </>
  );
}
