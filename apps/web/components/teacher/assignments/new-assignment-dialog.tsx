'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Assignment, AssignmentInput, CreateAssignmentInput, LessonSummary, Paginated } from '@classpulse/shared';
import { Dialog, Field, Select, useToast } from '@/components/ui';
import { useTeacherSections } from '@/components/teacher/common';
import { api } from '@/lib/api';
import { AssignmentForm } from './assignment-form';

/** "New assignment": pick a class (and optionally one of my lessons in it), then the assignment fields. */
export function NewAssignmentDialog({ open, onClose, defaultSectionId }: { open: boolean; onClose: () => void; defaultSectionId?: string }) {
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const sections = useTeacherSections();
  const [sectionId, setSectionId] = useState(defaultSectionId ?? '');
  const [lessonId, setLessonId] = useState('');
  const chosenSection = sectionId || sections.data?.[0]?.id || '';

  const lessons = useQuery({
    queryKey: ['lessons', { sectionId: chosenSection, pageSize: 100 }],
    queryFn: () => api.get<Paginated<LessonSummary>>('/lessons', { sectionId: chosenSection, pageSize: 100 }),
    enabled: open && Boolean(chosenSection),
  });

  const create = useMutation({
    mutationFn: (input: CreateAssignmentInput) => api.post<Assignment>('/assignments', input),
    onSuccess: (a) => {
      void qc.invalidateQueries({ queryKey: ['assignments'] });
      toast('Assignment created as a draft');
      onClose();
      router.push(`/teacher/assignments/${a.id}`);
    },
  });

  function submit(input: AssignmentInput) {
    if (!chosenSection) return;
    create.mutate({ ...input, sectionId: chosenSection, lessonId: lessonId || undefined });
  }

  return (
    <Dialog open={open} onClose={onClose} title="New assignment" description="It is saved as a draft. Publish it when you are ready." size="lg">
      <AssignmentForm initial={null} onSubmit={submit} pending={create.isPending} error={create.error} submitLabel="Create assignment" disabled={!chosenSection}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Class" required hint={sections.data?.length === 0 ? 'You are not assigned to any class yet.' : undefined}>
            {(p) => (
              <Select
                {...p}
                value={chosenSection}
                onChange={(e) => {
                  setSectionId(e.target.value);
                  setLessonId('');
                }}
              >
                {(sections.data ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.subject ? ` — ${s.subject}` : ''}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Lesson (optional)" hint="Attached assignments are published with their lesson.">
            {(p) => (
              <Select {...p} value={lessonId} onChange={(e) => setLessonId(e.target.value)} disabled={!lessons.data}>
                <option value="">None (standalone)</option>
                {(lessons.data?.items ?? []).map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.title}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
      </AssignmentForm>
    </Dialog>
  );
}
