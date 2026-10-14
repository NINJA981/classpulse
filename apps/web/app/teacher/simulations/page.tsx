'use client';
import { useCallback, useEffect, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Atom, Plus } from 'lucide-react';
import type { Simulation } from '@classiq/shared';
import {
  Button,
  Card,
  Dialog,
  EmptyState,
  ErrorState,
  Field,
  InlineError,
  Input,
  PageHeader,
  Select,
  Skeleton,
  useToast,
} from '@/components/ui';
import { api } from '@/lib/api';
import { AddLinkDialog } from '@/components/teacher/simulations/add-link-dialog';
import { ClassroomPlayer, PHET_ATTRIBUTION } from '@/components/teacher/simulations/classroom-player';
import { SimulationCard } from '@/components/teacher/simulations/simulation-card';
import { SIMULATION_SUBJECTS } from '@/components/teacher/simulations/subject-icon';

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export default function SimulationsPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [subject, setSubject] = useState('');
  const q = useDebounced(search.trim(), 250);
  const [adding, setAdding] = useState(false);
  const [playing, setPlaying] = useState<Simulation | null>(null);
  const [removing, setRemoving] = useState<Simulation | null>(null);

  const list = useQuery({
    queryKey: ['simulations', { q, subject }],
    queryFn: () => api.get<Simulation[]>('/simulations', { q, subject }),
    placeholderData: keepPreviousData,
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/simulations/links/${id}`),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['simulations'] });
      toast('Link removed');
      setRemoving(null);
    },
  });

  const copy = async (s: Simulation) => {
    try {
      await navigator.clipboard.writeText(s.url);
      toast(`Link to “${s.title}” copied. Paste it into your lesson or slides.`);
    } catch {
      toast('Could not copy the link. Use “Open in class” and copy it from there.', 'error');
    }
  };

  const exit = useCallback(() => setPlaying(null), []);
  const clear = () => {
    setSearch('');
    setSubject('');
  };

  return (
    <>
      <PageHeader
        eyebrow="Teacher studio"
        title="Simulations"
        description="Interactive simulations to project in class. Search by topic, open one full screen, or copy its link into a lesson."
        actions={
          <Button icon={<Plus className="size-4" aria-hidden />} onClick={() => setAdding(true)}>
            Add a link
          </Button>
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-[1fr_220px]">
        <Field label="Search simulations">
          {(p) => (
            <Input
              {...p}
              type="search"
              placeholder="e.g. Ohm's law, acids and bases, fractions"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          )}
        </Field>
        <Field label="Subject">
          {(p) => (
            <Select {...p} value={subject} onChange={(e) => setSubject(e.target.value)}>
              <option value="">All subjects</option>
              {SIMULATION_SUBJECTS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>

      {list.isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-hidden>
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      ) : list.isError ? (
        <Card>
          <ErrorState error={list.error} onRetry={() => void list.refetch()} />
        </Card>
      ) : list.data.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Atom className="size-8" aria-hidden />}
            title="No simulations match"
            description="Try a broader topic or another subject, or add a link to a simulation your school uses."
            action={
              <div className="flex gap-2">
                <Button variant="secondary" onClick={clear}>
                  Clear search
                </Button>
                <Button onClick={() => setAdding(true)}>Add a link</Button>
              </div>
            }
          />
        </Card>
      ) : (
        <>
          <p className="mb-3 text-xs text-muted" role="status">
            {list.data.length} simulation{list.data.length === 1 ? '' : 's'}
          </p>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Simulations">
            {list.data.map((s) => (
              <li key={s.id} className="flex">
                <SimulationCard
                  simulation={s}
                  onOpen={() => setPlaying(s)}
                  onCopy={() => void copy(s)}
                  onRemove={s.source === 'school' && s.mine ? () => setRemoving(s) : undefined}
                />
              </li>
            ))}
          </ul>
        </>
      )}

      <p className="mt-8 text-xs text-muted">
        Built-in simulations: {PHET_ATTRIBUTION}.{' '}
        <a
          href="https://phet.colorado.edu"
          target="_blank"
          rel="noopener noreferrer"
          className="font-bold underline underline-offset-4"
        >
          phet.colorado.edu
        </a>
      </p>

      <AddLinkDialog open={adding} onClose={() => setAdding(false)} />

      <Dialog
        open={removing !== null}
        onClose={() => {
          remove.reset();
          setRemoving(null);
        }}
        size="sm"
        title="Remove this link?"
        description={
          removing ? `“${removing.title}” will no longer appear for teachers in your school.` : undefined
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setRemoving(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={remove.isPending}
              onClick={() => removing && remove.mutate(removing.id)}
            >
              Remove link
            </Button>
          </>
        }
      >
        <InlineError error={remove.error} />
      </Dialog>

      {playing && <ClassroomPlayer simulation={playing} onExit={exit} />}
    </>
  );
}
