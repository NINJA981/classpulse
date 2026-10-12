/** Global user search across every school (name, email or roll number). */
import { and, asc, eq, ilike, or } from 'drizzle-orm';
import type { Request } from 'express';
import type { PlatformUserHit, PlatformUserSearchQuery } from '@classpulse/shared';
import { db } from '../../db/client.js';
import { audit } from '../../lib/audit.js';
import { institutions, users } from '../../db/schema/index.js';

const LIMIT = 50;
const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

/** Every search is audited when `req` is given (a super admin reading people across schools). */
export async function searchUsers(query: PlatformUserSearchQuery, req: Request | null = null): Promise<PlatformUserHit[]> {
  const pattern = `%${escapeLike(query.q)}%`;
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      rollNumber: users.rollNumber,
      role: users.role,
      status: users.status,
      lastLoginAt: users.lastLoginAt,
      schoolId: institutions.id,
      schoolName: institutions.name,
      schoolCode: institutions.code,
      schoolStatus: institutions.status,
    })
    .from(users)
    .innerJoin(institutions, eq(institutions.id, users.institutionId))
    .where(
      and(
        or(ilike(users.name, pattern), ilike(users.email, pattern), ilike(users.rollNumber, pattern)),
        query.role ? eq(users.role, query.role) : undefined,
      ),
    )
    .orderBy(asc(users.name))
    .limit(LIMIT);
  if (req) {
    await audit(req, { action: 'platform.users.search', targetType: 'user', metadata: { q: query.q, role: query.role ?? null, rows: rows.length } });
  }
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    rollNumber: r.rollNumber,
    role: r.role,
    status: r.status,
    lastLoginAt: r.lastLoginAt?.toISOString() ?? null,
    school: { id: r.schoolId, name: r.schoolName, code: r.schoolCode, status: r.schoolStatus },
  }));
}
