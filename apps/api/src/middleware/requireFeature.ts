import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { InstitutionFeature } from '@classpulse/shared';
import { AppError } from '../lib/errors.js';
import { institutionState } from '../lib/platformState.js';
import { authenticate } from './auth.js';

const LABEL: Record<InstitutionFeature, string> = {
  exams: 'Exams',
  assignments: 'Assignments',
  liveQuiz: 'Live quiz',
  devices: 'Classroom devices',
  emailInvites: 'Email invitations',
  aiGrading: 'AI grading',
  teacherTools: 'Teacher tools',
};

const sessionAuth = authenticate();

/**
 * 403 FEATURE_DISABLED when the platform has switched `feature` off for the caller's school.
 * Works before or after a router's own `authenticate()`: without `req.user` it authenticates first
 * (so an anonymous caller still gets 401, not 403).
 */
export function requireFeature(feature: InstitutionFeature): RequestHandler {
  const check = async (req: Request, next: NextFunction) => {
    const state = await institutionState(req.user!.institutionId);
    if (state && !state.features[feature]) {
      return next(new AppError('FEATURE_DISABLED', `${LABEL[feature]} is switched off for your school.`));
    }
    next();
  };
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.user) return check(req, next);
    return sessionAuth(req, res, (err?: unknown) => (err ? next(err) : check(req, next).catch(next)));
  };
}
