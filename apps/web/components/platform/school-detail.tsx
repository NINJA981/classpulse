'use client';
import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ban, KeyRound, Mail, PlayCircle, UserPlus } from 'lucide-react';
import {
  DEFAULT_INSTITUTION_FEATURES,
  type AuditLogPage,
  type CreatedSchoolAdmin,
  type InstitutionFeatures,
  type InstitutionLimits,
  type Paginated,
  type PasswordResetResult,
  type PlatformSchoolAdmin,
  type PlatformSchoolDetail,
  type PlatformSchoolView,
  type PlatformViewRow,
  type SendLinkResult,
} from '@classiq/shared';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Checkbox,
  Dialog,
  EmptyState,
  ErrorState,
  Field,
  InlineError,
  Input,
  LoadingBlock,
  PageHeader,
  Select,
  StatCard,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Tabs,
  Textarea,
  useToast,
} from '@/components/ui';
import { OneTimePasswordDialog } from '@/components/admin/common';
import { InviteStatusBadge } from '@/components/admin/invite-status';
import { useDebounced } from '@/components/admin/use-debounced';
import { ApiError, api } from '@/lib/api';
import { formatDateTime, formatRelative } from '@/lib/format';
import { platformKeys } from './queries';
import { SchoolOffboarding } from './school-offboarding';
import { SchoolStatusBadge } from './schools-list';

type Tab = 'overview' | 'admins' | 'people' | 'content' | 'devices' | 'features' | 'activity';

const nf = new Intl.NumberFormat('en-IN');

/* ---------------------------------------------------------------- read-only views */

const VIEW_LABEL: Record<PlatformSchoolView, string> = {
  teachers: 'Teachers',
  students: 'Students',
  sections: 'Sections',
  lessons: 'Lessons',
  exams: 'Exams',
  assignments: 'Assignments',
  devices: 'Devices',
  'live-sessions': 'Live sessions',
};

const ISO = /^\d{4}-\d{2}-\d{2}T/;
const fact = (v: string | number | null) => (v === null || v === '' ? '—' : typeof v === 'number' ? nf.format(v) : ISO.test(v) ? formatDateTime(v) : v);

