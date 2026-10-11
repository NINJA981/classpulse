import { z } from 'zod';

/* ----------------------------------------------------------------------------
 * Platform console: logs, health, queues, audit and deployments (ops module).
 * ------------------------------------------------------------------------- */

export const OpsStatus = z.enum(['ok', 'degraded', 'down', 'unknown']);
export type OpsStatus = z.infer<typeof OpsStatus>;

export const OPS_QUEUE_NAMES = ['lesson-generation', 'email', 'resources'] as const;
export const OpsQueueName = z.enum(OPS_QUEUE_NAMES);
export type OpsQueueName = z.infer<typeof OpsQueueName>;

/* ----------------------------- Health ----------------------------------- */

export interface OpsComponentBase {
  status: OpsStatus;
  /** One human-readable line, e.g. "12 ms · 48 MB". */
  detail: string;
}

export interface OpsTableSize {
  name: string;
  totalBytes: number;
  rows: number;
}

export interface OpsDatabaseHealth extends OpsComponentBase {
  latencyMs: number | null;
  sizeBytes: number | null;
  activeConnections: number | null;
  totalConnections: number | null;
  tables: OpsTableSize[];
}

export interface OpsRedisHealth extends OpsComponentBase {
  configured: boolean;
  latencyMs: number | null;
  usedMemoryHuman: string | null;
}

export interface OpsQueueCounts {
  waiting: number;
  active: number;
  delayed: number;
  failed: number;
  completed: number;
}

export interface OpsQueueHealth extends OpsComponentBase {
  name: OpsQueueName;
  counts: OpsQueueCounts | null;
}

export interface OpsWorkerHealth extends OpsComponentBase {
  heartbeatAgeSec: number | null;
  pid: number | null;
  startedAt: string | null;
  version: string | null;
}

export interface OpsApiProcessHealth extends OpsComponentBase {
  uptimeSec: number;
  rssBytes: number;
  heapUsedBytes: number;
  nodeVersion: string;
  version: string;
  pid: number;
}

export interface OpsStorageHealth extends OpsComponentBase {
  totalBytes: number | null;
  freeBytes: number | null;
  usedPercent: number | null;
  audioBytes: number;
  submissionBytes: number;
}

export type OpsProviderName = 'openai' | 'sarvam';

export interface OpsProviderHealth extends OpsComponentBase {
  provider: OpsProviderName;
  configured: boolean;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  lastErrorCode: string | null;
  failuresLastHour: number;
}

export interface OpsEmailHealth extends OpsComponentBase {
  configured: boolean;
  sentLast24h: number;
  failedLast24h: number;
  invitesSentLast24h: number;
  invitesFailedLast24h: number;
}

export interface OpsDevicesHealth extends OpsComponentBase {
  total: number;
  online: number;
  offline: number;
  recording: number;
  error: number;
}

export interface OpsBackupHealth extends OpsComponentBase {
  /** False when the backup folder is not mounted into the API container. */
  mounted: boolean;
  latestFile: string | null;
  latestSizeBytes: number | null;
  latestAt: string | null;
  ageHours: number | null;
  dailyCount: number;
  weeklyCount: number;
}

export interface OpsAlert {
  id: string;
  severity: 'warning' | 'critical';
  component: string;
  message: string;
}

export interface PlatformHealth {
  status: Exclude<OpsStatus, 'unknown'>;
  checkedAt: string;
  alerts: OpsAlert[];
  database: OpsDatabaseHealth;
  redis: OpsRedisHealth;
  /** null when Redis is not configured (jobs run inside the API process). */
  queues: OpsQueueHealth[] | null;
  worker: OpsWorkerHealth;
  api: OpsApiProcessHealth;
  storage: OpsStorageHealth;
  providers: OpsProviderHealth[];
  email: OpsEmailHealth;
  devices: OpsDevicesHealth;
  backups: OpsBackupHealth;
}

export interface HealthHistoryPoint {
  at: string;
  status: string;
  dbLatencyMs: number | null;
  redisLatencyMs: number | null;
  diskUsedPercent: number | null;
  failedJobs: number | null;
  statuses: Record<string, OpsStatus>;
}

export interface HealthHistory {
  hours: number;
  /** Share of snapshots with overall status "ok" (0–100), null when there are none. */
  uptimePercent: number | null;
  points: HealthHistoryPoint[];
}

