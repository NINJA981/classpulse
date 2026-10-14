/**
 * Schools (institutions) as managed from the platform console: list with counts and last activity,
 * create with a first admin, profile edits, feature switches, limits, suspend and reactivate.
 * Every write invalidates the cached platform state of the school (lib/platformState).
 */
import { asc, eq, ilike, or, sql, type SQL } from 'drizzle-orm';
import {
  DEFAULT_INSTITUTION_FEATURES,
  DEFAULT_INSTITUTION_LIMITS,
  DEFAULT_MODEL_SETTINGS,
  InstitutionFeatures,
  InstitutionLimits,
  type CreateSchoolInput,
  type CreateSchoolResult,
  type PlatformSchool,
  type PlatformSchoolDetail,
  type UpdateSchoolInput,
} from '@classiq/shared';
import { db } from '../../db/client.js';
import {
  assignments,
  devices,
  exams,
  institutions,
  lessons,
  liveSessions,
  modelSettings,
  sections,
  users,
} from '../../db/schema/index.js';
import { generateInitialPassword, hashPassword } from '../../lib/crypto.js';
import { conflict, isUniqueViolation, notFound } from '../../lib/errors.js';
import { getPlatformSettings, invalidateInstitutionState } from '../../lib/platformState.js';
import { rethrowUserConflict } from '../auth/accounts.js';
import { issueToken } from '../auth/passwordTokens.js';
import { getSchoolAdmin } from './adminsService.js';

type InstitutionRow = typeof institutions.$inferSelect;

/** Always table-qualified: drizzle leaves columns unqualified in single-table selects, which is ambiguous in subqueries. */
const schoolId = sql.raw('"institutions"."id"');

const countUsers = (role: 'admin' | 'teacher' | 'student') =>
  sql<number>`(select count(*)::int from ${users} u where u.institution_id = ${schoolId} and u.role = ${role})`;
const countIn = (table: typeof sections | typeof lessons | typeof devices | typeof exams) =>
  sql<number>`(select count(*)::int from ${table} t where t.institution_id = ${schoolId})`;

/** Latest of any user's sign-in and the latest lesson created (null = never used). */
const lastActivity = sql<string | null>`greatest(
  (select max(u.last_login_at) from ${users} u where u.institution_id = ${schoolId}),
  (select max(l.created_at) from ${lessons} l where l.institution_id = ${schoolId})
)`;

const summaryColumns = {
  row: institutions,
  admins: countUsers('admin'),
  teachers: countUsers('teacher'),
  students: countUsers('student'),
  sections: countIn(sections),
  lessons: countIn(lessons),
  lastActivityAt: lastActivity,
};

type SummaryRow = { row: InstitutionRow; admins: number; teachers: number; students: number; sections: number; lessons: number; lastActivityAt: string | Date | null };

const iso = (v: string | Date | null) => (v === null ? null : new Date(v).toISOString());

function toSchool(r: SummaryRow): PlatformSchool {
  const i = r.row;
  return {
    id: i.id,
    name: i.name,
    code: i.code,
    timezone: i.timezone,
    academicYear: i.academicYear,
    status: i.status,
    suspendedReason: i.suspendedReason,
    suspendedAt: i.suspendedAt?.toISOString() ?? null,
    createdAt: i.createdAt.toISOString(),
    lastActivityAt: iso(r.lastActivityAt),
    counts: { admins: r.admins, teachers: r.teachers, students: r.students, sections: r.sections, lessons: r.lessons },
    limits: InstitutionLimits.safeParse({ ...DEFAULT_INSTITUTION_LIMITS, ...i.limits }).data ?? DEFAULT_INSTITUTION_LIMITS,
  };
}

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

export async function listSchools(q?: string): Promise<PlatformSchool[]> {
  let where: SQL | undefined;
  if (q) {
    const pattern = `%${escapeLike(q)}%`;
    where = or(ilike(institutions.name, pattern), ilike(institutions.code, pattern));
  }
  const rows = await db.select(summaryColumns).from(institutions).where(where).orderBy(asc(institutions.name));
  return rows.map(toSchool);
}