function ViewTable({ schoolId, views }: { schoolId: string; views: PlatformSchoolView[] }) {
  const [view, setView] = useState<PlatformSchoolView>(views[0]!);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const debounced = useDebounced(q.trim(), 300);
  const data = useQuery({
    queryKey: platformKeys.view(schoolId, view, debounced, page),
    queryFn: () => api.get<Paginated<PlatformViewRow>>(`/platform/schools/${schoolId}/${view}`, { q: debounced, page }),
    placeholderData: (prev) => prev,
  });
  const factLabels = data.data?.items[0]?.facts.map((f) => f.label) ?? [];
  const pages = data.data ? Math.max(1, Math.ceil(data.data.total / data.data.pageSize)) : 1;

  return (
    <Card>
      <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-end">
        {views.length > 1 && (
          <Field label="Show" className="sm:w-48">
            {(p) => (
              <Select
                {...p}
                value={view}
                onChange={(e) => {
                  setView(e.target.value as PlatformSchoolView);
                  setPage(1);
                }}
              >
                {views.map((v) => (
                  <option key={v} value={v}>
                    {VIEW_LABEL[v]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}
        <Field label="Search" className="sm:w-72">
          {(p) => (
            <Input
              {...p}
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
            />
          )}
        </Field>
      </div>
      {data.isPending ? (
        <LoadingBlock />
      ) : data.isError ? (
        <ErrorState error={data.error} onRetry={() => void data.refetch()} />
      ) : data.data.items.length === 0 ? (
        <EmptyState title={`No ${VIEW_LABEL[view].toLowerCase()}`} description={debounced ? 'Nothing matches that search.' : 'This school has none yet.'} />
      ) : (
        <>
          <Table>
            <THead>
              <tr>
                <TH>{VIEW_LABEL[view].replace(/s$/, '')}</TH>
                <TH>Status</TH>
                {factLabels.map((l) => (
                  <TH key={l}>{l}</TH>
                ))}
                <TH>Created</TH>
              </tr>
            </THead>
            <TBody>
              {data.data.items.map((r) => (
                <TR key={r.id}>
                  <TD>
                    <p className="font-bold">{r.title}</p>
                    {r.subtitle && <p className="text-xs text-muted">{r.subtitle}</p>}
                  </TD>
                  <TD>{r.status ? <Badge>{r.status.replace(/_/g, ' ')}</Badge> : '—'}</TD>
                  {r.facts.map((f) => (
                    <TD key={f.label} className="whitespace-nowrap text-ink-2">
                      {fact(f.value)}
                    </TD>
                  ))}
                  <TD className="whitespace-nowrap text-muted">{r.at ? formatRelative(r.at) : '—'}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
          <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-3 text-sm">
            <span className="text-muted">
              {nf.format(data.data.total)} total · page {page} of {pages}
            </span>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </Card>
  );
}

/* ---------------------------------------------------------------- overview + profile */

function ProfileForm({ school }: { school: PlatformSchoolDetail }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [form, setForm] = useState({
    name: school.name,
    code: school.code,
    timezone: school.timezone,
    academicYear: school.academicYear ?? '',
    contactName: school.contact?.name ?? '',
    contactEmail: school.contact?.email ?? '',
    contactPhone: school.contact?.phone ?? '',
    notes: school.notes ?? '',
  });
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const save = useMutation({
    mutationFn: () =>
      api.patch<PlatformSchoolDetail>(`/platform/schools/${school.id}`, {
        name: form.name,
        code: form.code,
        timezone: form.timezone,
        academicYear: form.academicYear || null,
        contact: form.contactName || form.contactEmail || form.contactPhone ? { name: form.contactName, email: form.contactEmail, phone: form.contactPhone } : null,
        notes: form.notes || null,
      }),
    onSuccess: (s) => {
      qc.setQueryData(platformKeys.school(school.id), s);
      void qc.invalidateQueries({ queryKey: platformKeys.schools });
      toast('School profile saved');
    },
  });
  const fe = save.error instanceof ApiError ? save.error.fieldErrors : {};
  const submit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate();
  };
  return (
    <Card>
      <CardHeader eyebrow="Profile" title="School details" />
      <CardBody>
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
          <Field label="School name" required error={fe.name}>
            {(p) => <Input {...p} value={form.name} onChange={set('name')} />}
          </Field>
          <Field label="School code" required error={fe.code}>
            {(p) => <Input {...p} value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} />}
          </Field>
          <Field label="Time zone" error={fe.timezone}>
            {(p) => <Input {...p} value={form.timezone} onChange={set('timezone')} />}
          </Field>
          <Field label="Academic year" error={fe.academicYear}>
            {(p) => <Input {...p} value={form.academicYear} onChange={set('academicYear')} />}
          </Field>
          <Field label="Contact name">{(p) => <Input {...p} value={form.contactName} onChange={set('contactName')} />}</Field>
          <Field label="Contact email" error={fe['contact.email']}>
            {(p) => <Input {...p} type="email" value={form.contactEmail} onChange={set('contactEmail')} />}
          </Field>
          <Field label="Contact phone">{(p) => <Input {...p} type="tel" value={form.contactPhone} onChange={set('contactPhone')} />}</Field>
          <Field label="Notes" className="sm:col-span-2" hint="Visible to platform admins only">
            {(p) => <Textarea {...p} rows={3} value={form.notes} onChange={set('notes')} />}
          </Field>
          <div className="flex flex-col gap-3 sm:col-span-2">
            <InlineError error={save.error} />
            <div>
              <Button type="submit" loading={save.isPending} disabled={!form.name.trim() || !form.code.trim()}>
                Save details
              </Button>
            </div>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

function OverviewTab({ school }: { school: PlatformSchoolDetail }) {
  const c = school.counts;
  const x = school.extraCounts;
  const tiles: [string, number][] = [
    ['Admins', c.admins],
    ['Teachers', c.teachers],
    ['Students', c.students],
    ['Sections', c.sections],
    ['Lessons', c.lessons],
    ['Exams', x.exams],
    ['Assignments', x.assignments],
    ['Live sessions', x.liveSessions],
    ['Devices', x.devices],
  ];
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {tiles.map(([label, value]) => (
          <StatCard key={label} label={label} value={nf.format(value)} />
        ))}
      </div>
      <p className="text-sm text-muted">
        Created {formatDateTime(school.createdAt)} · last activity {school.lastActivityAt ? formatRelative(school.lastActivityAt) : 'never'}
      </p>
      <ProfileForm key={school.id} school={school} />
      <SchoolOffboarding school={school} />
    </div>
  );
}

/* ---------------------------------------------------------------- admins */

function AdminsTab({ schoolId }: { schoolId: string }) {
  const qc = useQueryClient();
  const toast = useToast();
  const admins = useQuery({
    queryKey: platformKeys.admins(schoolId),
    queryFn: () => api.get<PlatformSchoolAdmin[]>(`/platform/schools/${schoolId}/admins`),
  });
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [shown, setShown] = useState<{ title: string; who: string; password: string; invite?: CreatedSchoolAdmin['invite']; email?: string | null } | null>(null);
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: platformKeys.admins(schoolId) });
    void qc.invalidateQueries({ queryKey: platformKeys.school(schoolId) });
  };

  const create = useMutation({
    mutationFn: () => api.post<CreatedSchoolAdmin>(`/platform/schools/${schoolId}/admins`, { name, email }),
    onSuccess: (res) => {
      refresh();
      setAdding(false);
      setName('');
      setEmail('');
      setShown({ title: 'Admin created', who: `${res.admin.name} (${res.admin.email ?? ''})`, password: res.initialPassword, invite: res.invite, email: res.admin.email });
    },
  });
  const action = useMutation({
    mutationFn: async ({ admin, kind }: { admin: PlatformSchoolAdmin; kind: 'disable' | 'enable' | 'reset-password' | 'send-invite' }) => {
      const res = await api.post<PasswordResetResult | SendLinkResult | PlatformSchoolAdmin>(`/platform/schools/${schoolId}/admins/${admin.id}/${kind}`);
      return { admin, kind, res };
    },
    onSuccess: ({ admin, kind, res }) => {
      refresh();
      if (kind === 'reset-password') {
        setShown({ title: 'Password reset', who: `${admin.name} (${admin.email ?? ''})`, password: (res as PasswordResetResult).initialPassword });
      } else if (kind === 'send-invite') {
        toast((res as SendLinkResult).invite === 'queued' ? `Invitation emailed to ${admin.email}` : 'Email isn’t set up on this server.', (res as SendLinkResult).invite === 'queued' ? undefined : 'error');
      } else toast(kind === 'disable' ? `${admin.name} disabled` : `${admin.name} enabled`);
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Something went wrong', 'error'),
  });

  return (
    <Card>
      <CardHeader
        eyebrow="School admins"
        title="Admin accounts"
        actions={
          <Button size="sm" icon={<UserPlus className="size-4" aria-hidden />} onClick={() => setAdding(true)}>
            Add admin
          </Button>
        }
      />
      <CardBody className="px-0">
        {admins.isPending ? (
          <LoadingBlock />
        ) : admins.isError ? (
          <ErrorState error={admins.error} onRetry={() => void admins.refetch()} />
        ) : admins.data.length === 0 ? (
          <EmptyState title="No admins" description="Add an admin so the school can manage itself." />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Admin</TH>
                <TH>Status</TH>
                <TH>Invitation</TH>
                <TH>Last sign-in</TH>
                <TH className="text-right">Actions</TH>
              </tr>
            </THead>
            <TBody>
              {admins.data.map((a) => (
                <TR key={a.id}>
                  <TD>
                    <p className="font-bold">{a.name}</p>
                    <p className="text-xs text-muted">{a.email}</p>
                  </TD>
                  <TD>
                    <Badge tone={a.status === 'active' ? 'success' : 'neutral'}>{a.status}</Badge>
                  </TD>
                  <TD>
                    <InviteStatusBadge status={a.inviteStatus} />
                  </TD>
                  <TD className="whitespace-nowrap text-muted">{a.lastLoginAt ? formatRelative(a.lastLoginAt) : 'Never'}</TD>
                  <TD>
                    <div className="flex flex-wrap justify-end gap-1">
                      <Button variant="ghost" size="sm" icon={<KeyRound className="size-3.5" aria-hidden />} onClick={() => action.mutate({ admin: a, kind: 'reset-password' })}>
                        Reset password
                      </Button>
                      {a.status === 'active' && a.email && (
                        <Button variant="ghost" size="sm" icon={<Mail className="size-3.5" aria-hidden />} onClick={() => action.mutate({ admin: a, kind: 'send-invite' })}>
                          Send invite
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={a.status === 'active' ? <Ban className="size-3.5" aria-hidden /> : <PlayCircle className="size-3.5" aria-hidden />}
                        onClick={() => action.mutate({ admin: a, kind: a.status === 'active' ? 'disable' : 'enable' })}
                      >
                        {a.status === 'active' ? 'Disable' : 'Enable'}
                      </Button>
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </CardBody>

      <Dialog
        open={adding}
        onClose={() => !create.isPending && setAdding(false)}
        title="Add admin"
        description="The admin gets a one-time password (shown once) and an emailed set-password link."
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setAdding(false)} disabled={create.isPending}>
              Cancel
            </Button>
            <Button type="submit" form="add-admin" loading={create.isPending} disabled={!name.trim() || !email.trim()}>
              Add admin
            </Button>
          </>
        }
      >
        <form
          id="add-admin"
          className="flex flex-col gap-4"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
        >
          <Field label="Admin name" required>
            {(p) => <Input {...p} value={name} onChange={(e) => setName(e.target.value)} />}
          </Field>
          <Field label="Admin email" required>
            {(p) => <Input {...p} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />}
          </Field>
          <InlineError error={create.error} />
        </form>
      </Dialog>
      <OneTimePasswordDialog
        open={shown !== null}
        onClose={() => setShown(null)}
        title={shown?.title ?? ''}
        who={shown?.who ?? ''}
        password={shown?.password ?? null}
        invite={shown?.invite}
        email={shown?.email}
      />
    </Card>
  );
}

/* ---------------------------------------------------------------- features & limits */

const FEATURE_LABEL: Record<keyof InstitutionFeatures, string> = {
  exams: 'Exams',
  assignments: 'Assignments',
  liveQuiz: 'Live quiz',
  devices: 'Classroom devices (recording)',
  emailInvites: 'Email invitations',
  aiGrading: 'AI grading',
  teacherTools: 'Teacher tools (materials, papers, presentations)',
};

const LIMIT_FIELDS: { key: keyof InstitutionLimits; label: string; hint: string; step?: string }[] = [
  { key: 'maxStudents', label: 'Maximum students', hint: 'Enforced on create and CSV import' },
  { key: 'maxTeachers', label: 'Maximum teachers', hint: 'Enforced on create and CSV import' },
  { key: 'aiAudioMinutesPerMonth', label: 'AI audio minutes per month', hint: 'Transcription stops when used up. Empty = the platform default (3000)' },
  { key: 'storageGb', label: 'Storage (GB)', hint: 'Uploads are refused when used up. Empty = no limit', step: '0.1' },
];

function FeaturesTab({ school }: { school: PlatformSchoolDetail }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [features, setFeatures] = useState<InstitutionFeatures>({ ...DEFAULT_INSTITUTION_FEATURES, ...school.features });
  const [limits, setLimits] = useState<Record<keyof InstitutionLimits, string>>({
    maxStudents: school.limits.maxStudents?.toString() ?? '',
    maxTeachers: school.limits.maxTeachers?.toString() ?? '',
    aiAudioMinutesPerMonth: school.limits.aiAudioMinutesPerMonth?.toString() ?? '',
    storageGb: school.limits.storageGb?.toString() ?? '',
  });
  const onSaved = (s: PlatformSchoolDetail, msg: string) => {
    qc.setQueryData(platformKeys.school(school.id), s);
    void qc.invalidateQueries({ queryKey: platformKeys.schools });
    toast(msg);
  };
  const saveFeatures = useMutation({
    mutationFn: () => api.put<PlatformSchoolDetail>(`/platform/schools/${school.id}/features`, features),
    onSuccess: (s) => onSaved(s, 'Features saved'),
  });
  const saveLimits = useMutation({
    mutationFn: () =>
      api.put<PlatformSchoolDetail>(
        `/platform/schools/${school.id}/limits`,
        Object.fromEntries(LIMIT_FIELDS.map(({ key }) => [key, limits[key].trim() === '' ? null : Number(limits[key])])),
      ),
    onSuccess: (s) => onSaved(s, 'Limits saved'),
  });
  const fe = saveLimits.error instanceof ApiError ? saveLimits.error.fieldErrors : {};

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader eyebrow="Feature switches" title="Features" />
        <CardBody className="flex flex-col gap-3">
          <p className="text-sm text-muted">Switched-off features disappear from the school’s menus and their pages answer “switched off”.</p>
          {(Object.keys(FEATURE_LABEL) as (keyof InstitutionFeatures)[]).map((k) => (
            <Checkbox key={k} label={FEATURE_LABEL[k]} checked={features[k]} onChange={(e) => setFeatures((f) => ({ ...f, [k]: e.target.checked }))} />
          ))}
          <InlineError error={saveFeatures.error} />
          <div>
            <Button loading={saveFeatures.isPending} onClick={() => saveFeatures.mutate()}>
              Save features
            </Button>
          </div>
        </CardBody>
      </Card>
      <Card>
        <CardHeader eyebrow="Plan" title="Limits" />
        <CardBody>
          <form
            className="flex flex-col gap-4"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              saveLimits.mutate();
            }}
          >
            <p className="text-sm text-muted">Leave a field empty for no limit.</p>
            {LIMIT_FIELDS.map(({ key, label, hint, step }) => (
              <Field key={key} label={label} hint={hint} error={fe[key]}>
                {(p) => (
                  <Input
                    {...p}
                    type="number"
                    min={step ? 0.1 : 1}
                    step={step ?? '1'}
                    inputMode={step ? 'decimal' : 'numeric'}
                    placeholder="Unlimited"
                    value={limits[key]}
                    onChange={(e) => setLimits((l) => ({ ...l, [key]: e.target.value }))}
                  />
                )}
              </Field>
            ))}
            <InlineError error={saveLimits.error} />
            <div>
              <Button type="submit" loading={saveLimits.isPending}>
                Save limits
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}

/* ---------------------------------------------------------------- activity (audit, ops module) */

/** The audit API belongs to the ops module; until it exists this tab says so instead of failing. */
async function fetchActivity(schoolId: string): Promise<AuditLogPage | null> {
  for (const path of ['/platform/ops/audit', '/platform/audit']) {
    try {
      return await api.get<AuditLogPage>(path, { institutionId: schoolId, pageSize: 50 });
    } catch (err) {
      if (!(err instanceof ApiError && err.status === 404)) throw err;
    }
  }
  return null;
}

function ActivityTab({ schoolId }: { schoolId: string }) {
  const q = useQuery({ queryKey: platformKeys.activity(schoolId), queryFn: () => fetchActivity(schoolId) });
  if (q.isPending) return <LoadingBlock />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  if (!q.data) return <EmptyState title="Activity log not available yet" description="The audit log appears here once it is enabled on this server." />;
  if (q.data.items.length === 0) return <EmptyState title="No activity yet" description="Sign-ins and changes made by or to this school appear here." />;
  return (
    <Card>
      <Table>
        <THead>
          <tr>
            <TH>When</TH>
            <TH>Who</TH>
            <TH>Action</TH>
            <TH>Target</TH>
          </tr>
        </THead>
        <TBody>
          {q.data.items.map((e) => (
            <TR key={e.id}>
              <TD className="whitespace-nowrap text-muted">{formatDateTime(e.at)}</TD>
              <TD>
                <p className="font-bold">{e.actorName ?? e.actorType}</p>
                {e.actorRole && <p className="text-xs text-muted">{e.actorRole}</p>}
              </TD>
              <TD className="font-mono text-xs">{e.action}</TD>
              <TD className="text-xs text-muted">{e.targetType ?? '—'}</TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </Card>
  );
}

/* ---------------------------------------------------------------- suspend / reactivate */

function SuspendControls({ school }: { school: PlatformSchoolDetail }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [typed, setTyped] = useState('');
  const suspended = school.status === 'suspended';
  const mutation = useMutation({
    mutationFn: () =>
      suspended
        ? api.post<PlatformSchoolDetail>(`/platform/schools/${school.id}/reactivate`)
        : api.post<PlatformSchoolDetail>(`/platform/schools/${school.id}/suspend`, { reason }),
    onSuccess: (s) => {
      qc.setQueryData(platformKeys.school(school.id), s);
      void qc.invalidateQueries({ queryKey: platformKeys.schools });
      setOpen(false);
      setReason('');
      setTyped('');
      toast(s.status === 'suspended' ? `${s.name} suspended` : `${s.name} reactivated`);
    },
  });
  const ready = typed === school.code && (suspended || reason.trim().length >= 3);
  const close = () => {
    if (mutation.isPending) return;
    setOpen(false);
    setTyped('');
  };

  return (
    <>
      <Button variant="secondary" icon={suspended ? <PlayCircle className="size-4" aria-hidden /> : <Ban className="size-4" aria-hidden />} onClick={() => setOpen(true)}>
        {suspended ? 'Reactivate school' : 'Suspend school'}
      </Button>
      <Dialog
        open={open}
        onClose={close}
        title={suspended ? `Reactivate ${school.name}?` : `Suspend ${school.name}?`}
        description={
          suspended
            ? 'Its users can sign in again straight away.'
            : 'Every user of this school is signed out and refused until you reactivate it. No data is deleted.'
        }
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={close} disabled={mutation.isPending}>
              Cancel
            </Button>
            <Button type="submit" form="suspend-school" loading={mutation.isPending} disabled={!ready}>
              {suspended ? 'Reactivate' : 'Suspend'}
            </Button>
          </>
        }
      >
        <form
          id="suspend-school"
          className="flex flex-col gap-4"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (ready) mutation.mutate();
          }}
        >
          {!suspended && (
            <Field label="Reason" required hint="Recorded in the audit log">
              {(p) => <Textarea {...p} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />}
            </Field>
          )}
          <Field label={`Type ${school.code} to confirm`}>
            {(p) => <Input {...p} autoComplete="off" spellCheck={false} value={typed} onChange={(e) => setTyped(e.target.value)} />}
          </Field>
          <InlineError error={mutation.error} />
        </form>
      </Dialog>
    </>
  );
}

/* ---------------------------------------------------------------- page */

export function SchoolDetail({ id }: { id: string }) {
  const [tab, setTab] = useState<Tab>('overview');
  const school = useQuery({ queryKey: platformKeys.school(id), queryFn: () => api.get<PlatformSchoolDetail>(`/platform/schools/${id}`) });

  if (school.isPending) return <LoadingBlock />;
  if (school.isError) return <ErrorState error={school.error} onRetry={() => void school.refetch()} />;
  const s = school.data;

  return (
    <>
      <PageHeader
        back={{ href: '/platform/schools', label: 'Schools' }}
        eyebrow={s.code}
        title={
          <span className="inline-flex flex-wrap items-center gap-3">
            {s.name} <SchoolStatusBadge status={s.status} />
          </span>
        }
        description={s.status === 'suspended' ? `Suspended ${s.suspendedAt ? formatRelative(s.suspendedAt) : ''}: ${s.suspendedReason ?? ''}` : undefined}
        actions={<SuspendControls school={s} />}
      />
      <div className="mb-6">
        <Tabs
          label="School sections"
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'overview', label: 'Overview' },
            { value: 'admins', label: 'Admins', count: s.counts.admins },
            { value: 'people', label: 'People', count: s.counts.teachers + s.counts.students },
            { value: 'content', label: 'Content' },
            { value: 'devices', label: 'Devices', count: s.extraCounts.devices },
            { value: 'features', label: 'Features & limits' },
            { value: 'activity', label: 'Activity' },
          ]}
        />
      </div>
      {tab === 'overview' && <OverviewTab school={s} />}
      {tab === 'admins' && <AdminsTab schoolId={id} />}
      {tab === 'people' && <ViewTable key="people" schoolId={id} views={['teachers', 'students']} />}
      {tab === 'content' && <ViewTable key="content" schoolId={id} views={['sections', 'lessons', 'exams', 'assignments', 'live-sessions']} />}
      {tab === 'devices' && <ViewTable key="devices" schoolId={id} views={['devices']} />}
      {tab === 'features' && <FeaturesTab key={s.id} school={s} />}
      {tab === 'activity' && <ActivityTab schoolId={id} />}
    </>
  );
}
