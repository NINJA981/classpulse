import { Request, Response } from 'express';
import { Lesson } from '../models/Lesson.js';
import { Question } from '../models/Question.js';
import { Assignment } from '../models/Assignment.js';
import { startGenerationJob } from '../services/lessonGeneration.js';

export async function getLessons(req: Request, res: Response): Promise<void> {
  try {
    const lessons = await Lesson.find().sort({ createdAt: -1 });
    res.status(200).json(lessons);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function getLessonById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const lesson = await Lesson.findById(id);
    if (!lesson) {
      res.status(404).json({ error: 'Lesson not found' });
      return;
    }

    const questions = await Question.find({ lessonId: lesson._id });
    const assignment = await Assignment.findOne({ lessonId: lesson._id });

    res.status(200).json({
      lesson,
      questions,
      assignment
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function createLesson(req: Request, res: Response): Promise<void> {
  try {
    const { title, subject, className, teacherId } = req.body;

    if (!title || !subject || !className) {
      res.status(400).json({ error: 'Title, subject, and className are required' });
      return;
    }

    const newLesson = await Lesson.create({
      title,
      subject,
      className,
      teacherId: teacherId || 'tch_001',
      status: 'draft',
      timings: {
        startedAt: new Date(),
        elapsedSec: 0
      }
    });

    res.status(201).json(newLesson);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function attachSource(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { sourceType } = req.body;
    const file = req.file;

    const lesson = await Lesson.findById(id);
    if (!lesson) {
      res.status(404).json({ error: 'Lesson not found' });
      return;
    }

    lesson.sourceType = (sourceType as any) || (file?.mimetype.startsWith('audio') ? 'audio' : 'document');
    if (file) {
      lesson.sourceFile = {
        path: `/uploads/${file.filename}`,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        durationSec: 1200
      };
    } else if (req.body.sourceFile) {
      lesson.sourceFile = req.body.sourceFile;
    }

    lesson.status = 'queued';
    await lesson.save();

    res.status(200).json(lesson);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}export async function generateLesson(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const lesson = await Lesson.findById(id);
    if (!lesson) {
      res.status(404).json({ error: 'Lesson not found' });
      return;
    }

    if (!lesson.sourceFile?.path) {
      res.status(400).json({ error: 'Attach a source file before generating.' });
      return;
    }
    if (!['draft', 'queued', 'failed', 'ready_for_review'].includes(lesson.status)) {
      res.status(409).json({ error: `Generation already in progress (status: ${lesson.status}).` });
      return;
    }

    lesson.status = 'queued';
    lesson.failureReason = undefined;
    lesson.timings = {
      startedAt: new Date(),
      elapsedSec: 0
    };
    await lesson.save();

    // Real generation runs in the background; the dashboard polls status.
    startGenerationJob(String(lesson._id));

    res.status(202).json({ success: true, lesson });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function getLessonQuestions(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const questions = await Question.find({ lessonId: id });
    const assignment = await Assignment.findOne({ lessonId: id });

    res.status(200).json({
      lessonId: id,
      questions,
      assignment
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function approveLesson(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const lesson = await Lesson.findById(id);
    if (!lesson) {
      res.status(404).json({ error: 'Lesson not found' });
      return;
    }
    if (lesson.status !== 'ready_for_review' && lesson.status !== 'published') {
      res.status(409).json({ error: `Lesson is not ready for review (status: ${lesson.status}).` });
      return;
    }

    // Publishing requires at least one approved question — students only see
    // quizzes built from approved questions.
    const approvedCount = await Question.countDocuments({ lessonId: lesson._id, status: 'approved' });
    if (approvedCount === 0) {
      res.status(400).json({ error: 'Approve at least one question before publishing.' });
      return;
    }

    lesson.status = 'published';
    await lesson.save();

    res.status(200).json({ success: true, lesson });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
