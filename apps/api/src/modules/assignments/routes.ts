import { Router, type Request } from 'express';
import { z } from 'zod';
import {
  CreateAssignmentInput,
  GradeSubmissionInput,
  Id,
  IdParams,
  ListAssignmentsQuery,
  UpdateAssignmentInput,
} from '@classpulse/shared';
import { audit } from '../../lib/audit.js';
import { authenticate, currentUser, requireRole } from '../../middleware/auth.js';
import { requireFeature } from '../../middleware/requireFeature.js';
import { aiLimiter } from '../../middleware/rateLimit.js';
import { parseBody, parseParams, parseQuery } from '../../middleware/validate.js';
import { suggestGrade } from './grading.js';
import * as service from './service.js';

/** Teacher assignments, mounted at /api/assignments. */
export const assignmentsRouter = Router();
assignmentsRouter.use(authenticate(), requireRole('teacher'));

const SubmissionParams = z.object({ id: Id, sid: Id });

/** Grade changes go to the audit trail (marks only; never the student's work or the feedback text). */
const gradeAudit = (req: Request, action: string, submissionId: string, metadata: Record<string, unknown>) =>
  audit(req, { action, targetType: 'submission', targetId: submissionId, metadata });

assignmentsRouter.get('/', async (req, res) => {
  res.json(await service.listAssignments(currentUser(req), parseQuery(req, ListAssignmentsQuery)));
});

assignmentsRouter.post('/', async (req, res) => {
  res.status(201).json(await service.createAssignment(currentUser(req), parseBody(req, CreateAssignmentInput)));
});

assignmentsRouter.get('/:id', async (req, res) => {
  const { id } = parseParams(req, IdParams);
  res.json(await service.getAssignment(currentUser(req), id));
});

assignmentsRouter.patch('/:id', async (req, res) => {
  const { id } = parseParams(req, IdParams);
  res.json(await service.updateAssignment(currentUser(req), id, parseBody(req, UpdateAssignmentInput)));
});

assignmentsRouter.delete('/:id', async (req, res) => {
  const { id } = parseParams(req, IdParams);
  await service.deleteAssignment(currentUser(req), id);
  res.status(204).end();
});

assignmentsRouter.post('/:id/publish', async (req, res) => {
  const { id } = parseParams(req, IdParams);
  res.json(await service.publishAssignment(currentUser(req), id));
});

assignmentsRouter.post('/:id/close', async (req, res) => {
  const { id } = parseParams(req, IdParams);
  res.json(await service.closeAssignment(currentUser(req), id));
});

assignmentsRouter.get('/:id/submissions', async (req, res) => {
  const { id } = parseParams(req, IdParams);
  res.json(await service.listSubmissions(currentUser(req), id));
});

assignmentsRouter.post('/:id/return-all', async (req, res) => {
  const { id } = parseParams(req, IdParams);
  const result = await service.returnAllGraded(currentUser(req), id);
  await audit(req, { action: 'assignment.return_all', targetType: 'assignment', targetId: id, metadata: { returned: result.returned } });
  res.json(result);
});

assignmentsRouter.get('/:id/submissions/:sid', async (req, res) => {
  const { id, sid } = parseParams(req, SubmissionParams);
  res.json(await service.getSubmission(currentUser(req), id, sid));
});

assignmentsRouter.put('/:id/submissions/:sid/grade', async (req, res) => {
  const { id, sid } = parseParams(req, SubmissionParams);
  const detail = await service.gradeSubmission(currentUser(req), id, sid, parseBody(req, GradeSubmissionInput));
  await gradeAudit(req, 'assignment.grade', sid, {
    assignmentId: id,
    studentId: detail.student.id,
    totalMarks: detail.totalMarks,
    rubricMarks: detail.rubricMarks?.map((m) => m.marks) ?? null,
  });
  res.json(detail);
});

assignmentsRouter.post('/:id/submissions/:sid/return', async (req, res) => {
  const { id, sid } = parseParams(req, SubmissionParams);
  const detail = await service.returnSubmission(currentUser(req), id, sid);
  await gradeAudit(req, 'assignment.return', sid, { assignmentId: id, studentId: detail.student.id, totalMarks: detail.totalMarks });
  res.json(detail);
});

assignmentsRouter.post('/:id/submissions/:sid/ai-suggest', requireFeature('aiGrading'), aiLimiter, async (req, res) => {
  const { id, sid } = parseParams(req, SubmissionParams);
  const suggestion = await suggestGrade(currentUser(req), id, sid);
  await gradeAudit(req, 'assignment.ai_suggest', sid, { assignmentId: id, model: suggestion.model });
  res.json(suggestion);
});
