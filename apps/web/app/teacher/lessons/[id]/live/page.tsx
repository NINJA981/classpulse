'use client';
import { Suspense, useState, type FormEvent } from 'react';
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Radio } from 'lucide-react';
import type { CreateLiveSessionInput, LiveSessionInfo } from '@classpulse/shared';
import {
  Button,
  ButtonLink,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  ErrorState,
  Field,
  InlineError,
  LoadingBlock,
  PageHeader,
  Select,
} from '@/components/ui';
import { LiveHost } from '@/components/teacher/live/live-host';
import { useLesson } from '@/components/teacher/lesson/use-lesson';
import { api } from '@/lib/api';

const TIME_LIMITS = [10, 20, 30, 45, 60];

export default function LiveHostPage() {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <LiveHostContent />
    </Suspense>
  );
}

function LiveHostContent() {
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const sessionId = params.get('session');
  const lessonQ = useLesson(id);

  const sessionQ = useQuery({
    queryKey: ['live-sessions', sessionId],
    queryFn: () => api.get<LiveSessionInfo>(`/live-sessions/${sessionId}`),
    enabled: Boolean(sessionId),
  });

  const header = (
    <PageHeader
      back={{ href: `/teacher/lessons/${id}`, label: 'Back to lesson' }}
      eyebrow="Live quiz"
      title={lessonQ.data?.title ?? 'Live quiz'}
      actions={
        sessionId && sessionQ.data?.status === 'ended' ? (
          <Button variant="secondary" onClick={() => router.replace(pathname)}>
            Run it again
          </Button>
        ) : null
      }
    />
  );

  if (lessonQ.isPending)
    return (
      <>
        {header}
        <LoadingBlock label="Loading lesson…" />
      </>
    );
  if (lessonQ.isError)
    return (
      <>
        {header}
        <ErrorState error={lessonQ.error} onRetry={() => lessonQ.refetch()} />
      </>
    );

  const lesson = lessonQ.data;

  if (sessionId) {
    return (
      <>
        {header}
        {sessionQ.isPending ? (
          <LoadingBlock label="Loading live session…" />
        ) : sessionQ.isError ? (
          <ErrorState error={sessionQ.error} onRetry={() => sessionQ.refetch()} />
        ) : (
          <LiveHost session={sessionQ.data} lessonId={id} />
        )}
      </>
    );
  }

  if (lesson.status !== 'published')
    return (
      <>
        {header}
        <Card>
          <EmptyState
            icon={<Radio className="size-8" aria-hidden />}
            title="Publish the lesson first"
            description="Only published lessons can be run as a live quiz. Review and approve the questions, then publish."
            action={<ButtonLink href={`/teacher/lessons/${id}`}>Go to the lesson</ButtonLink>}
          />
        </Card>
      </>
    );

  return (
    <>
      {header}
      <CreateSession
        lessonId={id}
        approvedCount={lesson.questions.filter((q) => q.status === 'approved').length}
        onCreated={(s) => router.replace(`${pathname}?session=${s.id}`)}
      />
    </>
  );
}

function CreateSession({
  lessonId,
  approvedCount,
  onCreated,
}: {
  lessonId: string;
  approvedCount: number;
  onCreated: (s: LiveSessionInfo) => void;
}) {
  const qc = useQueryClient();
  const [timeLimitSec, setTimeLimitSec] = useState(20);
  const create = useMutation({
    mutationFn: (input: CreateLiveSessionInput) => api.post<LiveSessionInfo>('/live-sessions', input),
    onSuccess: (s) => {
      qc.setQueryData(['live-sessions', s.id], s);
      onCreated(s);
    },
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    create.mutate({ lessonId, timeLimitSec });
  }

  return (
    <Card className="max-w-xl">
      <CardHeader eyebrow="New session" title="Run this quiz live in class" />
      <CardBody>
        <form onSubmit={submit} className="space-y-4">
          <p className="text-sm text-muted">
            Students join from their phones with a 6-digit PIN. {approvedCount} approved{' '}
            {approvedCount === 1 ? 'question' : 'questions'} will be asked one at a time; faster correct answers score more.
          </p>
          <Field label="Time per question">
            {(p) => (
              <Select {...p} value={timeLimitSec} onChange={(e) => setTimeLimitSec(Number(e.target.value))}>
                {TIME_LIMITS.map((t) => (
                  <option key={t} value={t}>
                    {t} seconds
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <InlineError error={create.error} />
          <Button type="submit" size="lg" icon={<Radio className="size-4" aria-hidden />} loading={create.isPending}>
            Create live session
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
