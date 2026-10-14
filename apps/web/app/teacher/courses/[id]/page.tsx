'use client';
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Sparkles, Trash2 } from 'lucide-react';
import type { CourseDetail } from '@classiq/shared';
import { Badge, Button, ButtonLink, Card, CardBody, CardHeader, ErrorState, LoadingBlock, PageHeader, useToast } from '@/components/ui';
import { ConfirmDialog } from '@/components/teacher/common';
import { CourseDialog } from '@/components/teacher/curriculum/course-dialog';
import { MaterialsPanel } from '@/components/teacher/curriculum/materials-panel';
import { UnitsEditor } from '@/components/teacher/curriculum/units-editor';
import { useSessionUser } from '@/lib/session-context';
import { api } from '@/lib/api';

export default function CoursePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const user = useSessionUser();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const q = useQuery({ queryKey: ['curriculum', 'courses', id], queryFn: () => api.get<CourseDetail>(`/curriculum/courses/${id}`) });

  const remove = useMutation({
    mutationFn: () => api.delete(`/curriculum/courses/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['curriculum', 'courses'] });
      toast('Course deleted');
      router.replace('/teacher/courses');
    },
  });

  if (q.isPending) return <LoadingBlock label="Loading course…" />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  const course = q.data;
  const editable = course.createdBy?.id === user.id;
  const meta = [course.level, course.board, course.subject].filter(Boolean).join(' · ');

  return (
    <>
      <PageHeader
        eyebrow="Course"
        title={course.title}
        back={{ href: '/teacher/courses', label: 'Courses & materials' }}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {meta && <span>{meta}</span>}
            {course.section && <Badge>{course.section.name}</Badge>}
            {course.catalogKey && <Badge tone="info">From catalog</Badge>}
            {!editable && <span>Created by {course.createdBy?.name ?? 'a former teacher'} · view only</span>}
          </span>
        }
        actions={
          <>
            <ButtonLink href={`/teacher/resources/new?courseId=${course.id}`} icon={<Sparkles className="size-4" aria-hidden />}>
              Create resource
            </ButtonLink>
            {editable && (
              <>
                <Button variant="secondary" icon={<Pencil className="size-4" aria-hidden />} onClick={() => setEditing(true)}>
                  Edit course
                </Button>
                <Button variant="ghost" icon={<Trash2 className="size-4" aria-hidden />} onClick={() => setDeleting(true)}>
                  Delete
                </Button>
              </>
            )}
          </>
        }
      />
      {course.description && <p className="mb-5 max-w-3xl whitespace-pre-line text-sm text-ink-2">{course.description}</p>}

      <div className="grid gap-5 xl:grid-cols-[3fr_2fr]">
        <Card>
          <CardHeader eyebrow={`${course.units.length} units`} title="Units" />
          <CardBody>
            <UnitsEditor course={course} editable={editable} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader eyebrow="Private to you" title="My materials" />
          <CardBody>
            <MaterialsPanel course={course} />
          </CardBody>
        </Card>
      </div>

      {editing && <CourseDialog open course={course} onClose={() => setEditing(false)} />}
      <ConfirmDialog
        open={deleting}
        onClose={() => setDeleting(false)}
        title="Delete this course?"
        description="Its units are deleted too. Materials and resources made from it are kept (they lose the link to the course)."
        confirmLabel="Delete course"
        danger
        loading={remove.isPending}
        error={remove.error}
        onConfirm={() => remove.mutate()}
      />
    </>
  );
}
