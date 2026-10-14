'use client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { LESSON_PROCESSING_STATUSES, type LessonDetail, type LessonStatus } from '@classiq/shared';
import { api } from '@/lib/api';
import { useLessonProgressEvents } from '@/components/teacher/hooks';

const LIVE_STATUSES: readonly LessonStatus[] = [...LESSON_PROCESSING_STATUSES, 'recording'];

export const lessonKey = (id: string) => ['lessons', id] as const;

/**
 * Lesson detail. While the lesson is recording or being processed it polls every
 * 4 s and also applies `lesson:progress` pushes from the socket immediately.
 */
export function useLesson(id: string) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: lessonKey(id),
    queryFn: () => api.get<LessonDetail>(`/lessons/${id}`),
    refetchInterval: (query) => {
      const s = query.state.data?.status;
      return s && LIVE_STATUSES.includes(s) ? 4000 : false;
    },
  });

  const live = q.data ? LIVE_STATUSES.includes(q.data.status) : false;
  useLessonProgressEvents((p) => {
    if (p.lessonId !== id) return;
    const prev = qc.getQueryData<LessonDetail>(lessonKey(id));
    if (prev) qc.setQueryData<LessonDetail>(lessonKey(id), { ...prev, status: p.status, progress: p });
    // Leaving the pipeline: fetch the questions / failure reason.
    if (!LESSON_PROCESSING_STATUSES.includes(p.status)) {
      qc.invalidateQueries({ queryKey: lessonKey(id) });
      qc.invalidateQueries({ queryKey: [...lessonKey(id), 'transcript'] });
    }
  }, live);

  return q;
}
