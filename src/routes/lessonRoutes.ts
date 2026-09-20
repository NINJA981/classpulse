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
const upload = multer({ storage });

router.get('/', getLessons);
router.post('/', createLesson);
router.get('/:id', getLessonById);
router.get('/:id/questions', getLessonQuestions);
router.post('/:id/source', upload.single('file'), attachSource);
router.post('/:id/generate', generateLesson);
router.post('/:id/approve', approveLesson);

export default router;
