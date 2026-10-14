import { eq } from 'drizzle-orm';
import type { Institution, InstitutionInput } from '@classiq/shared';
import { db } from '../../db/client.js';
import { institutions } from '../../db/schema/index.js';
import { AppError, conflict, isUniqueViolation, notFound } from '../../lib/errors.js';

export function toInstitution(row: typeof institutions.$inferSelect): Institution {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    timezone: row.timezone,
    academicYear: row.academicYear,
    createdAt: row.createdAt.toISOString(),
  };
}

export function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export async function getInstitution(institutionId: string): Promise<Institution> {
  const row = await db.query.institutions.findFirst({ where: eq(institutions.id, institutionId) });
  if (!row) throw notFound('Institution');
  return toInstitution(row);
}

/** Create or update the admin's own institution row. */
export async function upsertInstitution(institutionId: string, input: InstitutionInput): Promise<Institution> {
  if (!isValidTimezone(input.timezone)) {
    throw new AppError('VALIDATION_FAILED', 'Some fields are invalid', [
      { path: 'timezone', message: 'Unknown time zone' },
    ]);
  }
  const values = {
    name: input.name,
    code: input.code,
    timezone: input.timezone,
    academicYear: input.academicYear ?? null,
  };
  try {
    const [row] = await db
      .insert(institutions)
      .values({ id: institutionId, ...values })
      .onConflictDoUpdate({ target: institutions.id, set: values })
      .returning();
    return toInstitution(row!);
  } catch (err) {
    if (isUniqueViolation(err, 'institutions_code_unique')) throw conflict('Another institution already uses that code');
    throw err;
  }
}
