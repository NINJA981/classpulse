'use client';
import { useState, type ReactNode } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardList } from 'lucide-react';
import type { StartExamResponse, StudentExamListItem, StudentExamPaper } from '@classiq/shared';
import { ButtonLink, Card, EmptyState, ErrorState, LoadingBlock, PageHeader } from '@/components/ui';
import { examRequest, getExamToken, isDeviceConflict } from '@/components/student/exams/exam-api';
import { ExamLobby } from '@/components/student/exams/exam-lobby';
import { ExamPlayer } from '@/components/student/exams/exam-player';
import { ExamResultView } from '@/components/student/exams/exam-result';
import { api, errorMessage } from '@/lib/api';

/**
 * Lobby → player → result. A reload during the exam resumes straight into the
 * player when this tab still holds the device token; otherwise the lobby offers
 * "Resume exam" (which may be refused while another device holds the exam).
 */
export default function StudentExamPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ['student', 'exams'],
    queryFn: () => api.get<StudentExamListItem[]>('/student/exams'),
  });
  const item = list.data?.find((e) => e.id === id);

  const [storedToken] = useState(() => (typeof window === 'undefined' ? null : getExamToken(id)));
  const [session, setSession] = useState<StartExamResponse | null>(null);
  const [finished, setFinished] = useState<{ auto: boolean } | null>(null);
  const [locked, setLocked] = useState<string | null>(null);

  const resumeEnabled =
    item?.state === 'in_progress' && Boolean(storedToken) && !session && !finished && !locked;
  const resume = useQuery({
    queryKey: ['student', 'exams', id, 'attempt'],
    queryFn: () =>
      examRequest<StudentExamPaper>('GET', `/student/exams/${id}/attempt`, { token: storedToken }),
    enabled: resumeEnabled,
    retry: false,
    staleTime: Infinity,
    gcTime: 0,
    refetchOnWindowFocus: false,
  });

  const back = { href: '/student/exams', label: 'All exams' };
  const shell = (body: ReactNode, title = item?.title ?? 'Exam') => (
    <div className="mx-auto max-w-2xl">
      <PageHeader back={back} eyebrow="Exam" title={title} />
      {body}
    </div>
  );

  if (list.isPending) return shell(<LoadingBlock label="Loading exam…" />);
  if (list.isError) return shell(<ErrorState error={list.error} onRetry={() => void list.refetch()} />);
  if (!item)
    return shell(
      <Card>
        <EmptyState
          icon={<ClipboardList className="size-8" aria-hidden />}
          title="Exam not found"
          description="This exam is not available to you. It may belong to a class you are not in."
          action={<ButtonLink href="/student/exams">Back to exams</ButtonLink>}
        />
      </Card>,
    );

  const resumedPaper =
    resume.data?.status === 'in_progress' && storedToken && !locked
      ? { attemptToken: storedToken, paper: resume.data }
      : null;
  const active = session ?? resumedPaper;

  if (finished || item.state === 'submitted' || (resume.data && resume.data.status !== 'in_progress')) {
    return shell(<ExamResultView examId={id} autoSubmitted={finished?.auto} />);
  }

  if (active && !locked) {
    return (
      <ExamPlayer
        key={`${active.paper.attemptId}:${active.attemptToken}`}
        examId={id}
        initial={active.paper}
        token={active.attemptToken}
        onFinished={(reason) => {
          setSession(null);
          setFinished({ auto: reason === 'auto' || reason === 'time_up' });
          void qc.invalidateQueries({ queryKey: ['student', 'exams'] });
          void qc.invalidateQueries({ queryKey: ['student', 'dashboard'] });
        }}
        onLocked={(message) => {
          setSession(null);
          setLocked(message);
        }}
      />
    );
  }

  if (resumeEnabled && resume.isPending) return shell(<LoadingBlock label="Resuming your exam…" />);

  const lockedMessage = locked ?? (isDeviceConflict(resume.error) ? errorMessage(resume.error) : null);
  return shell(
    <ExamLobby
      exam={item}
      lockedMessage={lockedMessage}
      onStarted={(res) => {
        setLocked(null);
        setSession(res);
      }}
    />,
  );
}
