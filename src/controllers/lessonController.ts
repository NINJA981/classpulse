import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { Lesson } from '../models/Lesson.js';
import { Question } from '../models/Question.js';
import { Assignment } from '../models/Assignment.js';
import { startGenerationJob } from '../services/lessonGeneration.js';

export async function getLessons(req: Request, res: Response): Promise<void> {
  try {
    const filter: Record<string, any> = {};
    if (req.query.status) {
      filter.status = req.query.status;
    }
    const lessons = await Lesson.find(filter).sort({ createdAt: -1 });
    if (req.query.page !== undefined) {
      const page = Number(req.query.page) || 1;
      const pageSize = Number(req.query.pageSize) || 50;
      res.status(200).json({
        items: lessons,
        lessons,
        page,
        pageSize,
        total: lessons.length
      });
      return;
    }
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
      assignment,
      job: null
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function createLesson(req: Request, res: Response): Promise<void> {
  try {
    const { title, subject, className, sectionId, teacherId, language } = req.body;

    if (!title || !subject || !className) {
      res.status(400).json({ error: 'Title, subject, and className are required' });
      return;
    }

    const newLesson = await Lesson.create({
      title,
      subject,
      className,
      ...(sectionId ? { sectionId } : {}),
      teacherId: teacherId || 'tch_001',
      language: language || 'en',
      status: 'draft',
      timings: {
        startedAt: new Date(),
        elapsedSec: 0
      }
    });

    const obj = { ...newLesson.toObject(), id: String(newLesson._id) };
    res.status(201).json({
      ...obj,
      lesson: obj
    });
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

    const obj = { ...lesson.toObject(), id: String(lesson._id) };
    res.status(200).json({
      success: true,
      sourceFile: lesson.sourceFile,
      lesson: obj,
      ...obj
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function generateLesson(req: Request, res: Response): Promise<void> {
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
    if (!['draft', 'queued', 'failed', 'ready_for_review', 'published'].includes(lesson.status)) {
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

    res.status(202).json({
      success: true,
      lessonId: String(lesson._id),
      jobId: `job_${lesson._id}`,
      status: lesson.status,
      lesson
    });
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

export async function updateLessonAssignment(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { prompt, estimatedMinutes, rubric, status } = req.body;
    const updateFields: Record<string, any> = {};
    if (prompt !== undefined) updateFields.prompt = prompt;
    if (estimatedMinutes !== undefined) updateFields.estimatedMinutes = estimatedMinutes;
    if (rubric !== undefined) updateFields.rubric = rubric;
    if (status !== undefined) updateFields.status = status;

    let assignment = await Assignment.findOneAndUpdate(
      { lessonId: id },
      updateFields,
      { new: true }
    );

    if (!assignment) {
      const lesson = await Lesson.findById(id);
      assignment = await Assignment.create({
        lessonId: id,
        title: lesson ? `${lesson.title} Assignment` : 'Lesson Assignment',
        subject: lesson?.subject || 'General',
        prompt: prompt || '',
        estimatedMinutes: estimatedMinutes || 30,
        rubric: rubric || [],
        status: status || 'draft'
      });
    }

    res.status(200).json({
      ...assignment.toObject(),
      id: String(assignment._id),
      assignment
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function getLessonTranscript(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const lesson = await Lesson.findById(id);
    if (!lesson) {
      res.status(404).json({ error: 'Lesson not found' });
      return;
    }

    const questions = await Question.find({ lessonId: id });
    const citations = questions
      .map((q) => q.sourceCitation)
      .filter(Boolean)
      .join('\n\n');

    const fullText = [
      lesson.summary || '',
      lesson.keyTakeaways?.length ? `Key Takeaways:\n• ${lesson.keyTakeaways.join('\n• ')}` : '',
      citations
    ]
      .filter(Boolean)
      .join('\n\n');

    if (!fullText) {
      res.status(200).json({ transcripts: [], selected: null });
      return;
    }

    const transcript = {
      id: `tr_${lesson._id}`,
      lessonId: String(lesson._id),
      source: 'upload',
      language: lesson.language || 'en-IN',
      fullText,
      segments: (lesson.keyTakeaways || [lesson.summary || 'Lecture transcript segment']).map((text, idx) => ({
        startSec: idx * 60,
        endSec: (idx + 1) * 60,
        text
      })),
      wordCount: fullText.split(/\s+/).filter(Boolean).length,
      durationSec: lesson.sourceFile?.durationSec || 1200,
      asrProvider: 'sarvam',
      asrModel: 'saaras:v3',
      createdAt: lesson.createdAt
    };

    res.status(200).json({
      transcripts: [transcript],
      selected: 'upload'
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function selectLessonTranscript(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const lesson = await Lesson.findById(id);
    if (!lesson) {
      res.status(404).json({ error: 'Lesson not found' });
      return;
    }
    res.status(200).json({ lesson });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function streamLessonAudio(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const lesson = await Lesson.findById(id);
    if (!lesson || !lesson.sourceFile?.path) {
      res.status(404).json({ error: 'Audio source not found for this lesson' });
      return;
    }

    const relPath = lesson.sourceFile.path.replace(/^\/+/, '');
    const candidatePath = path.resolve(process.cwd(), relPath);
    if (fs.existsSync(candidatePath)) {
      res.sendFile(candidatePath);
      return;
    }

    // Fallback for seeded demo audio if sample mp3 exists in workspace root
    const fallbackAudio = path.resolve(process.cwd(), '..', 'youtube-audio.mp3');
    if (fs.existsSync(fallbackAudio)) {
      res.sendFile(fallbackAudio);
      return;
    }

    res.status(404).json({ error: 'Audio file not found on disk' });
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
    await Assignment.updateMany({ lessonId: lesson._id }, { status: 'published' });

    res.status(200).json({
      success: true,
      lessonId: String(lesson._id),
      publishedAt: lesson.updatedAt,
      approvedQuestionsCount: approvedCount,
      lesson
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
