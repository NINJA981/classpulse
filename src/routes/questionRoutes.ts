import { Router } from 'express';
import {
  getQuestions,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  approveQuestions,
  rejectQuestion
} from '../controllers/questionController.js';

const router = Router();

router.get('/', getQuestions);
router.post('/', createQuestion);
router.post('/approve', approveQuestions);
router.patch('/:id', updateQuestion);
router.put('/:id', updateQuestion);
router.post('/:id/reject', rejectQuestion);
router.delete('/:id', deleteQuestion);

export default router;
