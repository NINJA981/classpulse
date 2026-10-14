'use client';
import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CourseDetail, CourseInput } from '@classiq/shared';
import { Button, Dialog, Field, InlineError, Input, Select, Textarea } from '@/components/ui';
import { useTeacherSections } from '@/components/teacher/common';
import { ApiError, api } from '@/lib/api';

/** Create a course, or edit one (`course` given). Any level: school class, college course, diploma… */
export function CourseDialog({
  open,
  onClose,
  course,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  course?: CourseDetail;
  onSaved?: (course: CourseDetail) => void;
}) {
  const qc = useQueryClient();
  const sections = useTeacherSections();
  const [form, setForm] = useState({
    title: course?.title ?? '',
    level: course?.level ?? '',
    board: course?.board ?? '',
    subject: course?.subject ?? '',
    description: course?.description ?? '',
    sectionId: course?.section?.id ?? '',
  });
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = useMutation({
    mutationFn: (body: CourseInput) =>
      course ? api.patch<CourseDetail>(`/curriculum/courses/${course.id}`, body) : api.post<CourseDetail>('/curriculum/courses', body),
    onSuccess: (c) => {
      void qc.invalidateQueries({ queryKey: ['curriculum', 'courses'] });
      qc.setQueryData(['curriculum', 'courses', c.id], c);
      onSaved?.(c);
      onClose();
    },
  });
  const fieldErrors = save.error instanceof ApiError ? save.error.fieldErrors : {};

  function submit(e: FormEvent) {
    e.preventDefault();
    save.mutate({
      title: form.title.trim(),
      level: form.level.trim(),
      board: form.board.trim(),
      subject: form.subject.trim(),
      description: form.description.trim(),
      sectionId: form.sectionId || null,
    });
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={course ? 'Edit course' : 'New course'}
      description="Any level works: a school class, a college course, a diploma module…"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="course-form" loading={save.isPending} disabled={!form.title.trim()}>
            {course ? 'Save course' : 'Create course'}
          </Button>
        </>
      }
    >
      <form id="course-form" onSubmit={submit} className="space-y-4">
        <Field label="Title" required error={fieldErrors.title} hint="e.g. “Class 10 Science”, “B.Tech Data Structures”">
          {(p) => <Input {...p} maxLength={200} value={form.title} onChange={set('title')} />}
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Level" hint="Class 8, Semester 3…">
            {(p) => <Input {...p} maxLength={80} value={form.level} onChange={set('level')} />}
          </Field>
          <Field label="Board / university" hint="CBSE, Anna University…">
            {(p) => <Input {...p} maxLength={80} value={form.board} onChange={set('board')} />}
          </Field>
          <Field label="Subject">{(p) => <Input {...p} maxLength={120} value={form.subject} onChange={set('subject')} />}</Field>
        </div>
        <Field label="Description" hint="Optional: what the course covers. Used to ground AI output.">
          {(p) => <Textarea {...p} rows={3} maxLength={2000} value={form.description} onChange={set('description')} />}
        </Field>
        <Field label="Class that follows this course" hint="Optional">
          {(p) => (
            <Select {...p} value={form.sectionId} onChange={set('sectionId')}>
              <option value="">None</option>
              {(sections.data ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <InlineError error={save.error} />
      </form>
    </Dialog>
  );
}
