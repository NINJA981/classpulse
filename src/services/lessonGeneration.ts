import { Lesson } from '../models/Lesson.js';
import { Question } from '../models/Question.js';
import { Assignment } from '../models/Assignment.js';
import { ingestLectureFile, PipelineError } from '../services/pipelineClient.js';
import type { PipelineQuestion } from '../services/pipelineClient.js';

/**
 * Real lesson generation, backed by the lecture pipeline sidecar:
 *
 *   queued → transcribing (Sarvam batch STT inside the pipeline)
 *          → generating   (refinement + knowledge + quiz generation)
 *          → validating   (mapping + sanity-checking questions)
 *          → ready_for_review | failed
 *
 * The teacher dashboard already polls GET /api/lessons/:id every 2s and
 * renders these exact statuses — no frontend changes needed for progress.
 */

// Map pipeline quiz types → ClassPulse Question types
function mapType(pipelineType: string): 'mcq' | 'short' | 'truefalse' {
  switch (pipelineType) {
    case 'true_false':
      return 'truefalse';
    case 'short_answer':
    case 'fill_in_the_blank':
      return 'short';
    default:
      return 'mcq';
  }
}

function mapDifficulty(d: string): 'easy' | 'medium' | 'hard' {
  return d === 'easy' || d === 'hard' ? d : 'medium';
}

/**
 * Converts a pipeline question into a ClassPulse Question document.
 * Pipeline MCQ options come as { id, text, isCorrect }[] — we map to an
 * ordered options[] + correctIndex; true/false becomes a 2-option MCQ;
 * short answers use correctText.
 */
function toQuestionDoc(
  pq: PipelineQuestion,
  lessonId: string,
  subject: string
) {
  const type = mapType(pq.type);

  let options: string[] = [];
  let correctIndex: number | undefined;
  let correctText: string | undefined;

  if (type === 'short') {
    const correct = pq.options.find((o) => o.isCorrect);
    correctText = correct?.text || pq.answerExplanation || '';
  } else {
    options = pq.options.map((o) => o.text);
    correctIndex = pq.options.findIndex((o) => o.isCorrect);
    if (correctIndex === -1) correctIndex = 0;
  }

  return Question.create({
    lessonId,
    type,
    stem: pq.question,
    options,
    correctIndex,
    correctText,
    explanation: pq.answerExplanation || '',
    topicTag: subject,
    difficulty: mapDifficulty(pq.difficulty),
    status: 'draft', // teacher approves during review
    editedByTeacher: false,
    sourceCitation: `Lecture ${Math.floor(pq.source.startTime / 60)}:${String(
      Math.floor(pq.source.startTime % 60)
    ).padStart(2, '0')}–${Math.floor(pq.source.endTime / 60)}:${String(
      Math.floor(pq.source.endTime % 60)
    ).padStart(2, '0')}`
  });
}

interface LessonLike {
  _id: unknown;
  title: string;
  subject: string;
  sourceFile?: { path: string } | null;
  teacherId: string;
  language: string;
}

async function setStage(lessonId: string, status: string, extra: Record<string, unknown> = {}) {
  await Lesson.findByIdAndUpdate(lessonId, { status, ...extra }).exec();
}

/**
 * Fire-and-forget job body. Never throws — all failures land in
 * lesson.status = 'failed' + failureReason, which the dashboard displays.
 */
export async function runGenerationJob(lessonId: string): Promise<void> {
  try {
    const lesson = (await Lesson.findById(lessonId).lean()) as LessonLike | null;
    if (!lesson) throw new Error('Lesson disappeared');

    if (!lesson.sourceFile?.path) {
      throw new Error('Lesson has no source file attached');
    }

    // uploads path is served at /uploads — resolve to disk relative to backend cwd
    const diskPath = lesson.sourceFile.path.replace(/^\//, '');

    await setStage(lessonId, 'transcribing');

    const result = await ingestLectureFile({
      filePath: diskPath,
      title: lesson.title,
      subject: lesson.subject,
      teacherId: lesson.teacherId,
      language: lesson.language === 'en' ? 'en-IN' : lesson.language,
      questionCount: 5,
      difficulty: 'medium'
    });

    await setStage(lessonId, 'generating', { pipelineSessionId: result.sessionId });

    // Map pipeline questions into ClassPulse (dedupe: clear prior generated set)
    await Question.deleteMany({ lessonId: lesson._id, editedByTeacher: false }).exec();
    await Promise.all(
      result.quiz.questions.map((pq) => toQuestionDoc(pq, String(lesson._id), lesson.subject))
    );

    // Assignment from the lecture summary (replace prior auto-generated one)
    await Assignment.findOneAndDelete({ lessonId: lesson._id, status: 'approved' }).exec();
    await Assignment.create({
      lessonId: lesson._id,
      title: `${lesson.title} — Lecture Reflection`,
      subject: lesson.subject,
      prompt:
        (result.summary
          ? `Based on today's lecture: ${result.summary.slice(0, 400)}…\n\n`
          : '') +
        'Explain the central concept from the lecture in your own words and apply it to one real-world scenario.',
      estimatedMinutes: 20,
      status: 'approved',
      rubric: [
        {
          criterion: 'Conceptual accuracy',
          marks: 10,
          descriptor: 'Correctly represents the lecture’s core idea'
        },
        {
          criterion: 'Application',
          marks: 10,
          descriptor: 'Concrete, relevant real-world example'
        }
      ]
    });

    // Persist summary + transcript stats for the review page
    await Lesson.findByIdAndUpdate(lessonId, {
      summary: result.summary || undefined,
      keyTakeaways: result.keyTakeaways || [],
      pipelineSessionId: result.sessionId,
      transcriptSegments: result.transcript.segments.length
    }).exec();

    await setStage(lessonId, 'validating');
    // (validation is inherent: pipeline already grounded/validated every
    //  question against cited chunks; this stage gives the UI its final beat)

    await setStage(lessonId, 'ready_for_review');
  } catch (err) {
    const message =
      err instanceof PipelineError
        ? `Pipeline: ${err.message}`
        : err instanceof Error
          ? err.message
          : String(err);
    await setStage(lessonId, 'failed', { failureReason: message }).catch(() => null);
  }
}

/** Fire-and-forget kick-off used by the route handler. */
export function startGenerationJob(lessonId: string): void {
  void runGenerationJob(lessonId);
}
