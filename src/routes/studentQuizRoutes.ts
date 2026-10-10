import { Router, Request, Response } from 'express';
import { Lesson } from '../models/Lesson.js';
import { Question } from '../models/Question.js';
import { StudentSubmission, ISubmissionResult } from '../models/StudentSubmission.js';
import { generateRemedialNotes, RemedialNoteItem } from '../pipeline/llmService.js';

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
      .select('title subject className keyTakeaways summary language updatedAt')
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
          language: lesson.language || 'en',
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
      .select('title subject className summary keyTakeaways language')
      .lean();
    if (!lesson) {
      res.status(404).json({ error: 'Quiz not found or not published' });
      return;
    }

    const questions = await Question.find({ lessonId, status: 'approved' })
      .select('type stem stemLocal options optionsLocal difficulty sourceCitation')
      .sort({ createdAt: 1 })
      .lean();

    res.status(200).json({
      id: String(lesson._id),
      title: lesson.title,
      subject: lesson.subject,
      className: lesson.className,
      language: lesson.language || 'en',
      summary: lesson.summary || null,
      keyTakeaways: lesson.keyTakeaways || [],
      questions: questions.map((q, index) => ({
        index,
        id: String(q._id),
        type: q.type,
        stem: q.stem,
        stemLocal: q.stemLocal || null,
        options: q.options || [],
        optionsLocal: q.optionsLocal || null,
        difficulty: q.difficulty,
        sourceCitation: q.sourceCitation || null
      }))
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export interface StoredSubmission {
  id: string;
  lessonId: string;
  lessonTitle: string;
  studentName: string;
  rollNumber?: string;
  correct: number;
  total: number;
  scorePct: number;
  submittedAt: string;
  results: Array<{
    questionId: string;
    isCorrect: boolean;
    correctIndex?: number;
    correctText?: string;
    explanation: string;
    explanationLocal?: string;
  }>;
}

// In-memory cache kept for instant sub-millisecond lookup, populated from DB
export const quizSubmissions = new Map<string, StoredSubmission[]>();

// GET /api/student/quizzes/:lessonId/submissions — list student submissions for this lesson
studentQuizRouter.get('/:lessonId/submissions', async (req: Request, res: Response): Promise<void> => {
  try {
    const { lessonId } = req.params;
    const dbSubmissions = await StudentSubmission.find({ lessonId })
      .sort({ submittedAt: -1 })
      .lean();

    const formatted: StoredSubmission[] = dbSubmissions.map((s) => ({
      id: String(s._id),
      lessonId: String(s.lessonId),
      lessonTitle: s.lessonTitle,
      studentName: s.studentName,
      rollNumber: s.rollNumber,
      correct: s.correct,
      total: s.total,
      scorePct: s.scorePct,
      submittedAt: s.submittedAt ? s.submittedAt.toISOString() : new Date().toISOString(),
      results: (s.results || []).map((r) => ({
        questionId: r.questionId,
        isCorrect: r.isCorrect,
        correctIndex: r.correctIndex,
        correctText: r.correctText,
        explanation: r.explanation,
        explanationLocal: r.explanationLocal
      }))
    }));

    res.status(200).json({ submissions: formatted });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/student/quizzes/:lessonId/analytics — Concept Gap Heatmap & AI Remedial Notes
export const getLessonAnalyticsHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const lessonId = req.params.lessonId || req.params.id;
    const lesson = await Lesson.findById(lessonId).lean();
    if (!lesson) {
      res.status(404).json({ error: 'Lesson not found' });
      return;
    }

    const questions = await Question.find({ lessonId, status: 'approved' })
      .sort({ createdAt: 1 })
      .lean();

    const dbSubmissions = await StudentSubmission.find({ lessonId }).lean();
    const totalSubmissions = dbSubmissions.length;
    const classAveragePct = totalSubmissions > 0
      ? Math.round(dbSubmissions.reduce((acc, s) => acc + s.scorePct, 0) / totalSubmissions)
      : 0;


    let criticalCount = 0;
    let moderateCount = 0;
    let masteredCount = 0;

    const questionAnalytics = questions.map((q) => {
      let attempts = 0;
      let correct = 0;

      for (const sub of dbSubmissions) {
        const r = (sub.results || []).find((res: any) => res.questionId === String(q._id));
        if (r) {
          attempts += 1;
          if (r.isCorrect) correct += 1;
        }
      }

      // If attempts exist, compute actual %; otherwise indicate baseline pending
      const accuracyPct = attempts > 0 ? Math.round((correct / attempts) * 100) : 100;
      let status: 'critical' | 'moderate' | 'mastered' = 'mastered';

      if (attempts > 0) {
        if (accuracyPct < 50) {
          status = 'critical';
          criticalCount++;
        } else if (accuracyPct < 75) {
          status = 'moderate';
          moderateCount++;
        } else {
          status = 'mastered';
          masteredCount++;
        }
      } else {
        masteredCount++;
      }

      return {
        questionId: String(q._id),
        stem: q.stem,
        stemLocal: q.stemLocal,
        topicTag: q.topicTag || lesson.subject,
        difficulty: q.difficulty,
        totalAttempts: attempts,
        correctAttempts: correct,
        accuracyPct,
        status,
        sourceCitation: q.sourceCitation || null,
        explanation: q.explanation || '',
        explanationLocal: q.explanationLocal || null
      };
    });

    // Identify gaps needing remedial refresher notes
    const gaps = questionAnalytics
      .filter((qa) => qa.totalAttempts > 0 && qa.accuracyPct < 75)
      .map((qa) => ({
        questionId: qa.questionId,
        stem: qa.stem,
        explanation: qa.explanation,
        accuracyPct: qa.accuracyPct,
        citation: qa.sourceCitation || undefined
      }));

    // If no submissions yet, or all >75%, provide 1 preview refresher card for the most complex question
    let remedialNotes: RemedialNoteItem[] = [];
    if (gaps.length > 0) {
      remedialNotes = await generateRemedialNotes(lesson.subject, gaps);
    } else if (questions.length > 0) {
      remedialNotes = await generateRemedialNotes(lesson.subject, [
        {
          questionId: String(questions[0]._id),
          stem: questions[0].stem,
          explanation: questions[0].explanation || '',
          accuracyPct: 100,
          citation: questions[0].sourceCitation || undefined
        }
      ]);
    }

    res.status(200).json({
      lessonId: String(lesson._id),
      lessonTitle: lesson.title,
      subject: lesson.subject,
      className: lesson.className,
      totalSubmissions,
      classAveragePct,
      criticalGapsCount: criticalCount,
      moderateGapsCount: moderateCount,
      masteredCount,
      questions: questionAnalytics,
      remedialNotes
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

studentQuizRouter.get('/:lessonId/analytics', getLessonAnalyticsHandler);

// POST /api/student/quizzes/:lessonId/submit — grade a submission server-side and persist to DB
studentQuizRouter.post('/:lessonId/submit', async (req: Request, res: Response): Promise<void> => {
  try {
    const { lessonId } = req.params;
    const { answers, studentName, rollNumber } = req.body as {
      answers?: Array<{ questionId: string; selectedOption?: number; text?: string }>;
      studentName?: string;
      rollNumber?: string;
    };

    if (!Array.isArray(answers) || answers.length === 0) {
      res.status(400).json({ error: 'answers array is required' });
      return;
    }

    // Idempotency check: prevent duplicate submissions on client retry
    const idempotencyKey = (req.headers['idempotency-key'] || req.body?.idempotencyKey) as string | undefined;
    if (idempotencyKey) {
      const existing = await StudentSubmission.findOne({ idempotencyKey }).lean();
      if (existing) {
        res.status(200).json({
          id: String(existing._id),
          lessonId: String(existing.lessonId),
          lessonTitle: existing.lessonTitle,
          studentName: existing.studentName,
          rollNumber: existing.rollNumber,
          correct: existing.correct,
          total: existing.total,
          scorePct: existing.scorePct,
          submittedAt: existing.submittedAt.toISOString(),
          results: existing.results
        });
        return;
      }
    }

    const lesson = await Lesson.findOne({ _id: lessonId, status: 'published' }).lean();
    if (!lesson) {
      res.status(404).json({ error: 'Quiz not found or not published' });
      return;
    }

    let correct = 0;
    const results: Array<{
      questionId: string;
      selectedOption?: number;
      isCorrect: boolean;
      correctIndex?: number;
      correctText?: string;
      explanation: string;
      explanationLocal?: string;
    }> = [];

    for (const answer of answers) {
      const q = await Question.findOne({ _id: answer.questionId, lessonId, status: 'approved' }).lean();
      if (!q) continue;

      if (q.type === 'short') {
        // Keyword-overlap grading for short answers
        const expected = (q.correctText || '').toLowerCase().split(/\W+/).filter((w) => w.length > 4);
        const given = (answer.text || '').toLowerCase().split(/\W+/);
        const hits = expected.filter((w) => given.includes(w)).length;
        const isCorrect = expected.length > 0 && hits / expected.length >= 0.4;
        if (isCorrect) correct += 1;
        results.push({
          questionId: String(q._id),
          selectedOption: answer.selectedOption,
          isCorrect,
          correctText: q.correctText,
          explanation: q.explanation,
          explanationLocal: q.explanationLocal
        });
      } else {
        const isCorrect = answer.selectedOption === q.correctIndex;
        if (isCorrect) correct += 1;
        results.push({
          questionId: String(q._id),
          selectedOption: answer.selectedOption,
          isCorrect,
          correctIndex: q.correctIndex,
          explanation: q.explanation,
          explanationLocal: q.explanationLocal
        });
      }
    }

    const scorePct = answers.length > 0 ? Math.round((correct / answers.length) * 100) : 0;
    const assignedRoll = (rollNumber || `STU-${Date.now().toString().slice(-4)}`).trim().toUpperCase();

    // Persist to database
    const createdSubmission = await StudentSubmission.create({
      lessonId: lesson._id,
      lessonTitle: lesson.title,
      studentName: studentName || 'Student 1',
      rollNumber: assignedRoll,
      correct,
      total: answers.length,
      scorePct,
      ...(idempotencyKey ? { idempotencyKey } : {}),
      results,
      submittedAt: new Date()
    });

    const payload: StoredSubmission = {
      id: String(createdSubmission._id),
      lessonId: String(lessonId),
      lessonTitle: lesson.title,
      studentName: createdSubmission.studentName,
      rollNumber: createdSubmission.rollNumber,
      correct,
      total: answers.length,
      scorePct,
      submittedAt: createdSubmission.submittedAt.toISOString(),
      results
    };

    // Keep memory cache updated
    const list = quizSubmissions.get(String(lessonId)) || [];
    list.unshift(payload);
    quizSubmissions.set(String(lessonId), list);

    res.status(200).json(payload);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default studentQuizRouter;


