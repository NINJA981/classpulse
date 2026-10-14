/**
 * Platform controls as seen by the school app: each institution's status, feature switches and
 * limits, plus the platform-wide settings (maintenance, banner, default models, AI prices).
 * Cached for 30 s per process; platform writes in this process invalidate immediately, other
 * processes (the worker, a second API replica) catch up within the TTL.
 */
import { and, count, eq, inArray } from 'drizzle-orm';
import {
  AiPrices,
  BannerSetting,
  DEFAULT_INSTITUTION_FEATURES,
  DEFAULT_INSTITUTION_LIMITS,
  DEFAULT_PLATFORM_SETTINGS,
  DefaultModelsSetting,
  InstitutionFeatures,
  InstitutionLimits,
  MaintenanceSetting,
  type InstitutionStatus,
  type PlatformNotice,
  type PlatformSettings,
} from '@classiq/shared';
import { db } from '../db/client.js';
import { institutions, platformSettings, users } from '../db/schema/index.js';
import { AppError, conflict } from './errors.js';

const TTL_MS = 30_000;

export interface InstitutionState {
  status: InstitutionStatus;
  features: InstitutionFeatures;
  limits: InstitutionLimits;
}

const institutionCache = new Map<string, { at: number; value: InstitutionState | null }>();
let settingsCache: { at: number; value: PlatformSettings } | null = null;

/** The institution's platform state, or null when it doesn't exist. */
export async function institutionState(institutionId: string): Promise<InstitutionState | null> {
  const hit = institutionCache.get(institutionId);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;
  const row = await db.query.institutions.findFirst({
    where: eq(institutions.id, institutionId),
    columns: { status: true, features: true, limits: true },
  });
  // Stored JSON may predate a newly added switch/limit: fill gaps from the defaults.
  const value: InstitutionState | null = row
    ? {
        status: row.status,
        features: InstitutionFeatures.safeParse({ ...DEFAULT_INSTITUTION_FEATURES, ...row.features }).data ?? DEFAULT_INSTITUTION_FEATURES,
        limits: InstitutionLimits.safeParse({ ...DEFAULT_INSTITUTION_LIMITS, ...row.limits }).data ?? DEFAULT_INSTITUTION_LIMITS,
      }
    : null;
  institutionCache.set(institutionId, { at: Date.now(), value });
  return value;
}

/**
 * Listeners told after a platform write in this process changed a school's state (`institutionId`)
 * or the platform-wide settings (`null`). Sockets use it to drop sessions of a suspended school or
 * during maintenance straight away. Listeners must not throw.
 */
type PlatformStateListener = (institutionId: string | null) => void;
const listeners = new Set<PlatformStateListener>();

export function onPlatformStateChange(listener: PlatformStateListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notifyListeners(institutionId: string | null): void {
  for (const listener of listeners) {
    try {
      listener(institutionId);
    } catch {
      // A listener's failure must never break the platform write that triggered it.
    }
  }
}

export function invalidateInstitutionState(institutionId: string): void {
  institutionCache.delete(institutionId);
  notifyListeners(institutionId);
}

const SECTIONS = {
  maintenance: MaintenanceSetting,
  banner: BannerSetting,
  defaultModels: DefaultModelsSetting,
  aiPrices: AiPrices,
} as const;
export type PlatformSettingKey = keyof typeof SECTIONS;
export const PLATFORM_SETTING_KEYS = Object.keys(SECTIONS) as PlatformSettingKey[];

/** All platform settings, each section falling back to its default when unset or unreadable. */
export async function getPlatformSettings(): Promise<PlatformSettings> {
  if (settingsCache && Date.now() - settingsCache.at < TTL_MS) return settingsCache.value;
  const rows = await db.select().from(platformSettings).where(inArray(platformSettings.key, PLATFORM_SETTING_KEYS));
  const value: PlatformSettings = { ...DEFAULT_PLATFORM_SETTINGS };
  for (const row of rows) {
    const key = row.key as PlatformSettingKey;
    const parsed = SECTIONS[key].safeParse(row.value);
    if (parsed.success) Object.assign(value, { [key]: parsed.data });
  }
  settingsCache = { at: Date.now(), value };
  return value;
}

export function invalidatePlatformSettings(): void {
  settingsCache = null;
  notifyListeners(null);
}

/** Tests: forget everything cached (the database is truncated between tests). */
export function resetPlatformStateCache(): void {
  institutionCache.clear();
  settingsCache = null;
}

/** Banner and maintenance message shown to school users and on the login pages. */
export async function platformNotice(): Promise<PlatformNotice> {
  const { banner, maintenance } = await getPlatformSettings();
  return {
    banner: banner.enabled && banner.message ? { message: banner.message, level: banner.level } : null,
    maintenance: maintenance.enabled
      ? { message: maintenance.message || 'ClassIQ is undergoing maintenance.', blockLogins: maintenance.blockLogins }
      : null,
  };
}

export const SCHOOL_SUSPENDED_MESSAGE = "Your school's access is paused. Contact support.";

export const schoolSuspended = () => new AppError('SCHOOL_SUSPENDED', SCHOOL_SUSPENDED_MESSAGE);

/** Throws 503 MAINTENANCE while the platform blocks school sign-ins and requests. */
export async function assertNotInMaintenance(): Promise<void> {
  const { maintenance } = await platformNotice();
  if (maintenance?.blockLogins) throw new AppError('MAINTENANCE', maintenance.message);
}

/** Throws 403 SCHOOL_SUSPENDED for a suspended (or vanished) school. */
export async function assertSchoolActive(institutionId: string): Promise<InstitutionState> {
  const state = await institutionState(institutionId);
  if (!state || state.status !== 'active') throw schoolSuspended();
  return state;
}

/**
 * Seat limits: throws 409 when adding `adding` more teachers/students would exceed the school's
 * maxTeachers/maxStudents. Disabled accounts count too (they can be re-enabled).
 */
export async function assertSeatsAvailable(institutionId: string, role: 'teacher' | 'student', adding: number): Promise<void> {
  if (adding <= 0) return;
  const state = await institutionState(institutionId);
  const max = role === 'teacher' ? state?.limits.maxTeachers : state?.limits.maxStudents;
  if (max === null || max === undefined) return;
  const [row] = await db
    .select({ n: count() })
    .from(users)
    .where(and(eq(users.institutionId, institutionId), eq(users.role, role)));
  const existing = row?.n ?? 0;
  if (existing + adding > max) {
    const noun = role === 'teacher' ? 'teachers' : 'students';
    const left = Math.max(0, max - existing);
    throw conflict(
      `Your school's plan allows ${max} ${noun} and ${existing} already exist` +
        (left > 0 ? `, so only ${left} more can be added.` : '. Contact support to raise the limit.'),
    );
  }
}
