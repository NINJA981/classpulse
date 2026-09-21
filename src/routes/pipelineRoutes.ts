import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { ingestLectureFileInProcess } from '../pipeline/embeddedPipeline.js';

const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 200 * 1024 * 1024 } // 200MB limit
});

export const pipelineRouter = Router();

/**
 * POST /v1/ingest/audio-file
 * Direct REST endpoint for audio file ingestion (matching standalone pipeline API).
 */
pipelineRouter.post('/ingest/audio-file', upload.single('file'), async (req: Request, res: Response): Promise<void> => {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: 'Expected multipart/form-data with an audio `file` field.' });
      return;
    }

    const { title, subject, language, questionCount, difficulty, externalIds } = req.body;

    let parsedTeacherId = 'teacher_default';
    if (externalIds) {
      try {
        const parsed = JSON.parse(externalIds) as { teacherId?: string };
        if (parsed.teacherId) parsedTeacherId = parsed.teacherId;
      } catch {
        // ignore
      }
    }

    const result = await ingestLectureFileInProcess({
      filePath: file.path,
      title: title || path.parse(file.originalname).name,
      subject: subject || 'General',
      teacherId: parsedTeacherId,
      language: language || 'en-IN',
      questionCount: questionCount ? Number(questionCount) : 5,
      difficulty: difficulty || 'medium'
    });

    res.status(201).json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});
