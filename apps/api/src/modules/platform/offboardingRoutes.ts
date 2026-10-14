/**
 * School offboarding, mounted at /api/platform/schools next to the schools router (super admin only):
 * - POST   /:id/export  streams the school's data as a JSON download;
 * - DELETE /:id         hard-deletes a suspended school (body: { confirmCode } = the school code).
 */
import { Router } from 'express';
import { PlatformIdParams } from '@classiq/shared';
import { audit } from '../../lib/audit.js';
import { authenticatePlatform } from '../../middleware/platformAuth.js';
import { parseBody, parseParams } from '../../middleware/validate.js';
import { DeleteSchoolInput, deleteSchool, getSchoolRow, writeSchoolExport } from './offboardingService.js';

export const offboardingRouter = Router();

offboardingRouter.post('/:id/export', authenticatePlatform(), async (req, res) => {
  const { id } = parseParams(req, PlatformIdParams);
  const school = await getSchoolRow(id);
  const day = new Date().toISOString().slice(0, 10);
  const code = school.code.replace(/[^A-Za-z0-9_-]/g, '_');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="classiq-school-${code}-${day}.json"`);
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  try {
    const counts = await writeSchoolExport(school, res);
    res.end();
    await audit(req, {
      action: 'platform.school.export',
      institutionId: id,
      targetType: 'institution',
      targetId: id,
      metadata: { code: school.code, counts },
    });
  } catch (err) {
    // Headers (and part of the body) are already out: cut the download so it can't pass as complete.
    req.log.error({ err }, 'School export failed');
    res.destroy();
  }
});

offboardingRouter.delete('/:id', authenticatePlatform(), async (req, res) => {
  const { id } = parseParams(req, PlatformIdParams);
  const { confirmCode } = parseBody(req, DeleteSchoolInput);
  const result = await deleteSchool(id, confirmCode);
  // The school row is gone, so the entry can't reference it: the id stays in targetId.
  await audit(req, {
    action: 'platform.school.delete',
    institutionId: null,
    targetType: 'institution',
    targetId: id,
    metadata: { code: result.code, name: result.name, counts: result.counts, storage: result.storage },
  });
  res.json(result);
});
