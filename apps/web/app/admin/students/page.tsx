'use client';
import { useState } from 'react';
import Link from 'next/link';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileUp, KeyRound, Mail, Pencil, Plus, Trash2, UserRound } from 'lucide-react';
import type { CreatedWithPassword, Paginated, Student } from '@classpulse/shared';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  Input,
  LoadingBlock,
  PageHeader,
  Select,
  Spinner,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
  useToast,
} from '@/components/ui';
import { api } from '@/lib/api';
import { adminKeys, useSections } from '@/components/admin/queries';
import { ConfirmDialog, OneTimePasswordDialog } from '@/components/admin/common';
import { Pager } from '@/components/admin/pager';
import { useDebounced } from '@/components/admin/use-debounced';
import { InviteStatusBadge } from '@/components/admin/invite-status';
import { useResetPassword, useSendInvite } from '@/components/admin/reset-password';
import { StudentDialog } from '@/components/admin/students/student-dialog';
import { ImportStudentsDialog } from '@/components/admin/students/import-dialog';

const PAGE_SIZE = 20;

export default function StudentsPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const sections = useSections();
  const [q, setQ] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [page, setPage] = useState(1);
  const debouncedQ = useDebounced(q.trim(), 300);

  const params = { q: debouncedQ, page, sectionId };
  const list = useQuery({
    queryKey: adminKeys.studentList(params),
    queryFn: ({ signal }) =>
      api.get<Paginated<Student>>('/admin/students', { q: debouncedQ, page, sectionId, pageSize: PAGE_SIZE }, signal),
    placeholderData: keepPreviousData,
  });

  const [editing, setEditing] = useState<Student | 'new' | null>(null);
  const [importing, setImporting] = useState(false);
  const [created, setCreated] = useState<CreatedWithPassword<Student> | null>(null);
  const [deleting, setDeleting] = useState<Student | null>(null);
  const resetPw = useResetPassword('students');
  const invite = useSendInvite('students');

  const remove = useMutation({
    mutationFn: (s: Student) => api.delete(`/admin/students/${s.id}`),
    onSuccess: (_, s) => {
      void qc.invalidateQueries({ queryKey: adminKeys.students });
      void qc.invalidateQueries({ queryKey: adminKeys.sections });
      void qc.invalidateQueries({ queryKey: adminKeys.overview });
      toast(`Student “${s.name}” deleted`);
      setDeleting(null);
      if (list.data && list.data.items.length === 1 && page > 1) setPage(page - 1);
    },
  });

  const actions = (
    <>
      <Button variant="secondary" icon={<FileUp className="size-4" aria-hidden />} onClick={() => setImporting(true)}>
        Import CSV
      </Button>
      <Button icon={<Plus className="size-4" aria-hidden />} onClick={() => setEditing('new')}>
        Add student
      </Button>
    </>
  );

  const filtered = Boolean(debouncedQ || sectionId);

  return (
    <>
      <PageHeader eyebrow="People" title="Students" description="Student accounts sign in with their roll number." actions={actions} />

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_16rem]">
        <Field label="Search students">
          {(p) => (
            <Input
              {...p}
              type="search"
              placeholder="Name or roll number"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
            />
          )}
        </Field>
        <Field label="Filter by section">
          {(p) => (
            <Select
              {...p}
              value={sectionId}
              onChange={(e) => {
                setSectionId(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All sections</option>
              {sections.data?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>

      <Card>
        {list.isPending ? (
          <LoadingBlock label="Loading students…" />
        ) : list.error && !list.data ? (
          <ErrorState error={list.error} onRetry={() => list.refetch()} />
        ) : list.data.items.length === 0 ? (
          filtered ? (
            <EmptyState
              title="No students match"
              description="Try a different search or section."
              action={
                <Button
                  variant="secondary"
                  onClick={() => {
                    setQ('');
                    setSectionId('');
                    setPage(1);
                  }}
                >
                  Clear filters
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={<UserRound className="size-8" aria-hidden />}
              title="No students yet"
              description="Add students one by one, or import a whole class from a CSV file."
              action={<div className="flex gap-2">{actions}</div>}
            />
          )
        ) : (
          <>
            <div className="relative">
              {list.isFetching && (
                <span className="absolute right-3 top-2">
                  <Spinner className="size-4" label="Refreshing" />
                </span>
              )}
              <Table>
                <THead>
                  <tr>
                    <TH>Roll no.</TH>
                    <TH>Name</TH>
                    <TH>Email</TH>
                    <TH>Sections</TH>
                    <TH>Status</TH>
                    <TH>Invite</TH>
                    <TH>
                      <span className="sr-only">Actions</span>
                    </TH>
                  </tr>
                </THead>
                <TBody>
                  {list.data.items.map((s) => (
                    <TR key={s.id}>
                      <TD className="font-mono text-xs">{s.rollNumber}</TD>
                      <TD className="font-semibold">{s.name}</TD>
                      <TD className="text-ink-2">{s.email ?? '—'}</TD>
                      <TD className="max-w-56">
                        {s.sections.length === 0 ? (
                          <span className="text-muted">—</span>
                        ) : (
                          <span className="flex flex-wrap gap-x-2 gap-y-1">
                            {s.sections.map((sec) => (
                              <Link key={sec.id} href={`/admin/sections/${sec.id}`} className="text-sm underline underline-offset-4">
                                {sec.name}
                              </Link>
                            ))}
                          </span>
                        )}
                      </TD>
                      <TD>{s.status === 'active' ? <Badge tone="success">Active</Badge> : <Badge tone="danger">Disabled</Badge>}</TD>
                      <TD>{s.email ? <InviteStatusBadge status={s.inviteStatus} /> : <span className="text-xs text-muted">No email</span>}</TD>
                      <TD>
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" icon={<Pencil className="size-3.5" aria-hidden />} aria-label={`Edit student ${s.name}`} onClick={() => setEditing(s)}>
                            Edit
                          </Button>
                          {s.email && s.inviteStatus !== 'accepted' && s.status === 'active' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              icon={<Mail className="size-3.5" aria-hidden />}
                              aria-label={`${s.inviteStatus === 'none' ? 'Send' : 'Resend'} invite to ${s.name}`}
                              loading={invite.pendingId === s.id}
                              onClick={() => invite.send({ id: s.id, name: s.name, login: s.rollNumber, email: s.email })}
                            >
                              {s.inviteStatus === 'none' ? 'Send invite' : 'Resend invite'}
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={<KeyRound className="size-3.5" aria-hidden />}
                            aria-label={`Reset password for ${s.name}`}
                            onClick={() => resetPw.open({ id: s.id, name: s.name, login: s.rollNumber, email: s.email })}
                          >
                            Reset password
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={<Trash2 className="size-3.5" aria-hidden />}
                            aria-label={`Delete student ${s.name}`}
                            onClick={() => {
                              remove.reset();
                              setDeleting(s);
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
            </div>
            <div className="border-t border-line px-4 py-3">
              <Pager page={list.data.page} pageSize={list.data.pageSize} total={list.data.total} onPage={setPage} />
            </div>
          </>
        )}
      </Card>

      {editing && (
        <StudentDialog
          student={editing === 'new' ? null : editing}
          defaultSectionId={sectionId || undefined}
          onClose={() => setEditing(null)}
          onCreated={(r) => {
            setEditing(null);
            setCreated(r);
          }}
        />
      )}
      {importing && <ImportStudentsDialog onClose={() => setImporting(false)} />}
      <OneTimePasswordDialog
        open={created !== null}
        onClose={() => setCreated(null)}
        title="Student created"
        who={created ? `${created.record.name} (roll ${created.record.rollNumber})` : ''}
        password={created?.initialPassword ?? null}
        invite={created?.invite}
        email={created?.record.email}
      />
      {resetPw.dialogs}
      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title="Delete student?"
        description={
          deleting && (
            <>
              <strong>{deleting.name}</strong> (roll {deleting.rollNumber}) will be removed along with their enrolments.
            </>
          )
        }
        confirmLabel="Delete student"
        onConfirm={() => deleting && remove.mutate(deleting)}
        pending={remove.isPending}
        error={remove.error}
      />
    </>
  );
}
