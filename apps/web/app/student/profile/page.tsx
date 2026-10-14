'use client';
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Compass, KeyRound } from 'lucide-react';
import type { SessionResponse, StudentSection, UpdateStudentProfileInput } from '@classiq/shared';
import {
  Button,
  ButtonLink,
  Card,
  CardBody,
  CardHeader,
  ErrorState,
  Field,
  InlineError,
  Input,
  PageHeader,
  Skeleton,
  useToast,
} from '@/components/ui';
import { SectionsList } from '@/components/student/common';
import { GuardiansCard } from '@/components/student/profile/guardians-card';
import { useTourControls } from '@/components/tour';
import { ApiError, api } from '@/lib/api';
import { useSessionUser } from '@/lib/session-context';

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

function ProfileCard() {
  const user = useSessionUser();
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const [email, setEmail] = useState(user.email ?? '');

  const save = useMutation({
    mutationFn: (body: UpdateStudentProfileInput) => api.patch<SessionResponse>('/student/profile', body),
    onSuccess: ({ user: updated }) => {
      setEmail(updated.email ?? '');
      toast('Profile saved');
      void qc.invalidateQueries({ queryKey: ['student', 'dashboard'] });
      // The session user comes from the server layout; refresh it.
      router.refresh();
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    save.mutate({ email: email.trim() ? email.trim() : null });
  }

  const emailError = save.error instanceof ApiError ? save.error.fieldErrors.email : undefined;
  const unchanged = email.trim() === (user.email ?? '');

  return (
    <Card>
      <CardBody className="flex flex-col gap-5">
        <div className="flex items-center gap-4">
          <span
            className="grid size-16 shrink-0 place-items-center rounded-full border-2 border-line-strong bg-accent font-display text-2xl font-black text-accent-ink"
            aria-hidden
          >
            {initials(user.name)}
          </span>
          <div className="min-w-0">
            <p className="truncate font-display text-xl font-black">{user.name}</p>
            <p className="text-sm text-muted">Roll number: {user.rollNumber ?? '—'}</p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="flex flex-col gap-3" noValidate>
          <Field label="Email" error={emailError} hint="Optional. Used for account notices from your school.">
            {(p) => (
              <Input
                {...p}
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (save.isError) save.reset();
                }}
                className="h-12 text-base"
              />
            )}
          </Field>
          {!emailError && <InlineError error={save.error} />}
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button type="submit" size="lg" loading={save.isPending} disabled={unchanged}>
              Save email
            </Button>
            <ButtonLink href="/change-password" variant="secondary" size="lg" icon={<KeyRound className="size-5" aria-hidden />}>
              Change password
            </ButtonLink>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

function ClassesCard() {
  const sections = useQuery({
    queryKey: ['student', 'sections'],
    queryFn: () => api.get<StudentSection[]>('/student/sections'),
  });
  return (
    <Card>
      <CardHeader eyebrow="Enrolled" title="My classes" />
      <CardBody>
        {sections.isPending ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
        ) : sections.isError ? (
          <ErrorState error={sections.error} onRetry={() => void sections.refetch()} />
        ) : sections.data.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <p className="text-sm text-muted">You haven’t joined any classes yet.</p>
            <ButtonLink href="/student/join" size="lg">
              Join a class
            </ButtonLink>
          </div>
        ) : (
          <SectionsList sections={sections.data} />
        )}
      </CardBody>
    </Card>
  );
}

function TourCard() {
  const tour = useTourControls();
  if (!tour) return null;
  return (
    <Card>
      <CardHeader eyebrow="Help" title="Guided tour" />
      <CardBody className="flex flex-col items-start gap-3">
        <p className="text-sm text-ink-2">New here, or forgot where something is? Walk through the student pages again, step by step.</p>
        <Button variant="secondary" size="lg" onClick={tour.start} icon={<Compass className="size-5" aria-hidden />}>
          Take the tour again
        </Button>
      </CardBody>
    </Card>
  );
}

export default function ProfilePage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <PageHeader eyebrow="Account" title="My profile" />
      <ProfileCard />
      <TourCard />
      <ClassesCard />
      <GuardiansCard />
    </div>
  );
}
