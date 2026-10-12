import { Router, type Request } from 'express';
import { CreateStudentInput, IdParams, ImportStudentsInput, UpdateStudentInput } from '@classpulse/shared';
import { audit } from '../../lib/audit.js';
import { authenticate, currentUser, requireRole } from '../../middleware/auth.js';
import { parseBody, parseParams, parseQuery } from '../../middleware/validate.js';
import { disconnectUserSockets } from '../../sockets/sessions.js';
import * as service from './service.js';

/** Audit entry for an action on one student account (never passwords or links in metadata). */
const studentAudit = (req: Request, action: string, id: string, metadata?: Record<string, unknown>) =>
  audit(req, { action, targetType: 'user', targetId: id, metadata });

export const router = Router();
router.use(authenticate(), requireRole('admin'));

router.get('/', async (req, res) => {
  const query = parseQuery(req, service.ListStudentsQuery);
  res.json(await service.listStudents(currentUser(req).institutionId, query));
});

router.post('/', async (req, res) => {
  const input = parseBody(req, CreateStudentInput);
  const actor = currentUser(req);
  const result = await service.createStudent(actor.institutionId, input, actor.id);
  await studentAudit(req, 'student.create', result.record.id, { sectionId: input.sectionId ?? null, invite: result.invite });
  res.status(201).json(result);
});

router.post('/import', async (req, res) => {
  const input = parseBody(req, ImportStudentsInput);
  const actor = currentUser(req);
  const result = await service.importStudents(actor.institutionId, input, actor.id);
  await audit(req, {
    action: 'student.import',
    targetType: 'institution',
    targetId: actor.institutionId,
    metadata: { rows: input.rows.length, created: result.created.length, skipped: result.skipped.length, sectionId: input.sectionId ?? null },
  });
  res.json(result);
});

router.patch('/:id', async (req, res) => {
  const { id } = parseParams(req, IdParams);
  const input = parseBody(req, UpdateStudentInput);
  const student = await service.updateStudent(currentUser(req).institutionId, id, input);
  const action = input.status === 'disabled' ? 'student.disable' : input.status === 'active' ? 'student.enable' : 'student.update';
  await studentAudit(req, action, id, { fields: Object.keys(input) });
  if (input.status === 'disabled') disconnectUserSockets(id);
  res.json(student);
});

router.delete('/:id', async (req, res) => {
  const { id } = parseParams(req, IdParams);
  await service.deleteStudent(currentUser(req).institutionId, id);
  await studentAudit(req, 'student.delete', id);
  disconnectUserSockets(id);
  res.status(204).end();
});

router.post('/:id/reset-password', async (req, res) => {
  const { id } = parseParams(req, IdParams);
  const result = await service.resetStudentPassword(currentUser(req).institutionId, id);
  await studentAudit(req, 'student.reset_password', id);
  disconnectUserSockets(id);
  res.json(result);
});

router.post('/:id/send-invite', async (req, res) => {
  const { id } = parseParams(req, IdParams);
  const actor = currentUser(req);
  const result = await service.sendStudentLink(actor.institutionId, id, 'invite', actor.id);
  await studentAudit(req, 'student.send_invite', id, { invite: result.invite });
  res.json(result);
});

router.post('/:id/send-reset-link', async (req, res) => {
  const { id } = parseParams(req, IdParams);
  const actor = currentUser(req);
  const result = await service.sendStudentLink(actor.institutionId, id, 'reset', actor.id);
  await studentAudit(req, 'student.send_reset_link', id, { invite: result.invite });
  res.json(result);
});
