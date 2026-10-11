/** Teacher exam routes, mounted at /api/exams. */
import { Router } from 'express';
import { z } from 'zod';
import {
  ExamInput,
  ExamPoolQuery,
  ExtraTimeInput,
  Id,
  IdParams,
  SetExamQuestionsInput,
  UpdateExamInput,
} from '@classpulse/shared';
import { authenticate, currentUser, requireRole } from '../../middleware/auth.js';
import { parseBody, parseParams, parseQuery } from '../../middleware/validate.js';
import * as service from './service.js';

export const examsRouter = Router();
examsRouter.use(authenticate(), requireRole('teacher'));

const AttemptParams = z.object({ id: Id, aid: Id });

examsRouter.get('/', async (req, res) => {
  res.json(await service.listExams(currentUser(req)));
});

examsRouter.post('/', async (req, res) => {
  const input = parseBody(req, ExamInput);
  res.status(201).json(await service.createExam(currentUser(req), input));
});

examsRouter.get('/:id', async (req, res) => {
  const { id } = parseParams(req, IdParams);
  res.json(await service.getExam(currentUser(req), id));
});

examsRouter.patch('/:id', async (req, res) => {
  const { id } = parseParams(req, IdParams);
  const input = parseBody(req, UpdateExamInput);
  res.json(await service.updateExam(currentUser(req), id, input));
});

examsRouter.delete('/:id', async (req, res) => {
  const { id } = parseParams(req, IdParams);
  await service.deleteExam(currentUser(req), id);
  res.status(204).end();
});

examsRouter.get('/:id/question-pool', async (req, res) => {
  const { id } = parseParams(req, IdParams);
  res.json(await service.questionPool(currentUser(req), id, parseQuery(req, ExamPoolQuery)));
});

examsRouter.put('/:id/questions', async (req, res) => {
  const { id } = parseParams(req, IdParams);
  const input = parseBody(req, SetExamQuestionsInput);
  res.json(await service.setQuestions(currentUser(req), id, input));
});

examsRouter.post('/:id/publish', async (req, res) => {
  const { id } = parseParams(req, IdParams);
  res.json(await service.publishExam(currentUser(req), id));
});

examsRouter.post('/:id/close', async (req, res) => {
  const { id } = parseParams(req, IdParams);
  res.json(await service.closeExam(currentUser(req), id));
});

examsRouter.post('/:id/rotate-code', async (req, res) => {
  const { id } = parseParams(req, IdParams);
  res.json(await service.rotateAccessCode(currentUser(req), id));
});

examsRouter.get('/:id/monitor', async (req, res) => {
  const { id } = parseParams(req, IdParams);
  res.setHeader('Cache-Control', 'no-store');
  res.json(await service.monitor(currentUser(req), id));
});

examsRouter.post('/:id/attempts/:aid/unlock', async (req, res) => {
  const { id, aid } = parseParams(req, AttemptParams);
  res.json(await service.unlockDevice(currentUser(req), id, aid));
});

examsRouter.post('/:id/attempts/:aid/extra-time', async (req, res) => {
  const { id, aid } = parseParams(req, AttemptParams);
  const { minutes } = parseBody(req, ExtraTimeInput);
  res.json(await service.addExtraTime(currentUser(req), id, aid, minutes));
});

examsRouter.post('/:id/attempts/:aid/force-submit', async (req, res) => {
  const { id, aid } = parseParams(req, AttemptParams);
  res.json(await service.forceSubmit(currentUser(req), id, aid));
});

examsRouter.get('/:id/results', async (req, res) => {
  const { id } = parseParams(req, IdParams);
  res.json(await service.results(currentUser(req), id));
});

examsRouter.get('/:id/results.csv', async (req, res) => {
  const { id } = parseParams(req, IdParams);
  const { filename, csv } = await service.resultsCsv(currentUser(req), id);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Cache-Control', 'private, no-store');
  res.send(csv);
});