export const HealthHistoryQuery = z.object({
  hours: z.coerce.number().int().min(1).max(24 * 30).default(24),
});

export interface ProviderTestResult {
  provider: OpsProviderName;
  configured: boolean;
  ok: boolean;
  latencyMs: number | null;
  httpStatus: number | null;
  message: string;
}

/* ----------------------------- Queues ----------------------------------- */

export interface FailedJob {
  id: string;
  name: string;
  failedReason: string;
  attemptsMade: number;
  createdAt: string | null;
  processedAt: string | null;
  finishedAt: string | null;
  /** Short, non-sensitive summary of the job data (never email bodies). */
  summary: Record<string, string | number | null>;
}

export const FailedJobsQuery = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const QueueJobParams = z.object({
  name: OpsQueueName,
  id: z.string().min(1).max(200),
});

export const QueueParams = z.object({ name: OpsQueueName });

/* ------------------------------ Logs ------------------------------------ */

export const LOG_LEVELS = { trace: 10, debug: 20, info: 30, warn: 40, error: 50, fatal: 60 } as const;
export const LogLevelName = z.enum(['info', 'warn', 'error', 'fatal']);
export type LogLevelName = z.infer<typeof LogLevelName>;

export interface AppLogLine {
  id: number;
  at: string;
  level: number;
  levelName: string;
  service: string;
  msg: string;
  reqId: string | null;
  institutionId: string | null;
  institutionName: string | null;
  userId: string | null;
  context: Record<string, unknown> | null;
}

export interface AppLogPage {
  items: AppLogLine[];
  /** Highest log id overall — a live tail can start after it. */
  latestId: number | null;
}

const isoDate = z.iso.datetime({ offset: true });

export const LogsQuery = z.object({
  after: z.coerce.number().int().min(0).optional(),
  before: z.coerce.number().int().min(1).optional(),
  /** Minimum level. */
  level: LogLevelName.optional(),
  service: z.string().trim().max(20).optional(),
  institutionId: z.uuid().optional(),
  q: z.string().trim().max(200).optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  limit: z.coerce.number().int().min(1).max(500).default(200),
});
export type LogsQuery = z.infer<typeof LogsQuery>;

/* ------------------------------ Audit ----------------------------------- */

export interface AuditLogEntry {
  id: number;
  at: string;
  actorType: string;
  actorId: string | null;
  actorRole: string | null;
  actorName: string | null;
  institutionId: string | null;
  institutionName: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  metadata: Record<string, unknown> | null;
  ip: string | null;
}

export interface AuditLogPage {
  items: AuditLogEntry[];
  total: number;
  page: number;
  pageSize: number;
}

export const AuditQuery = z.object({
  /** Actor name/email fragment or an actor id. */
  actor: z.string().trim().max(120).optional(),
  institutionId: z.uuid().optional(),
  /** Action prefix, e.g. "platform." or "auth.login". */
  action: z.string().trim().max(80).optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});
export type AuditQuery = z.infer<typeof AuditQuery>;

/* --------------------------- Deployments -------------------------------- */

export interface CoolifyNotConfigured {
  configured: false;
  instructions: string[];
}

export interface DeploymentSummary {
  id: string;
  status: string;
  commit: string | null;
  commitMessage: string | null;
  createdAt: string | null;
  finishedAt: string | null;
  durationSec: number | null;
}

export interface DeploymentList {
  configured: true;
  items: DeploymentSummary[];
}

export interface DeploymentLogs {
  configured: true;
  id: string;
  status: string;
  lines: { at: string | null; text: string }[];
}

export interface DeployedApp {
  configured: true;
  name: string | null;
  status: string | null;
  fqdn: string | null;
  gitBranch: string | null;
  currentCommit: string | null;
  lastOnlineAt: string | null;
  /** The commit this API process was built from (SOURCE_COMMIT). */
  runningVersion: string;
}

export interface DeployActionResult {
  configured: true;
  ok: true;
  deploymentId: string | null;
  message: string;
}

export const RedeployInput = z.object({ confirm: z.literal('REDEPLOY') });
export const RestartInput = z.object({ confirm: z.literal('RESTART') });
export const DeploymentParams = z.object({ id: z.string().trim().min(1).max(100).regex(/^[A-Za-z0-9_-]+$/) });
