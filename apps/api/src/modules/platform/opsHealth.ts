/**
 * Platform health aggregator: one call checks every dependency, each check bounded by a timeout
 * so a hung component cannot hang the page. Also computes alerts, the 5-minute snapshot stored in
 * health_snapshots, and the manual AI-provider connectivity tests.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { asc, gte, sql } from 'drizzle-orm';
import {
  OPS_QUEUE_NAMES,
  type HealthHistory,
  type OpsAlert,
  type OpsApiProcessHealth,
  type OpsBackupHealth,
  type OpsDatabaseHealth,
  type OpsDevicesHealth,
  type OpsEmailHealth,
  type OpsProviderHealth,
  type OpsProviderName,
  type OpsQueueHealth,
  type OpsRedisHealth,
  type OpsStatus,
  type OpsStorageHealth,
  type OpsWorkerHealth,
  type PlatformHealth,
  type ProviderTestResult,
} from '@classiq/shared';
import { env, isProd } from '../../config/env.js';
import { db } from '../../db/client.js';
import { healthSnapshots } from '../../db/schema/index.js';
import { emailEnabled } from '../../lib/mailer.js';
import { storage } from '../../lib/storage.js';
import { getRedis } from '../../lib/redis.js';
import { queueCounts } from './opsQueues.js';
import { clientIpWarning } from '../../lib/clientIp.js';
import { runningVersion } from './opsDeployments.js';

export const WORKER_HEARTBEAT_KEY = 'cp:worker:heartbeat';
const CHECK_TIMEOUT_MS = 5_000;
const WORKER_STALE_SEC = 60;
const BACKUP_STALE_HOURS = 26;
const DISK_ALERT_PERCENT = 85;

/* ------------------------------ Helpers --------------------------------- */

function withTimeout<T>(p: Promise<T>, ms = CHECK_TIMEOUT_MS): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  return Promise.race([
    p.finally(() => clearTimeout(timer)),
    new Promise<T>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`timed out after ${ms} ms`)), ms);
    }),
  ]);
}

