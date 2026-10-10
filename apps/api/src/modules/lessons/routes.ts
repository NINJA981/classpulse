import { Router, type Request, type Response } from 'express';
import { pipeline } from 'node:stream/promises';
import {
  AssignmentInput,
  CreateLessonInput,
  GenerateLessonInput,
  IdParams,
  ListLessonsQuery,
  QuestionInput,
  UpdateLessonInput,
  type ApiErrorBody,
} from '@classpulse/shared';
import { storage } from '../../lib/storage.js';
import { authenticate, currentUser, requireRole } from '../../middleware/auth.js';
import { aiLimiter } from '../../middleware/rateLimit.js';
import { parseBody, parseParams, parseQuery } from '../../middleware/validate.js';
import { generateRemedial, getLessonAnalytics, listLessonAttempts } from './analytics.js';
import * as service from './service.js';
import { audioUploadMiddleware, processUploadedAudio } from './upload.js';

export const router = Router();
router.use(authenticate(), requireRole('teacher', 'admin'));
const teacherOnly = requireRole('teacher');

/* Reads: owning teacher or admin of the institution */

router.get('/', async (req, res) => {
  res.json(await service.listLessons(currentUser(req), parseQuery(req, ListLessonsQuery)));
});

router.get('/:id', async (req, res) => {
  const { id } = parseParams(req, IdParams);
  res.json(await service.getLesson(currentUser(req), id));
});

router.get('/:id/transcript', async (req, res) => {
  const { id } = parseParams(req, IdParams);
  res.json(await service.getTranscript(currentUser(req), id));
});

router.get('/:id/attempts', async (req, res) => {
  const { id } = parseParams(req, IdParams);
  res.json(await listLessonAttempts(currentUser(req), id));
});

router.get('/:id/analytics', async (req, res) => {
  const { id } = parseParams(req, IdParams);
  res.json(await getLessonAnalytics(currentUser(req), id));
});

/** Parse a single `bytes=` range. Returns null for "serve everything", 'invalid' for unsatisfiable. */
function parseRange(header: string | undefined, size: number): { start: number; end: number } | null | 'invalid' {
  if (!header) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m) return header.includes(',') ? null : 'invalid'; // multi-range: serve full body
  const [, a, b] = m;
  if (!a && !b) return 'invalid';
  let start: number;
  let end: number;
  if (!a) {
    const suffix = Number(b);
    if (suffix === 0) return 'invalid';
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(a);
    end = b ? Math.min(Number(b), size - 1) : size - 1;
  }
  if (start >= size || start > end) return 'invalid';
  return { start, end };
}

async function streamAudio(req: Request, res: Response) {
  const { id } = parseParams(req, IdParams);
  const audio = await service.getAudioObject(currentUser(req), id);
  const range = parseRange(req.headers.range, audio.size);

  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Content-Type', audio.mimeType);
  res.setHeader('Cache-Control', 'private, no-store');
  if (range === 'invalid') {
    res.setHeader('Content-Range', `bytes */${audio.size}`);
    const body: ApiErrorBody = { error: { code: 'BAD_REQUEST', message: 'Requested range not satisfiable' } };
    res.status(416).json(body);
    return;
  }
  if (range) {
    res.status(206);
    res.setHeader('Content-Range', `bytes ${range.start}-${range.end}/${audio.size}`);
    res.setHeader('Content-Length', String(range.end - range.start + 1));
  } else {
    res.setHeader('Content-Length', String(audio.size));
  }
  if (req.method === 'HEAD') {
    res.end();
    return;
  }
  try {
    await pipeline(storage.read(audio.key, range ?? undefined), res);
  } catch (err) {
    // Client aborts are normal while seeking; anything else is logged.
    if ((err as NodeJS.ErrnoException).code !== 'ERR_STREAM_PREMATURE_CLOSE') req.log.warn({ err }, 'Audio stream failed');
    if (!res.headersSent) throw err;
    res.destroy();
  }
}

router.get('/:id/audio', streamAudio);

/* Writes: owning teacher only */

router.post('/', teacherOnly, async (req, res) => {
  res.status(201).json(await service.createLesson(currentUser(req), parseBody(req, CreateLessonInput)));
});

router.patch('/:id', teacherOnly, async (req, res) => {
  const { id } = parseParams(req, IdParams);
  res.json(await service.updateLesson(currentUser(req), id, parseBody(req, UpdateLessonInput)));
});

router.delete('/:id', teacherOnly, async (req, res) => {
  const { id } = parseParams(req, IdParams);
  await service.deleteLesson(currentUser(req), id);
  res.status(204).end();
});

router.post(
  '/:id/audio',
  teacherOnly,
  async (req, _res, next) => {
    // Check ownership and state before accepting a large request body.
    const { id } = parseParams(req, IdParams);
    await service.assertCanUploadAudio(currentUser(req), id);
    next();
  },
  audioUploadMiddleware,
  async (req, res) => {
    const { id } = parseParams(req, IdParams);
    res.json(await processUploadedAudio(currentUser(req), id, req.file));
  },
);

router.post('/:id/generate', teacherOnly, aiLimiter, async (req, res) => {
  const { id } = parseParams(req, IdParams);
  res.status(202).json(await service.requestGeneration(currentUser(req), id, parseBody(req, GenerateLessonInput)));
});

router.post('/:id/publish', teacherOnly, async (req, res) => {
  const { id } = parseParams(req, IdParams);
  res.json(await service.publishLesson(currentUser(req), id));
});

router.post('/:id/unpublish', teacherOnly, async (req, res) => {
  const { id } = parseParams(req, IdParams);
  res.json(await service.unpublishLesson(currentUser(req), id));
});

router.post('/:id/questions/approve-all', teacherOnly, async (req, res) => {
  const { id } = parseParams(req, IdParams);
  res.json(await service.approveAllQuestions(currentUser(req), id));
});

router.post('/:id/questions', teacherOnly, async (req, res) => {
  const { id } = parseParams(req, IdParams);
  res.status(201).json(await service.addQuestion(currentUser(req), id, parseBody(req, QuestionInput)));
});

router.put('/:id/assignment', teacherOnly, async (req, res) => {
  const { id } = parseParams(req, IdParams);
  res.json(await service.upsertAssignment(currentUser(req), id, parseBody(req, AssignmentInput)));
});

router.post('/:id/analytics/remedial', teacherOnly, aiLimiter, async (req, res) => {
  const { id } = parseParams(req, IdParams);
  res.json(await generateRemedial(currentUser(req), id));
});
