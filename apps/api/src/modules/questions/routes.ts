import { Router } from 'express';
import { Difficulty, IdParams, QuestionInput } from '@classpulse/shared';
import { authenticate, currentUser, requireRole } from '../../middleware/auth.js';
import { parseBody, parseParams } from '../../middleware/validate.js';
import * as service from './service.js';

/**
 * Local PATCH schema: the shared `UpdateQuestionInput` (QuestionInput.partial()) still applies
 * `difficulty`'s default under zod 4, which would silently reset difficulty on every edit.
 */
const PatchQuestionInput = QuestionInput.extend({ difficulty: Difficulty.optional() }).partial();

export const router = Router();
router.use(authenticate(), requireRole('teacher'));

router.patch('/:id', async (req, res) => {
  const { id } = parseParams(req, IdParams);
  res.json(await service.updateQuestion(currentUser(req), id, parseBody(req, PatchQuestionInput)));
});

router.post('/:id/approve', async (req, res) => {
  const { id } = parseParams(req, IdParams);
  res.json(await service.setQuestionStatus(currentUser(req), id, 'approved'));
});

router.post('/:id/reject', async (req, res) => {
  const { id } = parseParams(req, IdParams);
  res.json(await service.setQuestionStatus(currentUser(req), id, 'rejected'));
});

router.delete('/:id', async (req, res) => {
  const { id } = parseParams(req, IdParams);
  await service.deleteQuestion(currentUser(req), id);
  res.status(204).end();
});
