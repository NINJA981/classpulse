/**
 * Usage and AI-cost statistics for the platform console. Mounted at /api/platform/stats behind
 * authenticatePlatform() (the router itself applies no auth, like the other platform sub-routers).
 */
import { Router } from 'express';
import { PlatformStatsCsvQuery, PlatformStatsQuery } from '@classpulse/shared';
import { parseQuery } from '../../middleware/validate.js';
import * as service from './statsService.js';

export const statsRouter = Router();

statsRouter.get('/', async (req, res) => {
  res.json(await service.getStats(parseQuery(req, PlatformStatsQuery)));
});

statsRouter.get('/overview', async (_req, res) => {
  res.json(await service.getOverview());
});

statsRouter.get('/export.csv', async (req, res) => {
  const { filename, csv } = await service.statsCsv(parseQuery(req, PlatformStatsCsvQuery));
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Cache-Control', 'no-store');
  res.send(csv);
});
