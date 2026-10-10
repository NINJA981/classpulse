'use client';
import { Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { MonitorUp } from 'lucide-react';
import { ButtonLink, Card, EmptyState, LoadingBlock } from '@/components/ui';
import { Projector } from '@/components/teacher/live/projector';

export default function PresentPage() {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <PresentContent />
    </Suspense>
  );
}

function PresentContent() {
  const { id } = useParams<{ id: string }>();
  const sessionId = useSearchParams().get('session');

  if (!sessionId)
    return (
      <Card>
        <EmptyState
          icon={<MonitorUp className="size-8" aria-hidden />}
          title="No live session selected"
          description="Open the projector view from the live quiz host screen."
          action={<ButtonLink href={`/teacher/lessons/${id}/live`}>Go to the live quiz</ButtonLink>}
        />
      </Card>
    );

  return <Projector sessionId={sessionId} />;
}
