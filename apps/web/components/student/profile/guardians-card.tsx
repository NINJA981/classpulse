'use client';
import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Mail, Phone, Plus, Trash2, UsersRound } from 'lucide-react';
import type { Guardian, GuardianInput } from '@classiq/shared';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Checkbox,
  Dialog,
  ErrorState,
  Field,
  InlineError,
  Input,
  Select,
  Skeleton,
  useToast,
} from '@/components/ui';
import { ApiError, api } from '@/lib/api';

const RELATIONS: { value: GuardianInput['relation']; label: string }[] = [
  { value: 'mother', label: 'Mother' },
  { value: 'father', label: 'Father' },
  { value: 'guardian', label: 'Guardian' },
  { value: 'other', label: 'Other' },
];

const relationLabel = (r: Guardian['relation']) => RELATIONS.find((x) => x.value === r)?.label ?? r;

const EMPTY: GuardianInput = { name: '', relation: 'mother', phone: '', email: null, receiveUpdates: true };

function AddGuardianDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [form, setForm] = useState<GuardianInput>(EMPTY);

  const create = useMutation({
    mutationFn: (body: GuardianInput) => api.post<Guardian>('/student/guardians', body),
    onSuccess: (g) => {
      qc.setQueryData<Guardian[]>(['student', 'guardians'], (list) => (list ? [...list, g] : [g]));
      void qc.invalidateQueries({ queryKey: ['student', 'guardians'] });
      toast(`${g.name} added`);
      setForm(EMPTY);
      onClose();
    },
  });

  const errs = create.error instanceof ApiError ? create.error.fieldErrors : {};
  const set = <K extends keyof GuardianInput>(k: K, v: GuardianInput[K]) => setForm((f) => ({ ...f, [k]: v }));

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    create.mutate({ ...form, email: form.email?.trim() ? form.email.trim() : null });
  }

  function close() {
    create.reset();
    onClose();
  }

  return (
    <Dialog open={open} onClose={close} title="Add a guardian" description="Parents or guardians who should hear about your progress.">
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <Field label="Name" required error={errs.name}>
          {(p) => <Input {...p} autoComplete="name" value={form.name} onChange={(e) => set('name', e.target.value)} className="h-12 text-base" />}
        </Field>
        <Field label="Relation" required error={errs.relation}>
          {(p) => (
            <Select
              {...p}
              value={form.relation}
              onChange={(e) => set('relation', e.target.value as GuardianInput['relation'])}
              className="h-12 text-base"
            >
              {RELATIONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Phone" required error={errs.phone} hint="Include the country code if outside India, e.g. +91 98765 43210">
          {(p) => (
            <Input
              {...p}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={form.phone}
              onChange={(e) => set('phone', e.target.value)}
              className="h-12 text-base"
            />
          )}
        </Field>
        <Field label="Email (optional)" error={errs.email}>
          {(p) => (
            <Input
              {...p}
              type="email"
              inputMode="email"
              autoComplete="email"
              value={form.email ?? ''}
              onChange={(e) => set('email', e.target.value)}
              className="h-12 text-base"
            />
          )}
        </Field>
        <div className="flex min-h-11 items-center">
          <Checkbox
            label="Send them progress updates"
            checked={form.receiveUpdates}
            onChange={(e) => set('receiveUpdates', e.target.checked)}
          />
        </div>
        {Object.keys(errs).length === 0 && <InlineError error={create.error} />}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" size="lg" onClick={close} disabled={create.isPending}>
            Cancel
          </Button>
          <Button type="submit" size="lg" loading={create.isPending} disabled={!form.name.trim() || !form.phone.trim()}>
            Save guardian
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function DeleteGuardianDialog({ guardian, onClose }: { guardian: Guardian | null; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/student/guardians/${id}`),
    onSuccess: (_data, id) => {
      qc.setQueryData<Guardian[]>(['student', 'guardians'], (list) => list?.filter((g) => g.id !== id));
      void qc.invalidateQueries({ queryKey: ['student', 'guardians'] });
      toast('Guardian removed');
      onClose();
    },
  });

  function close() {
    remove.reset();
    onClose();
  }

  return (
    <Dialog
      open={guardian != null}
      onClose={close}
      size="sm"
      title="Remove guardian?"
      description={guardian ? `${guardian.name} will stop receiving updates about your progress.` : undefined}
      footer={
        <>
          <Button variant="secondary" size="lg" onClick={close} disabled={remove.isPending}>
            Cancel
          </Button>
          <Button variant="danger" size="lg" loading={remove.isPending} onClick={() => guardian && remove.mutate(guardian.id)}>
            Remove
          </Button>
        </>
      }
    >
      <InlineError error={remove.error} />
    </Dialog>
  );
}

export function GuardiansCard() {
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<Guardian | null>(null);
  const guardians = useQuery({
    queryKey: ['student', 'guardians'],
    queryFn: () => api.get<Guardian[]>('/student/guardians'),
  });

  return (
    <Card>
      <CardHeader
        eyebrow="Family"
        title="Guardians"
        actions={
          <Button size="lg" onClick={() => setAdding(true)} icon={<Plus className="size-5" aria-hidden />}>
            Add guardian
          </Button>
        }
      />
      <CardBody>
        {guardians.isPending ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
        ) : guardians.isError ? (
          <ErrorState error={guardians.error} onRetry={() => void guardians.refetch()} />
        ) : guardians.data.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <UsersRound className="size-8 text-muted" aria-hidden />
            <p className="font-bold">No guardians added</p>
            <p className="max-w-sm text-sm text-muted">Add a parent or guardian so they can receive updates about your progress.</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {guardians.data.map((g) => (
              <li key={g.id} className="flex items-start gap-3 rounded-control border border-line bg-surface p-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-bold">{g.name}</p>
                    <Badge tone="info">{relationLabel(g.relation)}</Badge>
                    {g.receiveUpdates && <Badge tone="success">Gets updates</Badge>}
                  </div>
                  <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-ink-2">
                    <Phone className="size-3.5" aria-hidden />
                    {g.phone}
                  </p>
                  {g.email && (
                    <p className="inline-flex items-center gap-1.5 break-all text-sm text-ink-2 sm:ml-4">
                      <Mail className="size-3.5 shrink-0" aria-hidden />
                      {g.email}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setDeleting(g)}
                  aria-label={`Remove ${g.name}`}
                  className="grid size-11 shrink-0 place-items-center rounded-control text-muted hover:bg-danger-soft hover:text-danger"
                >
                  <Trash2 className="size-5" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
      <AddGuardianDialog open={adding} onClose={() => setAdding(false)} />
      <DeleteGuardianDialog guardian={deleting} onClose={() => setDeleting(null)} />
    </Card>
  );
}
