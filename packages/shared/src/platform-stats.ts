/** Platform console: usage and AI-cost statistics DTOs (owned by the stats module). */
import { z } from 'zod';
import { Id } from './common.js';
import type { InstitutionStatus } from './platform.js';

/* ----------------------------------------------------------------------------
 * Query
 * ------------------------------------------------------------------------- */

/** Days are counted in this time zone (where the schools are). */
export const STATS_TIME_ZONE = 'Asia/Kolkata';
/** Longest range one request may cover. */
export const STATS_MAX_RANGE_DAYS = 366;

export const StatsGranularity = z.enum(['day', 'week']);
export type StatsGranularity = z.infer<typeof StatsGranularity>;

const DateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date like 2026-10-01');

/** GET /api/platform/stats — `from`/`to` are inclusive dates (default: the last 30 days). */
export const PlatformStatsQuery = z.object({
  from: DateOnly.optional(),
  to: DateOnly.optional(),
  institutionId: Id.optional(),
  granularity: StatsGranularity.default('day'),
});
export type PlatformStatsQuery = z.infer<typeof PlatformStatsQuery>;

export const StatsCsvSection = z.enum(['activity', 'schools', 'ai']);
export type StatsCsvSection = z.infer<typeof StatsCsvSection>;

/** GET /api/platform/stats/export.csv — same filters, plus which table to export. */
export const PlatformStatsCsvQuery = PlatformStatsQuery.extend({ section: StatsCsvSection.default('activity') });
export type PlatformStatsCsvQuery = z.infer<typeof PlatformStatsCsvQuery>;

/* ----------------------------------------------------------------------------
 * Response
 * ------------------------------------------------------------------------- */

export const AI_USAGE_KINDS = ['stt', 'quiz', 'questions', 'remedial', 'grading', 'resource', 'voice'] as const;
export type AiUsageKind = (typeof AI_USAGE_KINDS)[number];

export const AI_USAGE_KIND_LABELS: Record<AiUsageKind, string> = {
  stt: 'Speech-to-text',
  quiz: 'Quiz generation',
  questions: 'More questions',
  remedial: 'Remedial plans',
  grading: 'Grading suggestions',
  resource: 'Teaching resources',
  voice: 'Voice prompts',
};

/** Shown next to every cost figure. */
export const AI_COST_NOTE = 'Estimated cost — based on the price rates in Settings; check your provider invoices.';

export interface StatsTotals {
  schools: number;
  activeSchools: number;
  suspendedSchools: number;
  admins: number;
  teachers: number;
  students: number;
  sections: number;
  /** Classroom devices that are not revoked. */
  devices: number;
}

/** Counts of things that happened in a period. */
export interface StatsActivity {
  /** Distinct users who signed in. */
  activeUsers: number;
  lessonsCreated: number;
  lessonsPublished: number;
  /** Minutes of lesson audio recorded or uploaded (lessons created in the period). */
  audioMinutes: number;
  /** Published lessons that have at least one approved question. */
  quizzesPublished: number;
  quizAttempts: number;
  liveSessions: number;
  livePlayers: number;
  examsPublished: number;
  examAttempts: number;
  assignmentsPublished: number;
  submissions: number;
  emailsSent: number;
  emailsFailed: number;
}

export interface StatsAiTotals {
  aiCalls: number;
  aiFailures: number;
  aiInputTokens: number;
  aiOutputTokens: number;
  /** Minutes of audio successfully transcribed. */
  aiAudioMinutes: number;
  /** Estimate in USD from the platform's AI price rates. */
  aiCostUsd: number;
}

export interface StatsBucket extends StatsActivity, StatsAiTotals {
  /** First day of the bucket (YYYY-MM-DD, in STATS_TIME_ZONE). */
  bucket: string;
}

export interface StatsSchoolRow extends StatsActivity, StatsAiTotals {
  institutionId: string;
  name: string;
  code: string;
  status: InstitutionStatus;
  teachers: number;
  students: number;
  /** Current lesson audio plus homework files (not limited to the date range). */
  storageBytes: number;
  /** Simple activity score: lessons + quiz attempts + live players + exam attempts + submissions. */
  activity: number;
}

export interface StatsAiRow {
  provider: string;
  model: string;
  kind: AiUsageKind;
  calls: number;
  failures: number;
  inputTokens: number;
  outputTokens: number;
  audioMinutes: number;
  costUsd: number;
  /** False when Settings has no price rate for this model (its cost counts as 0). */
  priced: boolean;
}

export interface StatsRanking {
  institutionId: string;
  name: string;
  value: number;
}

export interface PlatformStats {
  range: {
    from: string;
    to: string;
    granularity: StatsGranularity;
    timeZone: string;
    institutionId: string | null;
  };
  totals: StatsTotals;
  /** Sum over the whole range. */
  summary: StatsActivity & StatsAiTotals;
  series: StatsBucket[];
  schools: StatsSchoolRow[];
  ai: StatsAiRow[];
  rankings: { byActivity: StatsRanking[]; byAiCost: StatsRanking[] };
  costNote: string;
  currency: 'USD';
}

/** GET /api/platform/stats/overview: compact KPIs for the console's home page. */
export interface PlatformOverviewStats {
  schools: number;
  activeSchools: number;
  suspendedSchools: number;
  activeUsersToday: number;
  /** Lessons created since Monday (STATS_TIME_ZONE). */
  lessonsThisWeek: number;
  /** Estimate in USD since the 1st of this month. */
  aiCostThisMonthUsd: number;
  aiFailures24h: number;
  emailsFailed24h: number;
  /** This month's estimated AI cost per school, highest first (top 10). */
  aiCostBySchool: StatsRanking[];
  costNote: string;
  currency: 'USD';
  timeZone: string;
}
