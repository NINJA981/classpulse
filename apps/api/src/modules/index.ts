/**
 * Route registry. Every module exports `router` from its routes.ts and applies
 * its own authentication / role guards. Prefixes here are the public API surface
 * (see docs/api.md).
 */
import type { Router } from 'express';
import { router as auth } from './auth/routes.js';
import { router as institutions } from './institutions/routes.js';
import { router as rooms } from './rooms/routes.js';
import { router as teachers } from './teachers/routes.js';
import { router as students } from './students/routes.js';
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

export const apiRoutes: ReadonlyArray<readonly [string, Router]> = [
  ['/api/auth', auth],
  // Admin console (admin role)
  ['/api/admin/institution', institutions],
  ['/api/admin/rooms', rooms],
  ['/api/admin/teachers', teachers],
  ['/api/admin/students', students],
  ['/api/admin/sections', sections],
  ['/api/admin/timetable', timetable],
  ['/api/admin/settings/models', settings],
  ['/api/admin/overview', overview],
  ['/api/admin/devices', adminDevices],
  // Teacher studio (teacher role; admin read where noted)
  ['/api/teacher', teacher],
  ['/api/lessons', lessons],
  ['/api/questions', questions],
  ['/api/recordings', recordings],
  ['/api/live-sessions', live],
  // Student portal (student role)
  ['/api/student', student],
  // Classroom devices (device-key auth)
  ['/api/devices', devices],
];
