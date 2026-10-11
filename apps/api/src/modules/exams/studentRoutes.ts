/** Student exam routes, mounted at /api/student/exams. Attempt calls carry the device token in X-Exam-Token. */
import { Router, type Request } from 'express';
import { z } from 'zod';
import {
  EXAM_TOKEN_HEADER,
  ExamEventInput,
  Id,
  IdParams,
  SaveExamAnswerInput,
  StartExamInput,
} from '@classpulse/shared';
import { authenticate, currentUser, requireRole } from '../../middleware/auth.js';
import { pinLimiter } from '../../middleware/rateLimit.js';
import { parseBody, parseParams } from '../../middleware/validate.js';
import * as attempts from './attempts.js';

export const examsStudentRouter = Router();
examsStudentRouter.use(authenticate(), requireRole('student'));

const AnswerParams = z.object({ id: Id, examQuestionId: Id });
const ExamToken = z.string().trim().min(1).max(200).optional();

const examToken = (req: Request) => ExamToken.parse(req.get(EXAM_TOKEN_HEADER) || undefined);

examsStudentRouter.get('/', async (req, res) => {
  res.json(await attempts.listExams(currentUser(req).id));
});

// Access codes are short — throttle like live PINs.
examsStudentRouter.post('/:id/start', pinLimiter, async (req, res) => {
  const { id } = parseParams(req, IdParams);
  const input = parseBody(req, StartExamInput);
  const { response, created } = await attempts.startExam(currentUser(req).id, id, input, examToken(req));
  res.setHeader('Cache-Control', 'no-store');
  res.status(created ? 201 : 200).json(response);
});

examsStudentRouter.get('/:id/attempt', async (req, res) => {
  const { id } = parseParams(req, IdParams);
  res.setHeader('Cache-Control', 'no-store');
  res.json(await attempts.getAttempt(currentUser(req).id, id, examToken(req)));
});

examsStudentRouter.put('/:id/attempt/answers/:examQuestionId', async (req, res) => {
  const { id, examQuestionId } = parseParams(req, AnswerParams);
  const { selectedIndex } = parseBody(req, SaveExamAnswerInput);
  await attempts.saveAnswer(currentUser(req).id, id, examQuestionId, selectedIndex, examToken(req));
  res.status(204).end();
});

examsStudentRouter.post('/:id/attempt/events', async (req, res) => {
  const { id } = parseParams(req, IdParams);
  const input = parseBody(req, ExamEventInput);
  res.json(await attempts.recordClientEvent(currentUser(req).id, id, input, examToken(req)));
});

examsStudentRouter.post('/:id/attempt/submit', async (req, res) => {
  const { id } = parseParams(req, IdParams);
  res.json(await attempts.submitAttempt(currentUser(req).id, id, examToken(req)));
});

examsStudentRouter.get('/:id/result', async (req, res) => {
  const { id } = parseParams(req, IdParams);
  res.setHeader('Cache-Control', 'no-store');
  res.json(await attempts.getResult(currentUser(req).id, id));
});
