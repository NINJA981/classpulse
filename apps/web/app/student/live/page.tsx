'use client';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { LoadingBlock, PageHeader } from '@/components/ui';
import { LivePlayer } from '@/components/student/live/live-player';

function LiveWithParams() {
  const params = useSearchParams();
  return <LivePlayer initialPin={params.get('pin') ?? ''} />;
}

export default function LivePage() {
  return (
    <div className="mx-auto max-w-xl">
      <PageHeader eyebrow="Play" title="Live quiz" />
      <Suspense fallback={<LoadingBlock />}>
        <LiveWithParams />
      </Suspense>
    </div>
  );
}
