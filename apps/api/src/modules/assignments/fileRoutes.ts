/**
 * Submission file downloads, reachable by both roles (mounted at /api/assignment-files): the student who
 * uploaded the file, or a teacher of the assignment's section. Everyone else gets 404.
 */
import { Router } from 'express';
import { pipeline } from 'node:stream/promises';
import { IdParams } from '@classpulse/shared';
import { notFound } from '../../lib/errors.js';
import { storage } from '../../lib/storage.js';
import { authenticate, currentUser } from '../../middleware/auth.js';
import { parseParams } from '../../middleware/validate.js';
import { getReadableFile } from './service.js';

/** RFC 6266 filename: an ASCII fallback plus the UTF-8 original. */
function contentDisposition(name: string, inline: boolean): string {
  const ascii = name.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  return `${inline ? 'inline' : 'attachment'}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

/**
 * Shown in the browser (image previews); everything else, PDFs included, downloads. A student's PDF is
 * never rendered on the app's origin, where its scripts or forms could act as the viewer.
 */
const INLINE_TYPES = new Set(['image/jpeg', 'image/png']);

/** Every file response: a sandboxed, resource-less document even if a browser ever renders it. */
export const FILE_CSP = "sandbox; default-src 'none'";

export const assignmentFilesRouter = Router();
assignmentFilesRouter.use(authenticate());

assignmentFilesRouter.get('/:id', async (req, res) => {
  const { id } = parseParams(req, IdParams);
  const file = await getReadableFile(currentUser(req), id);
  const stat = await storage.stat(file.objectKey);
  if (!stat) throw notFound('File');
  res.setHeader('Content-Type', file.mime);
  res.setHeader('Content-Length', String(stat.size));
  res.setHeader('Content-Disposition', contentDisposition(file.originalName, INLINE_TYPES.has(file.mime)));
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', FILE_CSP);
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  try {
    await pipeline(await storage.read(file.objectKey), res);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ERR_STREAM_PREMATURE_CLOSE') req.log.warn({ err }, 'File download failed');
    if (!res.headersSent) throw err;
    res.destroy();
  }
});
