/**
 * Question-paper extras, mounted at /api/resources next to the resources framework router.
 * Guards are per route (not router.use) so this router never intercepts the framework's other paths.
 */
import { Router } from 'express';
import { IdParams, PublishPaperExamInput } from '@classpulse/shared';
import { authenticate, currentUser, requireRole } from '../../middleware/auth.js';
import { parseBody, parseParams } from '../../middleware/validate.js';
import { publishPaperAsExam } from './questionPaperService.js';

export const questionPaperRouter = Router();

/** POST /api/resources/:id/publish-exam → 201 { examId, mcqCount, skipped } (a DRAFT exam). */
questionPaperRouter.post('/:id/publish-exam', authenticate(), requireRole('teacher'), async (req, res) => {
  const { id } = parseParams(req, IdParams);
  const input = parseBody(req, PublishPaperExamInput);
  res.status(201).json(await publishPaperAsExam(currentUser(req), id, input));
});
