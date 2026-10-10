import { Router } from 'express';
import {
  getSections,
  createSection,
  rotateCode,
  previewSection,
  joinSection
} from '../controllers/sectionController.js';

const router = Router();

router.get('/', getSections);
router.post('/', createSection);
router.post('/:id/rotate-code', rotateCode);
router.get('/preview', previewSection);
router.post('/join', joinSection);

export default router;

