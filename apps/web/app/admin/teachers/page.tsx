'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { GraduationCap, KeyRound, Pencil, Plus, Trash2 } from 'lucide-react';
import type { CreatedWithPassword, Teacher } from '@classpulse/shared';
import { Badge, Button, Card, EmptyState, ErrorState, LoadingBlock, PageHeader, Table, TBody, TD, TH, THead, TR, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { adminKeys, useTeachers } from '@/components/admin/queries';
import { ConfirmDialog, OneTimePasswordDialog } from '@/components/admin/common';
import { useResetPassword } from '@/components/admin/reset-password';
import { TeacherDialog } from '@/components/admin/teachers/teacher-dialog';

export default function TeachersPage() {
  const teachers = useTeachers();
  const qc = useQueryClient();
  const toast = useToast();
  const [editing, setEditing] = useState<Teacher | 'new' | null>(null);
  const [created, setCreated] = useState<CreatedWithPassword<Teacher> | null>(null);
  const [deleting, setDeleting] = useState<Teacher | null>(null);
  const resetPw = useResetPassword('teachers');

  const remove = useMutation({
    mutationFn: (t: Teacher) => api.delete(`/admin/teachers/${t.id}`),
    onSuccess: (_, t) => {
      void qc.invalidateQueries({ queryKey: adminKeys.teachers });
      void qc.invalidateQueries({ queryKey: adminKeys.sections });
      void qc.invalidateQueries({ queryKey: adminKeys.overview });
      toast(`Teacher “${t.name}” deleted`);
      setDeleting(null);
    },
  });

  const addButton = (
    <Button icon={<Plus className="size-4" aria-hidden />} onClick={() => setEditing('new')}>
      Add teacher
    </Button>
  );

  return (
    <>
      <PageHeader
        eyebrow="People"
        title="Teachers"
        description="Staff accounts that record classes, review generated quizzes and run live sessions."
        actions={addButton}
      />
      <Card>
        {teachers.isPending ? (
          <LoadingBlock label="Loading teachers…" />
        ) : teachers.error ? (
          <ErrorState error={teachers.error} onRetry={() => teachers.refetch()} />
        ) : teachers.data.length === 0 ? (
          <EmptyState
            icon={<GraduationCap className="size-8" aria-hidden />}
            title="No teachers yet"
            description="Add teachers so they can sign in and be assigned to sections."
            action={addButton}
          />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Name</TH>
                <TH>Email</TH>
                <TH>Department</TH>
                <TH>Sections</TH>
                <TH>Status</TH>
                <TH>
                  <span className="sr-only">Actions</span>
                </TH>
              </tr>
            </THead>
            <TBody>
              {teachers.data.map((t) => (
                <TR key={t.id}>
                  <TD className="font-semibold">{t.name}</TD>
                  <TD className="text-ink-2">{t.email}</TD>
                  <TD className="text-ink-2">{t.department ?? '—'}</TD>
                  <TD className="max-w-56">
                    {t.sections.length === 0 ? (
                      <span className="text-muted">—</span>
                    ) : (
                      <span className="flex flex-wrap gap-x-2 gap-y-1">
                        {t.sections.map((s) => (
                          <Link key={s.id} href={`/admin/sections/${s.id}`} className="text-sm underline underline-offset-4">
                            {s.name}
                          </Link>
                        ))}
                      </span>
                    )}
                  </TD>
                  <TD>{t.status === 'active' ? <Badge tone="success">Active</Badge> : <Badge tone="danger">Disabled</Badge>}</TD>
                  <TD>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" icon={<Pencil className="size-3.5" aria-hidden />} aria-label={`Edit teacher ${t.name}`} onClick={() => setEditing(t)}>
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<KeyRound className="size-3.5" aria-hidden />}
                        aria-label={`Reset password for ${t.name}`}
                        onClick={() => resetPw.open({ id: t.id, name: t.name, login: t.email })}
                      >
                        Reset password
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<Trash2 className="size-3.5" aria-hidden />}
                        aria-label={`Delete teacher ${t.name}`}
                        onClick={() => {
                          remove.reset();
                          setDeleting(t);
                        }}
                      >
                        Delete
                      </Button>
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      {editing && (
        <TeacherDialog
          teacher={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onCreated={(r) => {
            setEditing(null);
            setCreated(r);
          }}
        />
      )}
      <OneTimePasswordDialog
        open={created !== null}
        onClose={() => setCreated(null)}
        title="Teacher created"
        who={created ? `${created.record.name} (${created.record.email})` : ''}
        password={created?.initialPassword ?? null}
      />
      {resetPw.dialogs}
      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title="Delete teacher?"
        description={
          deleting && (
            <>
              <strong>{deleting.name}</strong>’s account will be removed. Teachers who own lessons can’t be deleted — set their
              status to Disabled instead.
            </>
          )
        }
        confirmLabel="Delete teacher"
        onConfirm={() => deleting && remove.mutate(deleting)}
        pending={remove.isPending}
        error={remove.error}
      />
    </>
  );
}
