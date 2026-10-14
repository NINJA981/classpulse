'use client';
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, GraduationCap, SearchX } from 'lucide-react';
import { JOIN_CODE_PATTERN, type SectionPreview, type StudentSection } from '@classiq/shared';
import { Button, ButtonLink, Card, CardBody, Field, InlineError, Input, Spinner, useToast } from '@/components/ui';
import { ApiError, api, errorMessage } from '@/lib/api';
import { Note } from '../common';

function normalizeCode(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 6);
}

function previewErrorText(err: unknown): string {
  if (err instanceof ApiError && err.status === 404) return 'No class found with that code. Check it with your teacher and try again.';
  if (err instanceof ApiError && err.status === 409) return err.message || 'This class code has expired. Ask your teacher for a new one.';
  return errorMessage(err);
}

export function JoinForm({ initialCode }: { initialCode: string }) {
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const [code, setCode] = useState(() => normalizeCode(initialCode));
  const complete = JOIN_CODE_PATTERN.test(code);

  const preview = useQuery({
    queryKey: ['student', 'join-preview', code],
    queryFn: () => api.get<SectionPreview>(`/student/sections/preview/${code}`),
    enabled: complete,
    staleTime: 0,
  });

  const join = useMutation({
    mutationFn: () => api.post<StudentSection>('/student/enrollments', { joinCode: code }),
    onSuccess: (section) => {
      toast(`You joined ${section.name}`);
      void qc.invalidateQueries({ queryKey: ['student'] });
      router.push('/student');
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (preview.data && !preview.data.alreadyEnrolled && !join.isPending) join.mutate();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
      <Card>
        <CardBody className="flex flex-col gap-3">
          <Field label="Class code" hint="6 letters or numbers, e.g. AB12CD. Your teacher shares this with the class.">
            {(p) => (
              <Input
                {...p}
                value={code}
                onChange={(e) => {
                  setCode(normalizeCode(e.target.value));
                  join.reset();
                }}
                autoComplete="off"
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                inputMode="text"
                maxLength={6}
                placeholder="AB12CD"
                className="h-16 text-center font-display text-3xl font-black uppercase tracking-[0.35em]"
              />
            )}
          </Field>
          {!complete && code.length > 0 && (
            <p className="text-xs text-muted" aria-live="polite">
              {6 - code.length} more {6 - code.length === 1 ? 'character' : 'characters'} to go
            </p>
          )}
          {complete && preview.isFetching && !preview.data && (
            <p className="inline-flex items-center gap-2 text-sm text-muted" role="status">
              <Spinner className="size-4" label="Looking up class" /> Looking up class…
            </p>
          )}
        </CardBody>
      </Card>

      {complete && preview.isError && (
        <Note tone="danger" icon={<SearchX className="size-5 text-danger" aria-hidden />}>
          <p role="alert" className="font-semibold text-danger">
            {previewErrorText(preview.error)}
          </p>
          <button type="button" onClick={() => void preview.refetch()} className="mt-1 min-h-11 text-sm font-bold underline underline-offset-4">
            Try again
          </button>
        </Note>
      )}

      {complete && preview.data && (
        <Card className="border-2 border-line-strong">
          <CardBody className="flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <span className="grid size-12 shrink-0 place-items-center rounded-full border-2 border-line-strong bg-accent" aria-hidden>
                <GraduationCap className="size-6" />
              </span>
              <div className="min-w-0">
                <p className="eyebrow mb-0.5">Class found</p>
                <h2 className="font-display text-xl font-black leading-tight">{preview.data.name}</h2>
                <p className="text-sm text-ink-2">
                  {[preview.data.subject, preview.data.grade && `Grade ${preview.data.grade}`].filter(Boolean).join(' · ') || 'Class'}
                </p>
                {preview.data.teachers.length > 0 && (
                  <p className="mt-1 text-sm text-muted">
                    {preview.data.teachers.length === 1 ? 'Teacher' : 'Teachers'}: {preview.data.teachers.join(', ')}
                  </p>
                )}
              </div>
            </div>

            {preview.data.alreadyEnrolled ? (
              <>
                <Note tone="success" icon={<CheckCircle2 className="size-5 text-success" aria-hidden />}>
                  <p className="font-semibold">You’re already in this class.</p>
                </Note>
                <ButtonLink href="/student" size="lg" variant="secondary">
                  Go to home
                </ButtonLink>
              </>
            ) : (
              <>
                <InlineError error={join.error} />
                <Button type="submit" size="lg" className="w-full" loading={join.isPending}>
                  Join class
                </Button>
              </>
            )}
          </CardBody>
        </Card>
      )}
    </form>
  );
}
