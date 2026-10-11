'use client';
import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Simulation, SimulationLinkInput } from '@classpulse/shared';
import { Button, Dialog, Field, InlineError, Input, Select, Textarea, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { SIMULATION_SUBJECTS } from './subject-icon';

/** Hosts the API accepts (keep in sync with SIMULATION_HOST_ALLOWLIST in apps/api/src/modules/resources/simulations.ts). */
export const ALLOWED_SIMULATION_HOSTS = [
  'phet.colorado.edu',
  'geogebra.org',
  'www.geogebra.org',
  'www.desmos.com',
  'ophysics.com',
  'www.olabs.edu.in',
];

/** Lower-case host of an https URL; 'http' for a non-https URL; null when it is not a URL. */
function hostOf(raw: string): string | null {
  try {
    const u = new URL(raw.trim());
    return u.protocol === 'https:' ? u.hostname.toLowerCase() : 'http';
  } catch {
    return null;
  }
}

const EMPTY = { title: '', url: '', subject: '', description: '' };

export function AddLinkDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [form, setForm] = useState(EMPTY);
  const [urlError, setUrlError] = useState<string | null>(null);

  const add = useMutation({
    mutationFn: (input: SimulationLinkInput) => api.post<Simulation>('/simulations/links', input),
    onSuccess: async (sim) => {
      await qc.invalidateQueries({ queryKey: ['simulations'] });
      toast(`Added “${sim.title}” for your school`);
      setForm(EMPTY);
      onClose();
    },
  });

  const close = () => {
    add.reset();
    setUrlError(null);
    onClose();
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const host = hostOf(form.url);
    if (host === null) return setUrlError('Enter a full web address, e.g. https://www.geogebra.org/m/…');
    if (host === 'http') return setUrlError('Use a secure link that starts with https://');
    if (!ALLOWED_SIMULATION_HOSTS.includes(host))
      return setUrlError(`Links must be from ${ALLOWED_SIMULATION_HOSTS.join(', ')}`);
    setUrlError(null);
    add.mutate({
      title: form.title.trim(),
      url: form.url.trim(),
      subject: form.subject || undefined,
      description: form.description.trim() || undefined,
    });
  };

  const set = (k: keyof typeof EMPTY) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <Dialog
      open={open}
      onClose={close}
      title="Add a simulation link"
      description="Share an interactive from PhET, GeoGebra, Desmos, oPhysics or OLabs with every teacher in your school."
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" form="add-simulation-link" loading={add.isPending}>
            Add link
          </Button>
        </>
      }
    >
      <form id="add-simulation-link" className="flex flex-col gap-4" onSubmit={submit} noValidate>
        <Field label="Title" required>
          {(p) => <Input {...p} value={form.title} onChange={set('title')} maxLength={200} required />}
        </Field>
        <Field
          label="Link (https)"
          required
          error={urlError}
          hint={`Allowed sites: ${ALLOWED_SIMULATION_HOSTS.join(', ')}`}
        >
          {(p) => (
            <Input
              {...p}
              type="url"
              inputMode="url"
              placeholder="https://www.geogebra.org/m/…"
              value={form.url}
              onChange={set('url')}
              maxLength={1000}
              required
            />
          )}
        </Field>
        <Field label="Subject">
          {(p) => (
            <Select {...p} value={form.subject} onChange={set('subject')}>
              <option value="">Other</option>
              {SIMULATION_SUBJECTS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Description">
          {(p) => (
            <Textarea
              {...p}
              rows={3}
              value={form.description}
              onChange={set('description')}
              maxLength={1000}
            />
          )}
        </Field>
        <InlineError error={add.error} />
      </form>
    </Dialog>
  );
}
