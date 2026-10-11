/**
 * Audit trail: who did what, to what, from where. Never throws — auditing must not break the action.
 * Metadata must not contain secrets (passwords, tokens, keys).
 */
import type { Request } from 'express';
import { db } from '../db/client.js';
import { auditLogs } from '../db/schema/index.js';
import { logger } from './logger.js';

export interface AuditEntry {
  action: string;
  institutionId?: string | null;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  /** Override the actor (e.g. a login attempt before a session exists, or a system task). */
  actor?: { type: 'platform' | 'user' | 'system' | 'anonymous'; id?: string | null; role?: string | null; name?: string | null };
}

export async function audit(req: Request | null, entry: AuditEntry): Promise<void> {
  const actor =
    entry.actor ??
    (req?.platformAdmin
      ? { type: 'platform' as const, id: req.platformAdmin.id, role: 'superadmin', name: req.platformAdmin.name }
      : req?.user
        ? { type: 'user' as const, id: req.user.id, role: req.user.role, name: req.user.name }
        : { type: 'anonymous' as const, id: null, role: null, name: null });
  try {
    await db.insert(auditLogs).values({
      actorType: actor.type,
      actorId: actor.id ?? null,
      actorRole: actor.role ?? null,
      actorName: actor.name ?? null,
      institutionId: entry.institutionId ?? req?.user?.institutionId ?? null,
      action: entry.action,
      targetType: entry.targetType ?? null,
      targetId: entry.targetId ?? null,
      metadata: entry.metadata ?? null,
      ip: req?.ip?.slice(0, 64) ?? null,
      userAgent: req?.get('user-agent')?.slice(0, 300) ?? null,
    });
  } catch (err) {
    logger.warn({ err: (err as Error).message, action: entry.action }, 'Audit write failed');
  }
}
