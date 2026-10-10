'use client';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { LoadingBlock, PageHeader } from '@/components/ui';
import { JoinForm } from '@/components/student/join/join-form';

function JoinWithParams() {
  const params = useSearchParams();
  return <JoinForm initialCode={params.get('code') ?? ''} />;
}

export default function JoinPage() {
  return (
    <div className="mx-auto max-w-lg">
      <PageHeader
        back={{ href: '/student', label: 'Home' }}
        eyebrow="Enrol"
        title="Join a class"
        description="Enter the class code from your teacher to see the class and join it."
      />
      <Suspense fallback={<LoadingBlock />}>
        <JoinWithParams />
      </Suspense>
    </div>
  );
}
