/**
 * "Your lesson is done" notifications for the teacher who owns the lesson (producer side; delivery is
 * modules/notifications). Called once per end state of a generation attempt: transcribed, questions ready,
 * failed after the last retry, or failed by the stuck-lesson timeout. Re-enqueueing never notifies.
 *
 * De-duplication: the entity carries the lesson's `generation_attempt`, so the notifications core keeps one
 * notification per kind per attempt even if a job end is reported twice (e.g. a crash between commit and ack).
 *
 * Never throws and never delays the job: notification failures must not change a job's outcome or retries.
 */
import { GENERIC_FAILURE_MESSAGE } from '../pipeline/errors.js';
import { sendNotification as send } from './sendNotification.js';

export interface LessonRef {
  id: string;
  title: string;
  teacherId: string;
  institutionId: string;
  generationAttempt: number;
}

/** Keep notification titles short: long lesson titles are cut with an ellipsis. */
export function quoteTitle(title: string, max = 80): string {
  const t = title.trim().replace(/\s+/g, ' ') || 'Untitled lesson';
  return `“${t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t}”`;
}

const base = (lesson: LessonRef) => ({
  recipient: { userId: lesson.teacherId, institutionId: lesson.institutionId },
  link: `/teacher/lessons/${lesson.id}`,
  entity: { type: 'lesson' as const, id: lesson.id, attempt: lesson.generationAttempt },
});

export function notifyLessonTranscribed(lesson: LessonRef): void {
  send({
    ...base(lesson),
    kind: 'lesson.transcribed',
    tone: 'success',
    title: `${quoteTitle(lesson.title)} has been transcribed.`,
    body: 'Choose how many questions to write and how hard they should be.',
  });
}

export function notifyLessonReady(lesson: LessonRef, questionCount: number, appended: boolean): void {
  const noun = questionCount === 1 ? 'question' : 'questions';
  send({
    ...base(lesson),
    kind: 'lesson.ready',
    tone: 'success',
    title: `Questions are ready to review for ${quoteTitle(lesson.title)}.`,
    body: `${questionCount} ${appended ? 'new ' : ''}${noun} written from the recording.`,
  });
}

/**
 * `reason` is the lesson's stored failure reason: always a sanitised, teacher-facing sentence
 * (PipelineError.userMessage or the generic message), never a provider error or stack.
 */
export function notifyLessonFailed(lesson: LessonRef, reason: string | null | undefined): void {
  send({
    ...base(lesson),
    kind: 'lesson.failed',
    tone: 'error',
    title: `We couldn’t finish ${quoteTitle(lesson.title)}.`,
    body: (reason?.trim() || GENERIC_FAILURE_MESSAGE).slice(0, 300),
  });
}
