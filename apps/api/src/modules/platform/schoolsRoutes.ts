import { Router, type Request } from 'express';
import { z } from 'zod';
import {
  CreateSchoolInput,
  PLATFORM_SCHOOL_VIEWS,
  PlatformIdParams,
  PlatformSchoolAdminParams,
  PlatformViewQuery,
  SchoolAdminInput,
  SuspendSchoolInput,
  UpdateSchoolFeaturesInput,
  UpdateSchoolInput,
  UpdateSchoolLimitsInput,
} from '@classiq/shared';
import { audit } from '../../lib/audit.js';
import { authenticatePlatform } from '../../middleware/platformAuth.js';
import { parseBody, parseParams, parseQuery } from '../../middleware/validate.js';
import * as admins from './adminsService.js';
import * as service from './schoolsService.js';
import { schoolView } from './schoolsViews.js';

/** /api/platform/schools — every school, its admins and read-only views. */
export const schoolsRouter = Router();
schoolsRouter.use(authenticatePlatform());

const ListQuery = z.object({ q: z.string().trim().max(100).optional() });
const ViewParams = PlatformIdParams.extend({ view: z.enum(PLATFORM_SCHOOL_VIEWS) });

const schoolAudit = (req: Request, action: string, schoolId: string, metadata?: Record<string, unknown>) =>
  audit(req, { action, institutionId: schoolId, targetType: 'institution', targetId: schoolId, metadata });

const adminAudit = (req: Request, action: string, schoolId: string, adminId: string, metadata?: Record<string, unknown>) =>
  audit(req, { action, institutionId: schoolId, targetType: 'user', targetId: adminId, metadata });

schoolsRouter.get('/', async (req, res) => {
  const { q } = parseQuery(req, ListQuery);
  res.json(await service.listSchools(q));
});

schoolsRouter.post('/', async (req, res) => {
  const input = parseBody(req, CreateSchoolInput);
  const result = await service.createSchool(input);
  await schoolAudit(req, 'platform.school.create', result.school.id, { code: result.school.code, name: result.school.name });
  await adminAudit(req, 'platform.admin.create', result.school.id, result.admin.id, { invite: result.invite });
  res.status(201).json(result);
});

schoolsRouter.get('/:id', async (req, res) => {
  const { id } = parseParams(req, PlatformIdParams);
  res.json(await service.getSchool(id));
});

schoolsRouter.patch('/:id', async (req, res) => {
  const { id } = parseParams(req, PlatformIdParams);
  const input = parseBody(req, UpdateSchoolInput);
  const school = await service.updateSchool(id, input);
  await schoolAudit(req, 'platform.school.update', id, { fields: Object.keys(input) });
  res.json(school);
});

schoolsRouter.put('/:id/features', async (req, res) => {
  const { id } = parseParams(req, PlatformIdParams);
  const features = parseBody(req, UpdateSchoolFeaturesInput);
  const school = await service.setFeatures(id, features);
  await schoolAudit(req, 'platform.school.features', id, { features });
  res.json(school);
});

schoolsRouter.put('/:id/limits', async (req, res) => {
  const { id } = parseParams(req, PlatformIdParams);
  const limits = parseBody(req, UpdateSchoolLimitsInput);
  const school = await service.setLimits(id, limits);
  await schoolAudit(req, 'platform.school.limits', id, { limits });
  res.json(school);
});

schoolsRouter.post('/:id/suspend', async (req, res) => {
  const { id } = parseParams(req, PlatformIdParams);
  const { reason } = parseBody(req, SuspendSchoolInput);
  const school = await service.suspendSchool(id, reason);
  await schoolAudit(req, 'platform.school.suspend', id, { reason });
  res.json(school);
});

schoolsRouter.post('/:id/reactivate', async (req, res) => {
  const { id } = parseParams(req, PlatformIdParams);
  const school = await service.reactivateSchool(id);
  await schoolAudit(req, 'platform.school.reactivate', id);
  res.json(school);
});

/* ---------------------------------------------------------------- admins of a school */

schoolsRouter.get('/:id/admins', async (req, res) => {
  const { id } = parseParams(req, PlatformIdParams);
  await service.assertSchool(id);
  res.json(await admins.listSchoolAdmins(id));
});

schoolsRouter.post('/:id/admins', async (req, res) => {
  const { id } = parseParams(req, PlatformIdParams);
  const input = parseBody(req, SchoolAdminInput);
  await service.assertSchool(id);
  const result = await admins.createSchoolAdmin(id, input);
  await adminAudit(req, 'platform.admin.create', id, result.admin.id, { invite: result.invite });
  res.status(201).json(result);
});

schoolsRouter.post('/:id/admins/:adminId/disable', async (req, res) => {
  const { id, adminId } = parseParams(req, PlatformSchoolAdminParams);
  const admin = await admins.setSchoolAdminStatus(id, adminId, 'disabled');
  await adminAudit(req, 'platform.admin.disable', id, adminId);
  res.json(admin);
});

schoolsRouter.post('/:id/admins/:adminId/enable', async (req, res) => {
  const { id, adminId } = parseParams(req, PlatformSchoolAdminParams);
  const admin = await admins.setSchoolAdminStatus(id, adminId, 'active');
  await adminAudit(req, 'platform.admin.enable', id, adminId);
  res.json(admin);
});

schoolsRouter.post('/:id/admins/:adminId/reset-password', async (req, res) => {
  const { id, adminId } = parseParams(req, PlatformSchoolAdminParams);
  const result = await admins.resetSchoolAdminPassword(id, adminId);
  await adminAudit(req, 'platform.admin.reset_password', id, adminId);
  res.json(result);
});

schoolsRouter.post('/:id/admins/:adminId/send-invite', async (req, res) => {
  const { id, adminId } = parseParams(req, PlatformSchoolAdminParams);
  const result = await admins.sendSchoolAdminInvite(id, adminId);
  await adminAudit(req, 'platform.admin.send_invite', id, adminId, { invite: result.invite });
  res.json(result);
});

/* ---------------------------------------------------------------- read-only views */

schoolsRouter.get('/:id/:view', async (req, res) => {
  const { id, view } = parseParams(req, ViewParams);
  const query = parseQuery(req, PlatformViewQuery);
  await service.assertSchool(id);
  res.json(await schoolView(id, view, query, req));
});
