'use client';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { RESOURCE_TYPES, type ResourceType } from '@classpulse/shared';
import { LoadingBlock, PageHeader } from '@/components/ui';
import { NewResourceForm } from '@/components/teacher/resources/new-resource-form';

export default function NewResourcePage() {
  return (
    <>
      <PageHeader
        eyebrow="AI teaching tools"
        title="Create a teaching resource"
        description="Pick what you need, ground it in your course, recorded lessons and notes, and describe it in your own words — typed or spoken."
        back={{ href: '/teacher/resources', label: 'AI teaching tools' }}
      />
      <Suspense fallback={<LoadingBlock />}>
        <NewResourceContent />
      </Suspense>
    </>
  );
}

function NewResourceContent() {
  const params = useSearchParams();
  const t = params.get('type');
  const type: ResourceType = (RESOURCE_TYPES as readonly string[]).includes(t ?? '') ? (t as ResourceType) : 'lesson_plan';
  return <NewResourceForm initialType={type} initialCourseId={params.get('courseId') ?? ''} initialUnitId={params.get('unitId') ?? ''} />;
}
