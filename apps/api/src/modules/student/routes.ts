import { Router } from 'express';
import { z } from 'zod';
import {
  GuardianInput,
  Id,
  IdParams,
  JoinCode,
  JoinSectionInput,
  SubmitAssignmentInput,
  SubmitQuizAttemptInput,
  UpdateStudentProfileInput,
} from '@classpulse/shared';
import { authenticate, currentUser, requireRole } from '../../middleware/auth.js';
import { pinLimiter } from '../../middleware/rateLimit.js';
import { requireFeature } from '../../middleware/requireFeature.js';
import { parseBody, parseParams } from '../../middleware/validate.js';
import { cleanupUploads, submissionUploadMiddleware } from '../assignments/upload.js';
import { institutionState } from '../../lib/platformState.js';
import * as service from './service.js';

export const router = Router();
router.use(authenticate(), requireRole('student'));

const LessonParams = z.object({ lessonId: Id });
const JoinCodeParams = z.object({ joinCode: JoinCode });
const AssignmentFileParams = z.object({ id: Id, fileId: Id });

router.get('/dashboard', async (req, res) => {
  const user = currentUser(req);
  const state = await institutionState(user.institutionId);
  res.json(await service.dashboard(user.id, state?.features.assignments ?? true));
});

router.patch('/profile', async (req, res) => {
  const input = parseBody(req, UpdateStudentProfileInput);
  res.json(await service.updateProfile(currentUser(req).id, input));
});

router.get('/sections', async (req, res) => {
  res.json(await service.listMySections(currentUser(req).id));
});

// Join codes are guessable in principle — throttle lookups like live PINs.
router.get('/sections/preview/:joinCode', pinLimiter, async (req, res) => {
  const { joinCode } = parseParams(req, JoinCodeParams);
  const user = currentUser(req);
  res.json(await service.previewSection(user.id, user.institutionId, joinCode));
});

router.post('/enrollments', pinLimiter, async (req, res) => {
  const { joinCode } = parseBody(req, JoinSectionInput);
  const user = currentUser(req);
  const { section, created } = await service.joinSection(user.id, user.institutionId, joinCode);
  res.status(created ? 201 : 200).json(section);
});

router.get('/quizzes', async (req, res) => {
  res.json(await service.listQuizzes(currentUser(req).id));
});

router.get('/quizzes/:lessonId', async (req, res) => {
  const { lessonId } = parseParams(req, LessonParams);
  res.json(await service.getQuiz(currentUser(req).id, lessonId));
});

router.post('/quizzes/:lessonId/attempts', async (req, res) => {
  const { lessonId } = parseParams(req, LessonParams);
  const input = parseBody(req, SubmitQuizAttemptInput);
  const { result, created } = await service.submitAttempt(currentUser(req).id, lessonId, input);
  res.status(created ? 201 : 200).json(result);
});

router.get('/quizzes/:lessonId/attempts/latest', async (req, res) => {
  const { lessonId } = parseParams(req, LessonParams);
  res.json(await service.latestAttempt(currentUser(req).id, lessonId));
});

// Assignments can be switched off per school by the platform.
router.use('/assignments', requireFeature('assignments'));

router.get('/assignments', async (req, res) => {
  res.json(await service.listAssignments(currentUser(req).id));
});

// Multipart: field `files` (array) plus `text`. A plain JSON body with `text` also works.
router.post(
  '/assignments/:id/submission',
  async (req, _res, next) => {
    // Check visibility and state before accepting a large request body.
    const { id } = parseParams(req, IdParams);
    await service.assertCanSubmit(currentUser(req).id, id);
    next();
  },
  submissionUploadMiddleware,
  async (req, res) => {
    const { id } = parseParams(req, IdParams);
    const files = Array.isArray(req.files) ? req.files : [];
    let input: SubmitAssignmentInput;
    try {
      input = parseBody(req, SubmitAssignmentInput);
    } catch (err) {
      await cleanupUploads(files);
      throw err;
    }
    res.json(await service.submitAssignment(currentUser(req).id, id, input, files));
  },
);

router.delete('/assignments/:id/files/:fileId', async (req, res) => {
  const { id, fileId } = parseParams(req, AssignmentFileParams);
  res.json(await service.removeSubmissionFile(currentUser(req).id, id, fileId));
});

router.get('/guardians', async (req, res) => {
  res.json(await service.listGuardians(currentUser(req).id));
});

router.post('/guardians', async (req, res) => {
  const input = parseBody(req, GuardianInput);
  res.status(201).json(await service.addGuardian(currentUser(req).id, input));
});

router.delete('/guardians/:id', async (req, res) => {
  const { id } = parseParams(req, IdParams);
  await service.removeGuardian(currentUser(req).id, id);
  res.status(204).end();
});
