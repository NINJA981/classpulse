'use client';
import { PageHeader } from '@/components/ui';
import { ExamEditor } from '@/components/teacher/exams/exam-editor';

export default function NewExamPage() {
  return (
    <>
      <PageHeader
        back={{ href: '/teacher/exams', label: 'All exams' }}
        eyebrow="New exam"
        title="Create an exam"
      />
      <ExamEditor initial={null} />
    </>
  );
}
