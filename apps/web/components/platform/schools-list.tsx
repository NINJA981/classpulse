'use client';
import { Suspense, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Search } from 'lucide-react';
import type { CreateSchoolResult, PlatformSchool } from '@classiq/shared';
import {
  Badge,
  Button,
  Card,
  Dialog,
  EmptyState,
  ErrorState,
  Field,
  InlineError,
  Input,
  LoadingBlock,
  PageHeader,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from '@/components/ui';
import { OneTimePasswordDialog } from '@/components/admin/common';
import { useDebounced } from '@/components/admin/use-debounced';
import { ApiError, api } from '@/lib/api';
import { formatRelative } from '@/lib/format';
import { platformKeys } from './queries';

const nf = new Intl.NumberFormat('en-IN');

export function SchoolStatusBadge({ status }: { status: PlatformSchool['status'] }) {
  return <Badge tone={status === 'active' ? 'success' : 'danger'}>{status === 'active' ? 'Active' : 'Suspended'}</Badge>;
}

const EMPTY = {
  name: '',
  code: '',
  timezone: 'Asia/Kolkata',
  academicYear: '',
  contactName: '',
  contactEmail: '',
  contactPhone: '',
  adminName: '',
  adminEmail: '',
};

function NewSchoolDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (r: CreateSchoolResult) => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState(EMPTY);
  const set = (k: keyof typeof EMPTY) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const create = useMutation({
    mutationFn: () =>
      api.post<CreateSchoolResult>('/platform/schools', {
        name: form.name,
        code: form.code,
        timezone: form.timezone,
        ...(form.academicYear.trim() && { academicYear: form.academicYear }),
        ...((form.contactName || form.contactEmail || form.contactPhone) && {
          contact: { name: form.contactName, email: form.contactEmail, phone: form.contactPhone },
        }),
        admin: { name: form.adminName, email: form.adminEmail },
      }),
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: platformKeys.schools });
      setForm(EMPTY);
      onCreated(res);
    },
  });
  const fe = create.error instanceof ApiError ? create.error.fieldErrors : {};
  const submit = (e: FormEvent) => {
    e.preventDefault();
    create.mutate();
  };
  const ready = form.name.trim() && form.code.trim() && form.adminName.trim() && form.adminEmail.trim();

  return (
    <Dialog
      open={open}
      onClose={() => !create.isPending && onClose()}
      title="New school"
      description="Creates the school with the default AI models and its first admin account."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={create.isPending}>
            Cancel
          </Button>
          <Button type="submit" form="new-school" loading={create.isPending} disabled={!ready}>
            Create school
          </Button>
        </>
      }
    >
      <form id="new-school" onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
        <Field label="School name" required error={fe.name}>
          {(p) => <Input {...p} value={form.name} onChange={set('name')} />}
        </Field>
        <Field label="School code" required hint="2–20 letters, digits or dashes; students may need it to sign in" error={fe.code}>
          {(p) => <Input {...p} value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} />}
        </Field>
        <Field label="Time zone" error={fe.timezone}>
          {(p) => <Input {...p} value={form.timezone} onChange={set('timezone')} />}
        </Field>
        <Field label="Academic year" hint="e.g. 2026-27" error={fe.academicYear}>
          {(p) => <Input {...p} value={form.academicYear} onChange={set('academicYear')} />}
        </Field>
        <p className="eyebrow sm:col-span-2">First admin</p>
        <Field label="Admin name" required error={fe['admin.name']}>
          {(p) => <Input {...p} value={form.adminName} onChange={set('adminName')} />}
        </Field>
        <Field label="Admin email" required hint="Gets an emailed set-password link when email is configured" error={fe['admin.email']}>
          {(p) => <Input {...p} type="email" value={form.adminEmail} onChange={set('adminEmail')} />}
        </Field>
        <p className="eyebrow sm:col-span-2">Contact (optional)</p>
        <Field label="Contact name">{(p) => <Input {...p} value={form.contactName} onChange={set('contactName')} />}</Field>
        <Field label="Contact email" error={fe['contact.email']}>
          {(p) => <Input {...p} type="email" value={form.contactEmail} onChange={set('contactEmail')} />}
        </Field>
        <Field label="Contact phone">{(p) => <Input {...p} type="tel" value={form.contactPhone} onChange={set('contactPhone')} />}</Field>
        <div className="sm:col-span-2">
          <InlineError error={create.error} />
        </div>
      </form>
    </Dialog>
  );
}

