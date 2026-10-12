import { Router, type Request } from 'express';
import { CreateTeacherInput, IdParams, ImportTeachersInput, UpdateTeacherInput } from '@classpulse/shared';
import { audit } from '../../lib/audit.js';
import { authenticate, currentUser, requireRole } from '../../middleware/auth.js';
import { parseBody, parseParams } from '../../middleware/validate.js';
import { disconnectUserSockets } from '../../sockets/sessions.js';
import * as service from './service.js';

/** Audit entry for an action on one teacher account (never passwords or links in metadata). */
const teacherAudit = (req: Request, action: string, id: string, metadata?: Record<string, unknown>) =>
  audit(req, { action, targetType: 'user', targetId: id, metadata });

export const router = Router();
router.use(authenticate(), requireRole('admin'));

router.get('/', async (req, res) => {
  res.json(await service.listTeachers(currentUser(req).institutionId));
});

router.post('/', async (req, res) => {
  const input = parseBody(req, CreateTeacherInput);
  const actor = currentUser(req);
  const result = await service.createTeacher(actor.institutionId, input, actor.id);
  await teacherAudit(req, 'teacher.create', result.record.id, { invite: result.invite });
  res.status(201).json(result);
});

router.post('/import', async (req, res) => {
  const input = parseBody(req, ImportTeachersInput);
  const actor = currentUser(req);
  const result = await service.importTeachers(actor.institutionId, input, actor.id);
  await audit(req, {
    action: 'teacher.import',
    targetType: 'institution',
    targetId: actor.institutionId,
    metadata: { rows: input.rows.length, created: result.created.length, skipped: result.skipped.length },
  });
  res.json(result);
});

router.patch('/:id', async (req, res) => {
  const { id } = parseParams(req, IdParams);
  const input = parseBody(req, UpdateTeacherInput);
  const teacher = await service.updateTeacher(currentUser(req).institutionId, id, input);
  const action = input.status === 'disabled' ? 'teacher.disable' : input.status === 'active' ? 'teacher.enable' : 'teacher.update';
  await teacherAudit(req, action, id, { fields: Object.keys(input) });
  if (input.status === 'disabled') disconnectUserSockets(id);
  res.json(teacher);
});

router.delete('/:id', async (req, res) => {
  const { id } = parseParams(req, IdParams);
  await service.deleteTeacher(currentUser(req).institutionId, id);
  await teacherAudit(req, 'teacher.delete', id);
  disconnectUserSockets(id);
  res.status(204).end();
});

router.post('/:id/reset-password', async (req, res) => {
  const { id } = parseParams(req, IdParams);
  const result = await service.resetTeacherPassword(currentUser(req).institutionId, id);
  await teacherAudit(req, 'teacher.reset_password', id);
  disconnectUserSockets(id);
  res.json(result);
});

router.post('/:id/send-invite', async (req, res) => {
  const { id } = parseParams(req, IdParams);
  const actor = currentUser(req);
  const result = await service.sendTeacherLink(actor.institutionId, id, 'invite', actor.id);
  await teacherAudit(req, 'teacher.send_invite', id, { invite: result.invite });
  res.json(result);
});

router.post('/:id/send-reset-link', async (req, res) => {
  const { id } = parseParams(req, IdParams);
  const actor = currentUser(req);
  const result = await service.sendTeacherLink(actor.institutionId, id, 'reset', actor.id);
  await teacherAudit(req, 'teacher.send_reset_link', id, { invite: result.invite });
  res.json(result);
});
