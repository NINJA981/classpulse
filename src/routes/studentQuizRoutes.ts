import { Router, Request, Response } from 'express';
import { Lesson } from '../models/Lesson.js';
import { Question } from '../models/Question.js';

/**
 * Student-facing endpoints for pipeline-generated lesson quizzes.
 *
 * Students only ever see PUBLISHED lessons and APPROVED questions, and the
 * correct answers are never included in list/detail payloads — grading
 * happens server-side on submission.
 */

export const studentQuizRouter = Router();

// GET /api/student/quizzes — all published lesson quizzes
studentQuizRouter.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    const lessons = await Lesson.find({ status: 'published' })
      .select('title subject className keyTakeaways summary updatedAt')
      .sort({ updatedAt: -1 })
      .lean();

    const quizzes = await Promise.all(
      lessons.map(async (lesson) => {
        const questionCount = await Question.countDocuments({
          lessonId: lesson._id,
          status: 'approved'
        });
        return {
          id: String(lesson._id),
          title: lesson.title,
          subject: lesson.subject,
          className: lesson.className,
          questionCount,
          summary: lesson.summary || null,
          keyTakeaways: lesson.keyTakeaways || [],
          publishedAt: lesson.updatedAt
        };
      })
    );

    res.status(200).json({ quizzes: quizzes.filter((q) => q.questionCount > 0) });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/student/quizzes/:lessonId — quiz payload for one lesson (no answers)
studentQuizRouter.get('/:lessonId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { lessonId } = req.params;

    const lesson = await Lesson.findOne({ _id: lessonId, status: 'published' })
      .select('title subject className summary keyTakeaways')
      .lean();
    if (!lesson) {
      res.status(404).json({ error: 'Quiz not found or not published' });
      return;
    }

    const questions = await Question.find({ lessonId, status: 'approved' })
      .select('type stem options difficulty sourceCitation')
      .sort({ createdAt: 1 })
      .lean();

    res.status(200).json({
      id: String(lesson._id),
      title: lesson.title,
      subject: lesson.subject,
      className: lesson.className,
      summary: lesson.summary || null,
      keyTakeaways: lesson.keyTakeaways || [],
      questions: questions.map((q, index) => ({
        index,
        id: String(q._id),
        type: q.type,
        stem: q.stem,
        options: q.options || [],
        difficulty: q.difficulty,
        sourceCitation: q.sourceCitation || null
      }))
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/student/quizzes/:lessonId/submit — grade a submission server-side
const submissions = new Map<string, unknown>(); // demo-grade store; swap for Mongo collection in prod

studentQuizRouter.post('/:lessonId/submit', async (req: Request, res: Response): Promise<void> => {
  try {
    const { lessonId } = req.params;
    const { answers } = req.body as { answers?: Array<{ questionId: string; selectedOption?: number; text?: string }> };

    if (!Array.isArray(answers) || answers.length === 0) {
      res.status(400).json({ error: 'answers array is required' });
      return;
    }

    const lesson = await Lesson.findOne({ _id: lessonId, status: 'published' }).lean();
    if (!lesson) {
      res.status(404).json({ error: 'Quiz not found or not published' });
      return;
    }

    let correct = 0;
    const results: Array<{ questionId: string; isCorrect: boolean; correctIndex?: number; correctText?: string; explanation: string }> = [];

    for (const answer of answers) {
      const q = await Question.findOne({ _id: answer.questionId, lessonId, status: 'approved' }).lean();
      if (!q) continue;

      if (q.type === 'short') {
        // Keyword-overlap grading for short answers (teacher can review manually too)
        const expected = (q.correctText || '').toLowerCase().split(/\W+/).filter((w) => w.length > 4);
        const given = (answer.text || '').toLowerCase().split(/\W+/);
        const hits = expected.filter((w) => given.includes(w)).length;
        const isCorrect = expected.length > 0 && hits / expected.length >= 0.4;
        if (isCorrect) correct += 1;
        results.push({ questionId: String(q._id), isCorrect, correctText: q.correctText, explanation: q.explanation });
      } else {
        const isCorrect = answer.selectedOption === q.correctIndex;
        if (isCorrect) correct += 1;
        results.push({ questionId: String(q._id), isCorrect, correctIndex: q.correctIndex, explanation: q.explanation });
      }
    }

    const scorePct = answers.length > 0 ? Math.round((correct / answers.length) * 100) : 0;
    const payload = {
      lessonId,
      lessonTitle: lesson.title,
      correct,
      total: answers.length,
      scorePct,
      results
    };
    submissions.set(lessonId, payload);
    res.status(200).json(payload);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
