/**
 * Audit log browsing for the platform console. `auditRouter` serves the same list at
 * /api/platform/audit (used by the school detail page); the ops router also mounts it.
 */
import { Router, type Request, type Response } from 'express';
import { and, count, desc, eq, gte, ilike, lte, or, sql, type SQL } from 'drizzle-orm';
import { AuditQuery, type AuditLogEntry, type AuditLogPage } from '@classiq/shared';
import { db } from '../../db/client.js';
import { audit } from '../../lib/audit.js';
import { auditLogs, institutions } from '../../db/schema/index.js';
import { parseQuery } from '../../middleware/validate.js';
import { csvFilename, toCsv } from './opsCsv.js';
import { likeContains, CSV_MAX_ROWS } from './opsLogs.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function conditions(f: AuditQuery): SQL | undefined {
  const where: (SQL | undefined)[] = [];
  if (f.actor) {
    where.push(UUID.test(f.actor) ? eq(auditLogs.actorId, f.actor) : ilike(auditLogs.actorName, likeContains(f.actor)));
  }
  if (f.institutionId) where.push(eq(auditLogs.institutionId, f.institutionId));
  if (f.action) where.push(or(eq(auditLogs.action, f.action), ilike(auditLogs.action, `${f.action.replace(/[\\%_]/g, (c) => `\\${c}`)}%`)));
  if (f.from) where.push(gte(auditLogs.at, new Date(f.from)));
  if (f.to) where.push(lte(auditLogs.at, new Date(f.to)));
  return and(...where);
}

async function select(f: AuditQuery, limit: number, offset: number): Promise<AuditLogEntry[]> {
  const rows = await db
    .select({ a: auditLogs, institutionName: institutions.name })
    .from(auditLogs)
    .leftJoin(institutions, eq(institutions.id, auditLogs.institutionId))
    .where(conditions(f))
    .orderBy(desc(auditLogs.at), desc(auditLogs.id))
    .limit(limit)
    .offset(offset);
  return rows.map(({ a, institutionName }) => ({
    id: a.id,
    at: a.at.toISOString(),
    actorType: a.actorType,
    actorId: a.actorId,
    actorRole: a.actorRole,
    actorName: a.actorName,
    institutionId: a.institutionId,
    institutionName: institutionName ?? null,
    action: a.action,
    targetType: a.targetType,
    targetId: a.targetId,
    metadata: a.metadata ?? null,
    ip: a.ip,
  }));
}

export async function listAudit(f: AuditQuery): Promise<AuditLogPage> {
  const [items, [total]] = await Promise.all([
    select(f, f.pageSize, (f.page - 1) * f.pageSize),
    db.select({ n: count() }).from(auditLogs).where(conditions(f)),
  ]);
  return { items, total: total?.n ?? 0, page: f.page, pageSize: f.pageSize };
}

export async function auditCsv(f: AuditQuery): Promise<string> {
  const items = await select(f, CSV_MAX_ROWS, 0);
  return toCsv([
    ['id', 'at', 'actor_type', 'actor_name', 'actor_role', 'actor_id', 'school', 'institution_id', 'action', 'target_type', 'target_id', 'ip', 'metadata'],
    ...items.map((a) => [
      a.id,
      a.at,
      a.actorType,
      a.actorName,
      a.actorRole,
      a.actorId,
      a.institutionName,
      a.institutionId,
      a.action,
      a.targetType,
      a.targetId,
      a.ip,
      a.metadata ? JSON.stringify(a.metadata) : null,
    ]),
  ]);
}

export async function purgeOldAudit(days = 365, batch = 5000): Promise<number> {
  const cutoff = new Date(Date.now() - days * 86400_000);
  let total = 0;
  for (;;) {
    const res = await db.execute(
      sql`delete from audit_logs where id in (select id from audit_logs where at < ${cutoff} order by at limit ${batch})`,
    );
    const n = res.rowCount ?? 0;
    total += n;
    if (n < batch) break;
  }
  return total;
}

/** GET / (paged JSON). Mount behind authenticatePlatform(). */
export const auditRouter = Router();

auditRouter.get('/', async (req, res) => {
  res.json(await listAudit(parseQuery(req, AuditQuery)));
});

export async function sendAuditCsv(req: Request, res: Response): Promise<void> {
  const query = parseQuery(req, AuditQuery);
  const csv = await auditCsv(query);
  await audit(req, { action: 'platform.audit.export', metadata: { filters: query } });
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${csvFilename('audit-log')}"`);
  res.setHeader('Cache-Control', 'private, no-store');
  res.send(csv);
}