export async function getSchool(id: string): Promise<PlatformSchoolDetail> {
  const [r] = await db
    .select({
      ...summaryColumns,
      devices: countIn(devices),
      exams: countIn(exams),
      assignments: sql<number>`(select count(*)::int from ${assignments} a join ${sections} s on s.id = a.section_id where s.institution_id = ${schoolId})`,
      liveSessions: sql<number>`(select count(*)::int from ${liveSessions} ls join ${lessons} l on l.id = ls.lesson_id where l.institution_id = ${schoolId})`,
    })
    .from(institutions)
    .where(eq(institutions.id, id));
  if (!r) throw notFound('School');
  return {
    ...toSchool(r),
    features: InstitutionFeatures.safeParse({ ...DEFAULT_INSTITUTION_FEATURES, ...r.row.features }).data ?? DEFAULT_INSTITUTION_FEATURES,
    contact: r.row.contact ?? null,
    notes: r.row.notes,
    extraCounts: { devices: r.devices, exams: r.exams, assignments: r.assignments, liveSessions: r.liveSessions },
  };
}

function rethrowSchoolConflict(err: unknown): never {
  if (isUniqueViolation(err, 'institutions_code_unique')) throw conflict('That school code is already in use');
  rethrowUserConflict(err);
}

/**
 * Create a school with the platform's default AI models and its first admin (one-time password,
 * plus an emailed set-password invitation when email is configured).
 */
export async function createSchool(input: CreateSchoolInput): Promise<CreateSchoolResult> {
  const { defaultModels } = await getPlatformSettings();
  const initialPassword = generateInitialPassword();
  const passwordHash = await hashPassword(initialPassword);
  const { schoolId, adminId } = await db
    .transaction(async (tx) => {
      const [school] = await tx
        .insert(institutions)
        .values({
          name: input.name,
          code: input.code,
          timezone: input.timezone,
          academicYear: input.academicYear || null,
          contact: input.contact ?? null,
          notes: input.notes || null,
        })
        .returning({ id: institutions.id });
      await tx.insert(modelSettings).values({
        institutionId: school!.id,
        ...defaultModels,
        questionsPerLesson: DEFAULT_MODEL_SETTINGS.questionsPerLesson,
        bilingual: DEFAULT_MODEL_SETTINGS.bilingual,
      });
      const [admin] = await tx
        .insert(users)
        .values({
          institutionId: school!.id,
          role: 'admin',
          name: input.admin.name,
          email: input.admin.email,
          passwordHash,
          mustChangePassword: true,
        })
        .returning({ id: users.id });
      return { schoolId: school!.id, adminId: admin!.id };
    })
    .catch(rethrowSchoolConflict);
  const invite = await issueToken(adminId, 'invite', null);
  return { school: await getSchool(schoolId), admin: await getSchoolAdmin(schoolId, adminId), initialPassword, invite };
}

async function updateRow(id: string, values: Partial<typeof institutions.$inferInsert>): Promise<PlatformSchoolDetail> {
  const updated = await db
    .update(institutions)
    .set(values)
    .where(eq(institutions.id, id))
    .returning({ id: institutions.id })
    .catch(rethrowSchoolConflict);
  if (updated.length === 0) throw notFound('School');
  invalidateInstitutionState(id);
  return getSchool(id);
}

export function updateSchool(id: string, input: UpdateSchoolInput): Promise<PlatformSchoolDetail> {
  if (Object.keys(input).length === 0) return getSchool(id);
  return updateRow(id, {
    ...input,
    ...(input.academicYear !== undefined && { academicYear: input.academicYear || null }),
    ...(input.notes !== undefined && { notes: input.notes || null }),
  });
}

export const setFeatures = (id: string, features: InstitutionFeatures) => updateRow(id, { features });
export const setLimits = (id: string, limits: InstitutionLimits) => updateRow(id, { limits });

export const suspendSchool = (id: string, reason: string) =>
  updateRow(id, { status: 'suspended', suspendedReason: reason, suspendedAt: new Date() });

export const reactivateSchool = (id: string) =>
  updateRow(id, { status: 'active', suspendedReason: null, suspendedAt: null });

/** 404 unless the school exists (for nested routes). */
export async function assertSchool(id: string): Promise<void> {
  const row = await db.query.institutions.findFirst({ where: eq(institutions.id, id), columns: { id: true } });
  if (!row) throw notFound('School');
}
