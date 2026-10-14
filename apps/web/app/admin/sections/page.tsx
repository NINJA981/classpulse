'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Pencil, Plus, RefreshCw, Trash2, Users } from 'lucide-react';
import type { Section } from '@classiq/shared';
import { Badge, Button, Card, EmptyState, ErrorState, LoadingBlock, PageHeader, Table, TBody, TD, TH, THead, TR } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { useSections } from '@/components/admin/queries';
import { CopyButton } from '@/components/admin/common';
import { SectionDialog } from '@/components/admin/sections/section-dialog';
import { isExpired, useRotateCode } from '@/components/admin/sections/join-code';
import { useDeleteSection } from '@/components/admin/sections/use-delete-section';

export default function SectionsPage() {
  const sections = useSections();
  const [editing, setEditing] = useState<Section | 'new' | null>(null);
  const rotate = useRotateCode();
  const del = useDeleteSection();

  const createButton = (
    <Button icon={<Plus className="size-4" aria-hidden />} onClick={() => setEditing('new')}>
      Create section
    </Button>
  );

  return (
    <>
      <PageHeader
        eyebrow="Academics"
        title="Sections"
        description="Class cohorts with their room, teachers and the join code students use to enrol."
        actions={createButton}
      />
      <Card>
        {sections.isPending ? (
          <LoadingBlock label="Loading sections…" />
        ) : sections.error ? (
          <ErrorState error={sections.error} onRetry={() => sections.refetch()} />
        ) : sections.data.length === 0 ? (
          <EmptyState
            icon={<Users className="size-8" aria-hidden />}
            title="No sections yet"
            description="Create a section for each class cohort, then assign teachers and enrol students."
            action={createButton}
          />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Section</TH>
                <TH>Grade</TH>
                <TH>Subject</TH>
                <TH>Room</TH>
                <TH>Teachers</TH>
                <TH className="text-right">Students</TH>
                <TH>Join code</TH>
                <TH>
                  <span className="sr-only">Actions</span>
                </TH>
              </tr>
            </THead>
            <TBody>
              {sections.data.map((s) => {
                const expired = isExpired(s.joinCodeExpiresAt);
                return (
                  <TR key={s.id}>
                    <TD>
                      <Link href={`/admin/sections/${s.id}`} className="font-bold underline-offset-4 hover:underline">
                        {s.name}
                      </Link>
                    </TD>
                    <TD className="text-ink-2">{s.grade || '—'}</TD>
                    <TD className="text-ink-2">{s.subject || '—'}</TD>
                    <TD className="text-ink-2">{s.room?.name ?? '—'}</TD>
                    <TD className="max-w-48 text-ink-2">{s.teachers.length ? s.teachers.map((t) => t.name).join(', ') : '—'}</TD>
                    <TD className="text-right tabular-nums">{s.studentCount}</TD>
                    <TD>
                      <div className="flex items-center gap-2">
                        <code className="font-mono text-sm font-bold tracking-widest">{s.joinCode}</code>
                        <CopyButton value={s.joinCode} label={`Copy join code for ${s.name}`} variant="ghost" />
                      </div>
                      <p className="text-xs text-muted">
                        {expired ? <Badge tone="danger">Expired</Badge> : `Expires ${formatDate(s.joinCodeExpiresAt)}`}
                      </p>
                    </TD>
                    <TD>
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" icon={<Pencil className="size-3.5" aria-hidden />} aria-label={`Edit section ${s.name}`} onClick={() => setEditing(s)}>
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<RefreshCw className="size-3.5" aria-hidden />}
                          aria-label={`Rotate join code for ${s.name}`}
                          onClick={() => rotate.open(s)}
                        >
                          Rotate
                        </Button>
                        <Button variant="ghost" size="sm" icon={<Trash2 className="size-3.5" aria-hidden />} aria-label={`Delete section ${s.name}`} onClick={() => del.open(s)}>
                          Delete
                        </Button>
                      </div>
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        )}
      </Card>

      {editing && <SectionDialog section={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      {rotate.dialog}
      {del.dialog}
    </>
  );
}
