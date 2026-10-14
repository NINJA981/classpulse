/**
 * AI teaching resources, mounted at /api/resources (teacher role; the school's "teacherTools" feature).
 * Generation is queued (aiLimiter); the web app polls GET /:id while the resource is queued/generating.
 */
import { Router, type Response } from 'express';
import { GenerateResourceInput, IdParams, ListResourcesQuery, UpdateResourceInput } from '@classiq/shared';
import { authenticate, currentUser, requireRole } from '../../middleware/auth.js';
import { aiLimiter } from '../../middleware/rateLimit.js';
import { requireFeature } from '../../middleware/requireFeature.js';
import { parseBody, parseParams, parseQuery } from '../../middleware/validate.js';
import type { ExportedFile } from './exporters/index.js';
import * as service from './service.js';
import { transcribeVoicePrompt, voiceUploadMiddleware } from './voice.js';

export const resourcesRouter = Router();
resourcesRouter.use(authenticate(), requireRole('teacher'), requireFeature('teacherTools'));

/** RFC 6266 filename: an ASCII fallback plus the UTF-8 original. */
function sendFile(res: Response, file: ExportedFile) {
  const ascii = file.filename.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  res.setHeader('Content-Type', file.contentType);
  res.setHeader('Content-Length', String(file.buffer.length));
  res.setHeader('Content-Disposition', `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(file.filename)}`);
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(file.buffer);
}

resourcesRouter.get('/', async (req, res) => {
  res.json(await service.listResources(currentUser(req), parseQuery(req, ListResourcesQuery)));
});

resourcesRouter.post('/generate', aiLimiter, async (req, res) => {
  res.status(201).json(await service.generateResource(currentUser(req), parseBody(req, GenerateResourceInput)));
});

resourcesRouter.post('/voice', aiLimiter, voiceUploadMiddleware, async (req, res) => {
  res.json(await transcribeVoicePrompt(currentUser(req), req.file));
});

resourcesRouter.get('/:id', async (req, res) => {
  const { id } = parseParams(req, IdParams);
  res.json(await service.getResource(currentUser(req), id));
});

resourcesRouter.patch('/:id', async (req, res) => {
  const { id } = parseParams(req, IdParams);
  res.json(await service.updateResource(currentUser(req), id, parseBody(req, UpdateResourceInput)));
});

resourcesRouter.delete('/:id', async (req, res) => {
  const { id } = parseParams(req, IdParams);
  await service.deleteResource(currentUser(req), id);
  res.status(204).end();
});

resourcesRouter.post('/:id/regenerate', aiLimiter, async (req, res) => {
  const { id } = parseParams(req, IdParams);
  res.json(await service.regenerateResource(currentUser(req), id));
});

resourcesRouter.post('/:id/share', async (req, res) => {
  const { id } = parseParams(req, IdParams);
  res.json(await service.setShared(currentUser(req), id, true));
});

resourcesRouter.post('/:id/unshare', async (req, res) => {
  const { id } = parseParams(req, IdParams);
  res.json(await service.setShared(currentUser(req), id, false));
});

resourcesRouter.post('/:id/copy', async (req, res) => {
  const { id } = parseParams(req, IdParams);
  res.status(201).json(await service.copyResource(currentUser(req), id));
});

/** Download in the type's format: /export (any), /export.docx or /export.pptx (404 if the type has another format). */
resourcesRouter.get('/:id/export', async (req, res) => {
  const { id } = parseParams(req, IdParams);
  sendFile(res, await service.exportResource(currentUser(req), id));
});
resourcesRouter.get('/:id/export.docx', async (req, res) => {
  const { id } = parseParams(req, IdParams);
  sendFile(res, await service.exportResource(currentUser(req), id, 'docx'));
});
resourcesRouter.get('/:id/export.pptx', async (req, res) => {
  const { id } = parseParams(req, IdParams);
  sendFile(res, await service.exportResource(currentUser(req), id, 'pptx'));
});
