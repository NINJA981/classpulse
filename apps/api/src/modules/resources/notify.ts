/**
 * "Your teaching resource is done" notifications for the teacher who asked for it (producer side; delivery
 * is modules/notifications). Sent once per (re)generation: the entity carries `generation_attempt`, and only
 * the job run that actually moved the resource to `ready` / `failed` calls these.
 */
import type { ResourceType } from '@classiq/shared';
import { quoteTitle } from '../../jobs/lessonNotify.js';
import { sendNotification } from '../../jobs/sendNotification.js';
import { GENERIC_FAILURE_MESSAGE } from '../../pipeline/errors.js';

export const RESOURCE_TYPE_NOUN: Record<ResourceType, string> = {
  lesson_plan: 'lesson plan',
  worksheet: 'worksheet',
  question_paper: 'question paper',
  presentation: 'presentation',
};

export interface ResourceRef {
  id: string;
  type: ResourceType;
  title: string;
  teacherId: string;
  institutionId: string;
  generationAttempt: number;
}

const base = (r: ResourceRef) => ({
  recipient: { userId: r.teacherId, institutionId: r.institutionId },
  link: `/teacher/resources/${r.id}`,
  entity: { type: 'resource' as const, id: r.id, attempt: r.generationAttempt },
});

export function notifyResourceReady(r: ResourceRef): void {
  sendNotification({
    ...base(r),
    kind: 'resource.ready',
    tone: 'success',
    title: `Your ${RESOURCE_TYPE_NOUN[r.type]} ${quoteTitle(r.title)} is ready.`,
    body: null,
  });
}

/** `reason` is the stored, sanitised failure reason (a PipelineError user message or the generic one). */
export function notifyResourceFailed(r: ResourceRef, reason: string | null | undefined): void {
  sendNotification({
    ...base(r),
    kind: 'resource.failed',
    tone: 'error',
    title: `We couldn’t create your ${RESOURCE_TYPE_NOUN[r.type]} ${quoteTitle(r.title)}.`,
    body: (reason?.trim() || GENERIC_FAILURE_MESSAGE).slice(0, 300),
  });
}
