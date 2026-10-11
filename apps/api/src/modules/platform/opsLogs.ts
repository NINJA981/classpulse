/** Querying and exporting the app_logs table (filled by lib/logSink.ts). */
import { and, asc, desc, eq, gt, gte, ilike, lt, lte, max, sql, type SQL } from 'drizzle-orm';
import { LOG_LEVELS, type AppLogLine, type AppLogPage, type LogsQuery } from '@classpulse/shared';
import { db } from '../../db/client.js';
import { appLogs, institutions } from '../../db/schema/index.js';
import { toCsv } from './opsCsv.js';

export const CSV_MAX_ROWS = 10_000;

const LEVEL_NAMES: Record<number, string> = Object.fromEntries(Object.entries(LOG_LEVELS).map(([k, v]) => [v, k]));
export const levelName = (n: number) => LEVEL_NAMES[n] ?? String(n);

/** Escape LIKE wildcards so user text matches literally. */
export const likeContains = (q: string) => `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

function conditions(f: Omit<LogsQuery, 'limit'>): SQL[] {
  const where: SQL[] = [];
  if (f.after !== undefined) where.push(gt(appLogs.id, f.after));
  if (f.before !== undefined) where.push(lt(appLogs.id, f.before));
  if (f.level) where.push(gte(appLogs.level, LOG_LEVELS[f.level]));
  if (f.service) where.push(eq(appLogs.service, f.service));
  if (f.institutionId) where.push(eq(appLogs.institutionId, f.institutionId));
  if (f.q) where.push(ilike(appLogs.msg, likeContains(f.q)));
  if (f.from) where.push(gte(appLogs.at, new Date(f.from)));
  if (f.to) where.push(lte(appLogs.at, new Date(f.to)));
  return where;
}

async function select(f: Omit<LogsQuery, 'limit'>, limit: number): Promise<AppLogLine[]> {
  // `after` is a live tail: oldest first so the client can append. Otherwise newest first.
  const order = f.after !== undefined ? asc(appLogs.id) : desc(appLogs.id);
  const rows = await db
    .select({ log: appLogs, institutionName: institutions.name })
    .from(appLogs)
    .leftJoin(institutions, eq(institutions.id, appLogs.institutionId))
    .where(and(...conditions(f)))
    .orderBy(order)
    .limit(limit);
  return rows.map(({ log, institutionName }) => ({
    id: log.id,
    at: log.at.toISOString(),
    level: log.level,
    levelName: levelName(log.level),
    service: log.service,
    msg: log.msg,
    reqId: log.reqId,
    institutionId: log.institutionId,
    institutionName: institutionName ?? null,
    userId: log.userId,
    context: log.context ?? null,
  }));
}

export async function listLogs(f: LogsQuery): Promise<AppLogPage> {
  const [items, [latest]] = await Promise.all([select(f, f.limit), db.select({ id: max(appLogs.id) }).from(appLogs)]);
  return { items, latestId: latest?.id ?? null };
}

export async function logsCsv(f: LogsQuery): Promise<string> {
  const items = await select({ ...f, after: undefined }, CSV_MAX_ROWS);
  return toCsv([
    ['id', 'at', 'level', 'service', 'school', 'institution_id', 'user_id', 'request_id', 'message', 'context'],
    ...items.map((l) => [
      l.id,
      l.at,
      l.levelName,
      l.service,
      l.institutionName,
      l.institutionId,
      l.userId,
      l.reqId,
      l.msg,
      l.context ? JSON.stringify(l.context) : null,
    ]),
  ]);
}

/** Delete rows older than `days` in batches (keeps each statement short). */
export async function purgeOldLogs(days = 14, batch = 5000): Promise<number> {
  const cutoff = new Date(Date.now() - days * 86400_000);
  let total = 0;
  for (;;) {
    const res = await db.execute(
      sql`delete from app_logs where id in (select id from app_logs where at < ${cutoff} order by at limit ${batch})`,
    );
    const n = res.rowCount ?? 0;
    total += n;
    if (n < batch) break;
  }
  return total;
}