const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const iso = (v: unknown): string | null => {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

export function formatBytes(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

async function rows<T>(query: ReturnType<typeof sql>): Promise<T[]> {
  const res = await db.execute(query);
  return res.rows as T[];
}

const reason = (err: unknown) => (err instanceof Error ? err.message.split('\n')[0]!.slice(0, 200) : 'check failed');

/* ------------------------------ Checks ---------------------------------- */

export async function checkDatabase(opts: { cheap?: boolean } = {}): Promise<OpsDatabaseHealth> {
  try {
    const started = performance.now();
    await withTimeout(db.execute(sql`select 1`));
    const latencyMs = Math.round(performance.now() - started);
    const [meta] = await withTimeout(
      rows<{ size: string; active: number; total: number }>(sql`
        select pg_database_size(current_database())::bigint as size,
               (select count(*)::int from pg_stat_activity where datname = current_database() and state = 'active') as active,
               (select count(*)::int from pg_stat_activity where datname = current_database()) as total`),
    );
    const tables = opts.cheap
      ? []
      : (
          await withTimeout(
            rows<{ name: string; bytes: string; rows: string }>(sql`
              select c.relname as name, pg_total_relation_size(c.oid)::bigint as bytes, greatest(c.reltuples, 0)::bigint as rows
              from pg_class c join pg_namespace n on n.oid = c.relnamespace
              where n.nspname = 'public' and c.relkind = 'r'
              order by pg_total_relation_size(c.oid) desc
              limit 8`),
          )
        ).map((t) => ({ name: t.name, totalBytes: num(t.bytes), rows: num(t.rows) }));
    const sizeBytes = meta ? num(meta.size) : null;
    return {
      status: latencyMs > 500 ? 'degraded' : 'ok',
      detail: `${latencyMs} ms · ${formatBytes(sizeBytes)} · ${meta?.active ?? 0} active connections`,
      latencyMs,
      sizeBytes,
      activeConnections: meta?.active ?? null,
      totalConnections: meta?.total ?? null,
      tables,
    };
  } catch (err) {
    return { status: 'down', detail: `Database unreachable: ${reason(err)}`, latencyMs: null, sizeBytes: null, activeConnections: null, totalConnections: null, tables: [] };
  }
}

export async function checkRedis(): Promise<OpsRedisHealth> {
  const redis = getRedis();
  if (!redis) {
    return {
      status: isProd ? 'down' : 'unknown',
      detail: 'Redis is not configured (jobs run inside the API process)',
      configured: false,
      latencyMs: null,
      usedMemoryHuman: null,
    };
  }
  try {
    const started = performance.now();
    await withTimeout(redis.ping());
    const latencyMs = Math.round(performance.now() - started);
    const info = await withTimeout(redis.info('memory'));
    const usedMemoryHuman = /used_memory_human:(\S+)/.exec(info)?.[1] ?? null;
    return {
      status: latencyMs > 200 ? 'degraded' : 'ok',
      detail: `${latencyMs} ms${usedMemoryHuman ? ` · ${usedMemoryHuman} used` : ''}`,
      configured: true,
      latencyMs,
      usedMemoryHuman,
    };
  } catch (err) {
    return { status: 'down', detail: `Redis unreachable: ${reason(err)}`, configured: true, latencyMs: null, usedMemoryHuman: null };
  }
}

export async function checkQueues(): Promise<OpsQueueHealth[] | null> {
  if (!getRedis()) return null;
  return Promise.all(
    OPS_QUEUE_NAMES.map(async (name): Promise<OpsQueueHealth> => {
      try {
        const counts = await withTimeout(queueCounts(name));
        if (!counts) return { name, status: 'unknown', detail: 'Redis is not configured', counts: null };
        const status: OpsStatus = counts.failed > 0 ? 'degraded' : 'ok';
        return {
          name,
          status,
          detail: `${counts.waiting} waiting · ${counts.active} active · ${counts.failed} failed`,
          counts,
        };
      } catch (err) {
        return { name, status: 'down', detail: `Queue unavailable: ${reason(err)}`, counts: null };
      }
    }),
  );
}

export async function checkWorker(): Promise<OpsWorkerHealth> {
  const redis = getRedis();
  const empty = { heartbeatAgeSec: null, pid: null, startedAt: null, version: null };
  if (!redis) return { status: 'unknown', detail: 'No separate worker: jobs run inside the API process', ...empty };
  try {
    const raw = await withTimeout(redis.get(WORKER_HEARTBEAT_KEY));
    if (!raw) return { status: 'down', detail: 'No heartbeat from the worker in the last minute', ...empty };
    const hb = JSON.parse(raw) as { pid?: number; startedAt?: string; at?: string; version?: string };
    const at = hb.at ? Date.parse(hb.at) : NaN;
    const age = Number.isNaN(at) ? null : Math.max(0, Math.round((Date.now() - at) / 1000));
    const stale = age === null || age > WORKER_STALE_SEC;
    return {
      status: stale ? 'down' : 'ok',
      detail: stale ? 'Worker heartbeat is stale' : `Heartbeat ${age}s ago · ${(hb.version ?? 'dev').slice(0, 7)}`,
      heartbeatAgeSec: age,
      pid: typeof hb.pid === 'number' ? hb.pid : null,
      startedAt: iso(hb.startedAt),
      version: typeof hb.version === 'string' ? hb.version.slice(0, 40) : null,
    };
  } catch (err) {
    return { status: 'down', detail: `Cannot read the worker heartbeat: ${reason(err)}`, ...empty };
  }
}

export function checkApiProcess(): OpsApiProcessHealth {
  const mem = process.memoryUsage();
  const uptimeSec = Math.round(process.uptime());
  return {
    status: 'ok',
    detail: `Up ${Math.floor(uptimeSec / 3600)} h ${Math.floor((uptimeSec % 3600) / 60)} min · ${formatBytes(mem.rss)} RSS`,
    uptimeSec,
    rssBytes: mem.rss,
    heapUsedBytes: mem.heapUsed,
    nodeVersion: process.version,
    version: runningVersion(),
    pid: process.pid,
  };
}

export async function checkStorage(): Promise<OpsStorageHealth> {
  let totalBytes: number | null = null;
  let freeBytes: number | null = null;
  let usedPercent: number | null = null;
  // S3 (Garage): the bucket must answer. Its data sits on this host's disk, so the disk figures below
  // come from TMP_DIR (same disk); with the local driver they come from STORAGE_DIR.
  let bucket: { ok: true; latencyMs: number } | { ok: false; error: string } | null = null;
  if (storage.driver === 's3') {
    const started = Date.now();
    try {
      await withTimeout(storage.checkReady());
      bucket = { ok: true, latencyMs: Date.now() - started };
    } catch (err) {
      bucket = { ok: false, error: reason(err) };
    }
  }
  try {
    const st = await withTimeout(fs.statfs(storage.driver === 's3' ? env.TMP_DIR : path.resolve(env.STORAGE_DIR)));
    totalBytes = st.blocks * st.bsize;
    freeBytes = st.bavail * st.bsize;
    usedPercent = totalBytes > 0 ? Math.round(((totalBytes - freeBytes) / totalBytes) * 1000) / 10 : null;
  } catch {
    /* statfs unavailable: reported as unknown below */
  }
  let audioBytes = 0;
  let submissionBytes = 0;
  try {
    const [r] = await withTimeout(
      rows<{ audio: string; submissions: string }>(sql`
        select (select coalesce(sum(audio_size_bytes), 0) from lessons)::bigint as audio,
               (select coalesce(sum(size_bytes), 0) from submission_files)::bigint as submissions`),
    );
    audioBytes = num(r?.audio);
    submissionBytes = num(r?.submissions);
  } catch {
    /* the database check reports database problems */
  }
  const diskStatus: OpsStatus =
    usedPercent === null ? 'unknown' : usedPercent > 95 ? 'down' : usedPercent > DISK_ALERT_PERCENT ? 'degraded' : 'ok';
  const disk =
    usedPercent === null
      ? 'Disk usage unavailable'
      : `${usedPercent}% used · ${formatBytes(freeBytes)} free of ${formatBytes(totalBytes)}`;
  let status = diskStatus;
  let detail = disk;
  if (bucket && !bucket.ok) {
    status = 'down';
    detail = `Object storage unreachable: ${bucket.error}`;
  } else if (bucket?.ok) {
    detail = `Object storage OK (${bucket.latencyMs} ms) · ${disk}`;
  }
  return {
    status,
    detail,
    totalBytes,
    freeBytes,
    usedPercent,
    audioBytes,
    submissionBytes,
  };
}

export async function checkProviders(): Promise<OpsProviderHealth[]> {
  let stats: { provider: string; last_success: unknown; last_failure: unknown; last_error: string | null; failures: number }[] = [];
  try {
    stats = await withTimeout(
      rows(sql`
        select provider,
               max(at) filter (where ok) as last_success,
               max(at) filter (where not ok) as last_failure,
               (array_agg(error_code order by at desc) filter (where not ok))[1] as last_error,
               (count(*) filter (where not ok and at > now() - interval '1 hour'))::int as failures
        from ai_usage
        where at > now() - interval '30 days'
        group by provider`),
    );
  } catch {
    /* keep going with configuration flags only */
  }
  const configured: Record<OpsProviderName, boolean> = { openai: Boolean(env.OPENAI_API_KEY), sarvam: Boolean(env.SARVAM_API_KEY) };
  return (['openai', 'sarvam'] as const).map((provider): OpsProviderHealth => {
    const s = stats.find((r) => r.provider === provider);
    const lastSuccessAt = iso(s?.last_success);
    const lastFailureAt = iso(s?.last_failure);
    const failuresLastHour = num(s?.failures);
    const failingNow = failuresLastHour > 0 && (!lastSuccessAt || (lastFailureAt !== null && lastFailureAt > lastSuccessAt));
    const status: OpsStatus = !configured[provider] ? 'unknown' : failingNow ? 'degraded' : 'ok';
    return {
      provider,
      configured: configured[provider],
      status,
      detail: !configured[provider]
        ? 'API key not configured'
        : failuresLastHour > 0
          ? `${failuresLastHour} failed call${failuresLastHour === 1 ? '' : 's'} in the last hour`
          : lastSuccessAt
            ? 'Recent calls succeeded'
            : 'No calls recorded yet',
      lastSuccessAt,
      lastFailureAt,
      lastErrorCode: s?.last_error ?? null,
      failuresLastHour,
    };
  });
}

export async function checkEmail(): Promise<OpsEmailHealth> {
  const configured = emailEnabled();
  let sent = 0;
  let failed = 0;
  let invitesSent = 0;
  let invitesFailed = 0;
  try {
    const [r] = await withTimeout(
      rows<{ sent: number; failed: number; inv_sent: number; inv_failed: number }>(sql`
        select (select count(*) from email_log where at > now() - interval '24 hours' and status = 'sent')::int as sent,
               (select count(*) from email_log where at > now() - interval '24 hours' and status = 'failed')::int as failed,
               (select count(*) from password_tokens where email_status = 'sent' and email_sent_at > now() - interval '24 hours')::int as inv_sent,
               (select count(*) from password_tokens where email_status = 'failed' and created_at > now() - interval '24 hours')::int as inv_failed`),
    );
    sent = num(r?.sent);
    failed = num(r?.failed);
    invitesSent = num(r?.inv_sent);
    invitesFailed = num(r?.inv_failed);
  } catch {
    /* counts stay 0 */
  }
  const anyFailed = failed + invitesFailed;
  return {
    status: !configured ? 'unknown' : anyFailed > 0 ? 'degraded' : 'ok',
    detail: !configured
      ? 'Email is not configured — admins hand over one-time passwords'
      : `${Math.max(sent, invitesSent)} sent · ${Math.max(failed, invitesFailed)} failed in 24 h`,
    configured,
    sentLast24h: sent,
    failedLast24h: failed,
    invitesSentLast24h: invitesSent,
    invitesFailedLast24h: invitesFailed,
  };
}

export async function checkDevices(): Promise<OpsDevicesHealth> {
  try {
    const [r] = await withTimeout(
      rows<{ total: number; online: number; offline: number; recording: number; error: number }>(sql`
        select count(*)::int as total,
               (count(*) filter (where status = 'online'))::int as online,
               (count(*) filter (where status = 'offline'))::int as offline,
               (count(*) filter (where status = 'recording'))::int as recording,
               (count(*) filter (where status = 'error'))::int as error
        from devices where revoked_at is null`),
    );
    const total = num(r?.total);
    const down = num(r?.offline) + num(r?.error);
    const status: OpsStatus = total > 0 && down / total > 0.5 ? 'degraded' : 'ok';
    return {
      status,
      detail: total === 0 ? 'No classroom devices registered' : `${num(r?.online) + num(r?.recording)} of ${total} online`,
      total,
      online: num(r?.online),
      offline: num(r?.offline),
      recording: num(r?.recording),
      error: num(r?.error),
    };
  } catch (err) {
    return { status: 'unknown', detail: `Device counts unavailable: ${reason(err)}`, total: 0, online: 0, offline: 0, recording: 0, error: 0 };
  }
}

async function listBackups(dir: string): Promise<{ name: string; size: number; mtime: Date }[]> {
  const names = await fs.readdir(dir).catch(() => [] as string[]);
  const files = await Promise.all(
    names
      .filter((n) => n.endsWith('.tar.age'))
      .map(async (name) => {
        const st = await fs.stat(path.join(dir, name)).catch(() => null);
        return st?.isFile() ? { name, size: st.size, mtime: st.mtime } : null;
      }),
  );
  return files.filter((f): f is { name: string; size: number; mtime: Date } => f !== null);
}

export async function checkBackups(): Promise<OpsBackupHealth> {
  const root = path.resolve(env.BACKUP_DIR);
  const mounted = await fs
    .stat(root)
    .then((s) => s.isDirectory())
    .catch(() => false);
  if (!mounted) {
    return {
      status: 'unknown',
      detail: `Backup folder ${env.BACKUP_DIR} is not mounted in the API container`,
      mounted: false,
      latestFile: null,
      latestSizeBytes: null,
      latestAt: null,
      ageHours: null,
      dailyCount: 0,
      weeklyCount: 0,
    };
  }
  const [daily, weekly] = await Promise.all([listBackups(path.join(root, 'daily')), listBackups(path.join(root, 'weekly'))]);
  const latest = daily.sort((a, b) => b.mtime.getTime() - a.mtime.getTime())[0];
  if (!latest) {
    return {
      status: 'down',
      detail: 'No daily backup found',
      mounted: true,
      latestFile: null,
      latestSizeBytes: null,
      latestAt: null,
      ageHours: null,
      dailyCount: 0,
      weeklyCount: weekly.length,
    };
  }
  const ageHours = Math.round(((Date.now() - latest.mtime.getTime()) / 3600_000) * 10) / 10;
  return {
    status: ageHours > BACKUP_STALE_HOURS ? 'degraded' : 'ok',
    detail: `Latest ${latest.name} · ${formatBytes(latest.size)} · ${ageHours} h ago`,
    mounted: true,
    latestFile: latest.name,
    latestSizeBytes: latest.size,
    latestAt: latest.mtime.toISOString(),
    ageHours,
    dailyCount: daily.length,
    weeklyCount: weekly.length,
  };
}

/* ------------------------------ Alerts ---------------------------------- */

const COMPONENT_LABELS: Record<string, string> = {
  database: 'Database',
  redis: 'Redis',
  worker: 'Worker',
  storage: 'Storage',
  email: 'Email',
  devices: 'Devices',
  backups: 'Backups',
};

export function computeAlerts(h: Omit<PlatformHealth, 'status' | 'alerts' | 'checkedAt'>): OpsAlert[] {
  const alerts: OpsAlert[] = [];
  const named: [string, { status: OpsStatus; detail: string }][] = [
    ['database', h.database],
    ['redis', h.redis],
    ['worker', h.worker],
    ['storage', h.storage],
    ['email', h.email],
    ['devices', h.devices],
    ['backups', h.backups],
  ];
  for (const [key, c] of named) {
    if (c.status === 'down') {
      alerts.push({ id: `${key}-down`, severity: 'critical', component: key, message: `${COMPONENT_LABELS[key]} is down: ${c.detail}` });
    }
  }
  for (const q of h.queues ?? []) {
    if (q.status === 'down') alerts.push({ id: `queue-${q.name}-down`, severity: 'critical', component: `queue:${q.name}`, message: `Queue ${q.name} is unavailable` });
    if (q.counts && q.counts.failed > 0) {
      alerts.push({
        id: `queue-${q.name}-failed`,
        severity: 'warning',
        component: `queue:${q.name}`,
        message: `${q.counts.failed} failed job${q.counts.failed === 1 ? '' : 's'} in the ${q.name} queue`,
      });
    }
  }
  if (h.backups.mounted && h.backups.status === 'degraded') {
    alerts.push({ id: 'backup-stale', severity: 'warning', component: 'backups', message: `The latest backup is ${h.backups.ageHours} h old (over ${BACKUP_STALE_HOURS} h)` });
  }
  if (!h.backups.mounted && isProd) {
    alerts.push({ id: 'backup-missing', severity: 'warning', component: 'backups', message: 'The backup folder is not mounted, so backups cannot be checked' });
  }
  const ipWarning = clientIpWarning();
  if (ipWarning) {
    alerts.push({ id: 'client-ip', severity: 'warning', component: 'proxy', message: ipWarning });
  }
  if (h.storage.usedPercent !== null && h.storage.usedPercent > DISK_ALERT_PERCENT) {
    alerts.push({ id: 'disk-full', severity: h.storage.usedPercent > 95 ? 'critical' : 'warning', component: 'storage', message: `Disk is ${h.storage.usedPercent}% full` });
  }
  for (const p of h.providers) {
    if (p.failuresLastHour > 0) {
      alerts.push({
        id: `provider-${p.provider}-failing`,
        severity: 'warning',
        component: `provider:${p.provider}`,
        message: `${p.provider === 'openai' ? 'OpenAI' : 'Sarvam'}: ${p.failuresLastHour} failed call${p.failuresLastHour === 1 ? '' : 's'} in the last hour${p.lastErrorCode ? ` (${p.lastErrorCode})` : ''}`,
      });
    }
  }
  if (h.devices.total > 0 && h.devices.status === 'degraded') {
    alerts.push({
      id: 'devices-offline',
      severity: 'warning',
      component: 'devices',
      message: `${h.devices.offline + h.devices.error} of ${h.devices.total} classroom devices are offline`,
    });
  }
  return alerts;
}

function overall(h: Omit<PlatformHealth, 'status' | 'alerts' | 'checkedAt'>): PlatformHealth['status'] {
  if (h.database.status === 'down' || (h.redis.configured && h.redis.status === 'down')) return 'down';
  const statuses: OpsStatus[] = [
    h.database.status,
    h.redis.status,
    h.worker.status,
    h.api.status,
    h.storage.status,
    h.email.status,
    h.devices.status,
    h.backups.status,
    ...(h.queues ?? []).map((q) => q.status),
    ...h.providers.map((p) => p.status),
  ];
  return statuses.some((s) => s === 'down' || s === 'degraded') ? 'degraded' : 'ok';
}

/* ---------------------------- Aggregator -------------------------------- */

export async function platformHealth(opts: { cheap?: boolean } = {}): Promise<PlatformHealth> {
  const [database, redis, queues, worker, storage, providers, email, devices, backups] = await Promise.all([
    checkDatabase(opts),
    checkRedis(),
    checkQueues(),
    checkWorker(),
    checkStorage(),
    checkProviders(),
    checkEmail(),
    checkDevices(),
    checkBackups(),
  ]);
  const parts = { database, redis, queues, worker, api: checkApiProcess(), storage, providers, email, devices, backups };
  return { status: overall(parts), checkedAt: new Date().toISOString(), alerts: computeAlerts(parts), ...parts };
}

/* ---------------------------- Snapshots --------------------------------- */

/** Compact form stored every 5 minutes. */
export function snapshotChecks(h: PlatformHealth): Record<string, unknown> {
  const statuses: Record<string, OpsStatus> = {
    database: h.database.status,
    redis: h.redis.status,
    worker: h.worker.status,
    storage: h.storage.status,
    email: h.email.status,
    devices: h.devices.status,
    backups: h.backups.status,
  };
  for (const q of h.queues ?? []) statuses[`queue:${q.name}`] = q.status;
  for (const p of h.providers) statuses[`provider:${p.provider}`] = p.status;
  return {
    statuses,
    dbLatencyMs: h.database.latencyMs,
    redisLatencyMs: h.redis.latencyMs,
    diskUsedPercent: h.storage.usedPercent,
    failedJobs: h.queues ? h.queues.reduce((s, q) => s + (q.counts?.failed ?? 0), 0) : null,
    backupAgeHours: h.backups.ageHours,
    alerts: h.alerts.map((a) => a.id),
  };
}

export async function takeHealthSnapshot(): Promise<void> {
  const h = await platformHealth({ cheap: true });
  await db.insert(healthSnapshots).values({ status: h.status, checks: snapshotChecks(h) });
}

export async function pruneHealthSnapshots(days = 30): Promise<number> {
  const res = await db.execute(sql`delete from health_snapshots where at < now() - make_interval(days => ${days})`);
  return res.rowCount ?? 0;
}

export async function healthHistory(hours: number): Promise<HealthHistory> {
  const since = new Date(Date.now() - hours * 3600_000);
  const rowsAll = await db
    .select()
    .from(healthSnapshots)
    .where(gte(healthSnapshots.at, since))
    .orderBy(asc(healthSnapshots.at))
    .limit(24 * 12 * 30);
  const points = rowsAll.map((r) => {
    const c = (r.checks ?? {}) as {
      statuses?: Record<string, OpsStatus>;
      dbLatencyMs?: number | null;
      redisLatencyMs?: number | null;
      diskUsedPercent?: number | null;
      failedJobs?: number | null;
    };
    return {
      at: r.at.toISOString(),
      status: r.status,
      dbLatencyMs: c.dbLatencyMs ?? null,
      redisLatencyMs: c.redisLatencyMs ?? null,
      diskUsedPercent: c.diskUsedPercent ?? null,
      failedJobs: c.failedJobs ?? null,
      statuses: c.statuses ?? {},
    };
  });
  const uptimePercent = points.length
    ? Math.round((points.filter((p) => p.status === 'ok').length / points.length) * 1000) / 10
    : null;
  return { hours, uptimePercent, points };
}

/* -------------------------- Provider tests ------------------------------ */

const TEST_TIMEOUT_MS = 10_000;

async function probe(provider: OpsProviderName, url: string, init: RequestInit): Promise<ProviderTestResult> {
  const started = performance.now();
  try {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(TEST_TIMEOUT_MS) });
    const latencyMs = Math.round(performance.now() - started);
    // The body is never echoed: providers can quote part of the key in error messages.
    await res.body?.cancel().catch(() => undefined);
    const ok = res.status >= 200 && res.status < 300;
    const message = ok
      ? 'Connected — the API key was accepted'
      : res.status === 401 || res.status === 403
        ? `The provider rejected the API key (HTTP ${res.status})`
        : res.status === 429
          ? 'Rate limited or out of credit (HTTP 429)'
          : `Unexpected response (HTTP ${res.status})`;
    return { provider, configured: true, ok, latencyMs, httpStatus: res.status, message };
  } catch (err) {
    const timedOut = (err as Error)?.name === 'TimeoutError' || (err as Error)?.name === 'AbortError';
    return {
      provider,
      configured: true,
      ok: false,
      latencyMs: null,
      httpStatus: null,
      message: timedOut ? 'No answer within 10 seconds' : 'Cannot reach the provider',
    };
  }
}

export async function testProvider(provider: OpsProviderName): Promise<ProviderTestResult> {
  if (provider === 'openai') {
    if (!env.OPENAI_API_KEY) return { provider, configured: false, ok: false, latencyMs: null, httpStatus: null, message: 'OPENAI_API_KEY is not set' };
    return probe(provider, `${env.OPENAI_BASE_URL.replace(/\/+$/, '')}/models`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}` },
    });
  }
  if (!env.SARVAM_API_KEY) return { provider, configured: false, ok: false, latencyMs: null, httpStatus: null, message: 'SARVAM_API_KEY is not set' };
  // Creating a batch job verifies the key without sending audio; the empty job simply expires.
  return probe(provider, `${env.SARVAM_BASE_URL.replace(/\/+$/, '')}/speech-to-text/job/v1`, {
    method: 'POST',
    headers: { 'api-subscription-key': env.SARVAM_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ job_parameters: { language_code: 'unknown', model: 'saarika:v2.5', with_timestamps: false } }),
  });
}
