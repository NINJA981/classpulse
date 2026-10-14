'use client';
import { CheckCircle2, Circle, Loader2 } from 'lucide-react';
import type { ResourceStatus, ResourceType } from '@classiq/shared';
import { Card, CardBody } from '@/components/ui';
import { ProgressBar } from '@/components/teacher/common';
import { RESOURCE_TYPE_LABEL } from './meta';

/** Shown while a resource is queued or generating (the page polls every 3 s). */
export function ProcessingCard({ type, status }: { type: ResourceType; status: ResourceStatus }) {
  const generating = status === 'generating';
  const steps = [
    { label: 'Request received', done: true },
    { label: 'Reading your course, lessons and materials', done: generating },
    { label: `Writing the ${RESOURCE_TYPE_LABEL[type].toLowerCase()}`, done: false, active: generating },
  ];
  return (
    <Card>
      <CardBody className="space-y-5 py-8">
        <div>
          <p className="font-display text-lg font-extrabold">{generating ? 'Writing your resource…' : 'Waiting to start…'}</p>
          <p className="text-sm text-muted">This usually takes 20–60 seconds. You can leave this page; it keeps going.</p>
        </div>
        <ProgressBar value={generating ? 60 : 15} label="Generation progress" />
        <ol className="space-y-2 text-sm">
          {steps.map((s) => (
            <li key={s.label} className="flex items-center gap-2">
              {s.done ? (
                <CheckCircle2 className="size-4 text-success" aria-hidden />
              ) : s.active ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Circle className="size-4 text-muted" aria-hidden />
              )}
              <span className={s.done || s.active ? 'text-ink' : 'text-muted'}>{s.label}</span>
            </li>
          ))}
        </ol>
      </CardBody>
    </Card>
  );
}
