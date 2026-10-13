/**
 * Route registry. Every module exports `router` from its routes.ts and applies
 * its own authentication / role guards. Prefixes here are the public API surface
 * (see docs/agents/api.md).
 */
import express, { type Router } from 'express';
import { env } from '../config/env.js';
import { router as auth } from './auth/routes.js';
import { router as institutions } from './institutions/routes.js';
import { router as rooms } from './rooms/routes.js';
import { router as teachers } from './teachers/routes.js';
import { router as students } from './students/routes.js';
import { router as studentExport } from './students/exportRoutes.js';
import { router as sections } from './sections/routes.js';
import { router as timetable } from './timetable/routes.js';
import { router as settings } from './settings/routes.js';
import { router as overview } from './overview/routes.js';
import { router as adminDevices } from './devices/adminRoutes.js';
import { router as teacher } from './teacher/routes.js';
import { router as lessons } from './lessons/routes.js';
import { router as questions } from './questions/routes.js';
import { router as student } from './student/routes.js';
import { router as devices } from './devices/routes.js';
import { router as recordings } from './recordings/routes.js';
import { router as live } from './live/routes.js';
import { assignmentsRouter } from './assignments/routes.js';
import { assignmentFilesRouter } from './assignments/fileRoutes.js';
import { examsRouter } from './exams/routes.js';
import { examsStudentRouter } from './exams/studentRoutes.js';
import { mailCaptureRouter, notificationTestRouter } from './testing/routes.js';
import { platformRouter } from './platform/routes.js';
import { offboardingRouter } from './platform/offboardingRoutes.js';
import { statsRouter } from './platform/stats.js';
import { opsRouter } from './platform/opsRoutes.js';
import { auditRouter } from './platform/opsAudit.js';
import { requireFeature } from '../middleware/requireFeature.js';
import type { InstitutionFeature } from '@classpulse/shared';
import { authenticatePlatform } from '../middleware/platformAuth.js';
import { statusRouter } from './status/routes.js';
import { simulationsRouter } from './resources/simulations.js';
import { questionPaperRouter } from './resources/questionPaperRoutes.js';
import { insightsRouter } from './resources/insightsRoutes.js';
import { curriculumRouter } from './curriculum/routes.js';
import { resourcesRouter } from './resources/routes.js';
import { router as publicRoutes } from './public/routes.js';
import { notificationsRouter, platformNotificationsRouter } from './notifications/routes.js';

/** Routes of a feature the platform can switch off per school (403 FEATURE_DISABLED). */
const gated = (feature: InstitutionFeature, router: Router): Router => express.Router().use(requireFeature(feature), router);
/** Platform console routes (super admin session only). */
const platform = (router: Router): Router => express.Router().use(authenticatePlatform(), router);

export const apiRoutes: ReadonlyArray<readonly [string, Router]> = [
  ['/api/auth', auth],
  // Admin console (admin role)
  ['/api/admin/institution', institutions],
  ['/api/admin/rooms', rooms],
  ['/api/admin/teachers', teachers],
  // Student data export (right of access); its routes authenticate themselves.
  ['/api/admin/students', studentExport],
  ['/api/admin/students', students],
  ['/api/admin/sections', sections],
  ['/api/admin/timetable', timetable],
  ['/api/admin/settings/models', settings],
  ['/api/admin/overview', overview],
  ['/api/admin/devices', gated('devices', adminDevices)],
  // Teacher studio (teacher role; admin read where noted)
  ['/api/teacher', teacher],
  ['/api/lessons', lessons],
  ['/api/questions', questions],
  ['/api/recordings', gated('devices', recordings)],
  ['/api/live-sessions', gated('liveQuiz', live)],
  ['/api/assignments', gated('assignments', assignmentsRouter)],
  ['/api/assignment-files', gated('assignments', assignmentFilesRouter)],
  ['/api/simulations', gated('teacherTools', simulationsRouter)],
  ['/api/resources', questionPaperRouter],
  ['/api/insights', gated('teacherTools', insightsRouter)],
  ['/api/curriculum', curriculumRouter],
  ['/api/resources', resourcesRouter],
  // Student portal (student role)
  ['/api/exams', gated('exams', examsRouter)],
  ['/api/student/exams', gated('exams', examsStudentRouter)],
  ['/api/student', student],
  // Everyone signed in to a school (any role): their own notifications
  ['/api/notifications', notificationsRouter],
  // Classroom devices (device-key auth)
  ['/api/devices', devices],
  ['/api/status', statusRouter],
  // Public, no session (product page "Book a demo"); school host only
  ['/api/public', publicRoutes],
  // Super admins' own notifications; authenticates the platform session itself (before the /api/platform catch-all).
  ['/api/platform/notifications', platformNotificationsRouter],
  ['/api/platform/stats', platform(statsRouter)],
  ['/api/platform/ops', platform(opsRouter)],
  ['/api/platform/audit', platform(auditRouter)],
  // School export and hard delete (offboarding); each route authenticates the platform session itself.
  ['/api/platform/schools', offboardingRouter],
  ['/api/platform', platformRouter],
  // End-to-end tests only (E2E_MAIL_CAPTURE; refused in production): captured email, test notifications
  ...(env.E2E_MAIL_CAPTURE ? ([['/api/test', mailCaptureRouter()], ['/api/test', notificationTestRouter()]] as const) : []),
];