function SchoolsTable({ schools }: { schools: PlatformSchool[] }) {
  return (
    <Table>
      <THead>
        <tr>
          <TH>School</TH>
          <TH>Status</TH>
          <TH className="text-right">Admins</TH>
          <TH className="text-right">Teachers</TH>
          <TH className="text-right">Students</TH>
          <TH className="text-right">Lessons</TH>
          <TH>Last activity</TH>
        </tr>
      </THead>
      <TBody>
        {schools.map((s) => (
          <TR key={s.id}>
            <TD>
              <Link href={`/platform/schools/${s.id}`} className="font-bold hover:underline">
                {s.name}
              </Link>
              <p className="font-mono text-xs text-muted">{s.code}</p>
            </TD>
            <TD>
              <SchoolStatusBadge status={s.status} />
            </TD>
            <TD className="text-right tabular-nums">{nf.format(s.counts.admins)}</TD>
            <TD className="text-right tabular-nums">
              {nf.format(s.counts.teachers)}
              {s.limits.maxTeachers !== null && <span className="text-muted"> / {nf.format(s.limits.maxTeachers)}</span>}
            </TD>
            <TD className="text-right tabular-nums">
              {nf.format(s.counts.students)}
              {s.limits.maxStudents !== null && <span className="text-muted"> / {nf.format(s.limits.maxStudents)}</span>}
            </TD>
            <TD className="text-right tabular-nums">{nf.format(s.counts.lessons)}</TD>
            <TD className="whitespace-nowrap text-muted">{s.lastActivityAt ? formatRelative(s.lastActivityAt) : 'Never'}</TD>
          </TR>
        ))}
      </TBody>
    </Table>
  );
}

function SchoolsListInner() {
  const params = useSearchParams();
  const [q, setQ] = useState('');
  const debounced = useDebounced(q.trim(), 300);
  const [open, setOpen] = useState(params.get('new') === '1');
  const [created, setCreated] = useState<CreateSchoolResult | null>(null);
  const list = useQuery({
    queryKey: platformKeys.schoolList(debounced),
    queryFn: () => api.get<PlatformSchool[]>('/platform/schools', { q: debounced }),
  });

  return (
    <>
      <PageHeader
        eyebrow="Platform console"
        title="Schools"
        description="Every school on this installation, with its people, content and status."
        actions={
          <Button icon={<Plus className="size-4" aria-hidden />} onClick={() => setOpen(true)}>
            New school
          </Button>
        }
      />
      <div className="mb-4 max-w-sm">
        <Field label="Search schools">
          {(p) => (
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
              <Input {...p} className="pl-9" placeholder="Name or code" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
          )}
        </Field>
      </div>
      <Card>
        {list.isPending ? (
          <LoadingBlock />
        ) : list.isError ? (
          <ErrorState error={list.error} onRetry={() => void list.refetch()} />
        ) : list.data.length === 0 ? (
          <EmptyState
            title={debounced ? 'No matching schools' : 'No schools yet'}
            description={debounced ? 'Try another name or code.' : 'Create the first school and its admin account.'}
            action={!debounced && <Button onClick={() => setOpen(true)}>New school</Button>}
          />
        ) : (
          <SchoolsTable schools={list.data} />
        )}
      </Card>

      <NewSchoolDialog
        open={open}
        onClose={() => setOpen(false)}
        onCreated={(res) => {
          setOpen(false);
          setCreated(res);
        }}
      />
      <OneTimePasswordDialog
        open={created !== null}
        onClose={() => setCreated(null)}
        title={created ? `${created.school.name} created` : 'School created'}
        who={created ? `${created.admin.name} (${created.admin.email ?? ''})` : ''}
        password={created?.initialPassword ?? null}
        invite={created?.invite}
        email={created?.admin.email}
      />
    </>
  );
}

export function SchoolsList() {
  return (
    <Suspense>
      <SchoolsListInner />
    </Suspense>
  );
}
