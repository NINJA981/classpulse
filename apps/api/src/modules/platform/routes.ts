/**
 * The platform (super admin) API, mounted at /api/platform. Every route except the sign-in steps
 * requires a `cp_platform` session (school sessions never pass). The ops and stats routers are
 * mounted separately (/api/platform/ops, /api/platform/stats).
 */
import { Router } from 'express';
import { PlatformUserSearchQuery, UpdatePlatformSettingsInput } from '@classpulse/shared';
import { audit } from '../../lib/audit.js';
import { authenticatePlatform, currentPlatformAdmin } from '../../middleware/platformAuth.js';
import { parseBody, parseQuery } from '../../middleware/validate.js';
import { platformAuthRouter } from './authRoutes.js';
import { schoolsRouter } from './schoolsRoutes.js';
import * as settings from './settingsService.js';
import { searchUsers } from './usersService.js';

export const platformRouter = Router();

platformRouter.use('/auth', platformAuthRouter);
platformRouter.use('/schools', schoolsRouter);

platformRouter.get('/users', authenticatePlatform(), async (req, res) => {
  const query = parseQuery(req, PlatformUserSearchQuery);
  res.json(await searchUsers(query, req));
});

platformRouter.get('/settings', authenticatePlatform(), async (_req, res) => {
  res.json(await settings.readSettings());
});

platformRouter.put('/settings', authenticatePlatform(), async (req, res) => {
  const input = parseBody(req, UpdatePlatformSettingsInput);
  const { settings: body, changed } = await settings.updateSettings(input, currentPlatformAdmin(req).id);
  // Section names and the public notice only, not the full price tables.
  await audit(req, {
    action: 'platform.settings.update',
    targetType: 'platform_settings',
    metadata: { sections: changed, maintenance: body.maintenance, banner: body.banner },
  });
  res.json(body);
});
