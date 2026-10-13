/**
 * Student data export (right of access), mounted at /api/admin/students next to the students router.
 * Admin only, same school; every export and file download is audited.
 */
import { Router } from 'express';
import { pipeline } from 'node:stream/promises';
import { z } from 'zod';
import { Id, IdParams } from '@classpulse/shared';
import { audit } from '../../lib/audit.js';
import { notFound } from '../../lib/errors.js';
import { storage } from '../../lib/storage.js';
import { authenticate, currentUser, requireRole } from '../../middleware/auth.js';
import { parseParams } from '../../middleware/validate.js';
import { exportStudentData, getExportFile } from './export.js';

export const router = Router();
const adminOnly = [authenticate(), requireRole('admin')];

const FileParams = z.object({ id: Id, fileId: Id });

/** RFC 6266: an ASCII fallback plus the UTF-8 original; always a download. */
function attachment(name: string): string {
  const ascii = name.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

router.get('/:id/export', ...adminOnly, async (req, res) => {
  const { id } = parseParams(req, IdParams);
  const data = await exportStudentData(currentUser(req).institutionId, id);
  await audit(req, {
    action: 'student.export',
    targetType: 'user',
    targetId: id,
    metadata: {
      quizAttempts: data.quizAttempts.length,
      examAttempts: data.examAttempts.length,
      submissions: data.assignmentSubmissions.length,
    },
  });
  const roll = (data.student.rollNumber ?? 'student').replace(/[^A-Za-z0-9_-]/g, '_');
  res.setHeader('Content-Disposition', attachment(`classpulse-student-${roll}-${data.generatedAt.slice(0, 10)}.json`));
  res.setHeader('Cache-Control', 'private, no-store');
  res.json(data);
});

router.get('/:id/export/files/:fileId', ...adminOnly, async (req, res) => {
  const { id, fileId } = parseParams(req, FileParams);
  const file = await getExportFile(currentUser(req).institutionId, id, fileId);
  const stat = await storage.stat(file.objectKey);
  if (!stat) throw notFound('File');
  await audit(req, { action: 'student.export_file', targetType: 'user', targetId: id, metadata: { fileId } });
  res.setHeader('Content-Type', file.mime);
  res.setHeader('Content-Length', String(stat.size));
  res.setHeader('Content-Disposition', attachment(file.originalName));
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  try {
    await pipeline(await storage.read(file.objectKey), res);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ERR_STREAM_PREMATURE_CLOSE') req.log.warn({ err }, 'Export file download failed');
    if (!res.headersSent) throw err;
    res.destroy();
  }
});
