import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import {
  getLessons,
  getLessonById,
  createLesson,
  attachSource,
  generateLesson,
  getLessonQuestions,
  updateLessonAssignment,
  getLessonTranscript,
  selectLessonTranscript,
  streamLessonAudio,
  approveLesson
} from '../controllers/lessonController.js';

const router = Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.resolve(process.cwd(), 'uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  }
});
const upload = multer({
  storage,
  limits: {
    fileSize: 200 * 1024 * 1024 // 200 MB limit for full lecture audio/video
  }
});

import { getLessonAnalyticsHandler } from './studentQuizRoutes.js';

router.get('/', getLessons);
router.post('/', createLesson);
router.get('/:id', getLessonById);
router.get('/:id/audio', streamLessonAudio);
router.get('/:id/transcript', getLessonTranscript);
router.post('/:id/transcript/select', selectLessonTranscript);
router.get('/:id/questions', getLessonQuestions);
router.patch('/:id/assignment', updateLessonAssignment);
router.post('/:id/source', upload.single('file'), attachSource);
router.post('/:id/generate', generateLesson);
router.post('/:id/regenerate', generateLesson);
router.post('/:id/approve', approveLesson);
router.post('/:id/publish', approveLesson);
router.get('/:id/submissions', async (req, res) => {
  try {
    const { id } = req.params;
    const { StudentSubmission } = await import('../models/StudentSubmission.js');
    const list = await StudentSubmission.find({ lessonId: String(id) }).sort({ submittedAt: -1 }).lean();
    res.status(200).json({ submissions: list });
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message } });
  }
});
router.get('/:id/analytics', getLessonAnalyticsHandler);

router.get('/:id/job-status', async (req, res) => {
  try {
    const { id } = req.params;
    const { getJobStatus } = await import('../services/queueService.js');
    const status = await getJobStatus(String(id));
    res.status(200).json(status);
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message } });
  }
});

router.post('/:id/retry', async (req, res) => {
  try {
    const { id } = req.params;
    const { enqueueLessonJob } = await import('../services/queueService.js');
    const result = await enqueueLessonJob(String(id));
    res.status(200).json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message } });
  }
});

export default router;
