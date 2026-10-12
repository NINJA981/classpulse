/**
 * Database sink for pino: keeps a filtered copy of log lines in `app_logs` for the platform console.
 *
 * - Receives pino's serialized JSON lines (already redacted by the logger's redact paths and error
 *   scrubbing). Query parameters and Postgres row values are scrubbed again here (lib/logScrub.ts), as a
 *   second line of defence for anything logged in an unexpected shape.
 * - Stores: level >= warn always; info from application logs; HTTP request logs (pino-http
 *   "request completed" lines with req/res/responseTime) only for non-GET requests, status >= 400
 *   or responses slower than 1 s — polling GETs would flood the table otherwise.
 * - Batches inserts (every 2 s or 200 rows), caps its in-memory buffer (excess is dropped and
 *   counted), and never throws or blocks the caller.
 *
 * It must not import the logger (the logger imports this file) and loads the database lazily so
 * that `db/client.ts` is not part of the logger's import graph.
 */
import { isTest } from '../config/env.js';
import { scrubLogValue, scrubText } from './logScrub.js';

export interface AppLogRow {
  at: Date;
  level: number;
  service: string;
  msg: string;
  reqId: string | null;
  institutionId: string | null;
  userId: string | null;
  context: Record<string, unknown> | null;
}

export interface LogSinkOptions {
  flushIntervalMs?: number;
  batchSize?: number;
  maxBuffer?: number;
  /** Override the database insert (tests). */
  insert?: (rows: AppLogRow[]) => Promise<void>;
}

export interface LogSinkStats {
  buffered: number;
  written: number;
  dropped: number;
  failedBatches: number;
}

export interface LogSink {
  /** pino destination interface. */
  write(line: string): void;
  flush(): Promise<void>;
  stats(): LogSinkStats;
  close(): Promise<void>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_MSG = 2000;
const MAX_CONTEXT_CHARS = 8000;
const SLOW_REQUEST_MS = 1000;
/** Fields that become columns (or are noise) rather than context. */
const OMIT = new Set(['level', 'time', 'msg', 'pid', 'hostname', 'service', 'institutionId', 'userId', 'v']);

type LogObject = Record<string, unknown> & {
  level?: unknown;
  time?: unknown;
  msg?: unknown;
  service?: unknown;
  req?: { id?: unknown; method?: unknown; url?: unknown };
  res?: { statusCode?: unknown };
  responseTime?: unknown;
};

const str = (v: unknown): string | null => (typeof v === 'string' && v.length > 0 ? v : typeof v === 'number' ? String(v) : null);
const uuidOrNull = (v: unknown): string | null => (typeof v === 'string' && UUID.test(v) ? v : null);

function isHttpRequestLog(o: LogObject): boolean {
  return typeof o.req === 'object' && o.req !== null && typeof o.res === 'object' && o.res !== null && 'responseTime' in o;
}

/** Whether a parsed pino line should be stored. */
export function shouldStore(o: LogObject): boolean {
  const level = typeof o.level === 'number' ? o.level : 0;
  if (level >= 40) return true;
  if (level < 30) return false;
  if (!isHttpRequestLog(o)) return true;
  const method = String(o.req?.method ?? 'GET').toUpperCase();
  const status = Number(o.res?.statusCode ?? 0);
  const ms = Number(o.responseTime ?? 0);
  return !['GET', 'HEAD', 'OPTIONS'].includes(method) || status >= 400 || ms > SLOW_REQUEST_MS;
}

/** Map a parsed pino line to an app_logs row. */
export function toRow(o: LogObject): AppLogRow {
  const level = typeof o.level === 'number' ? o.level : 30;
  let msg = str(o.msg) ?? '';
  if (isHttpRequestLog(o)) {
    const ms = Math.round(Number(o.responseTime ?? 0));
    msg = `${String(o.req?.method ?? '?')} ${String(o.req?.url ?? '?')} → ${String(o.res?.statusCode ?? '?')} (${ms} ms)`;
  }
  if (!msg) msg = '(no message)';
  msg = scrubText(msg);

  const context: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) if (!OMIT.has(k)) context[k] = scrubLogValue(v);
  let ctx: Record<string, unknown> | null = Object.keys(context).length ? context : null;
  if (ctx) {
    const json = JSON.stringify(ctx);
    if (json.length > MAX_CONTEXT_CHARS) ctx = { truncated: true, preview: json.slice(0, MAX_CONTEXT_CHARS) };
  }

  const time = typeof o.time === 'number' ? new Date(o.time) : new Date();
  return {
    at: Number.isNaN(time.getTime()) ? new Date() : time,
    level,
    service: (str(o.service) ?? 'api').slice(0, 20),
    msg: msg.slice(0, MAX_MSG),
    reqId: (str(o.reqId) ?? str(o.req?.id))?.slice(0, 100) ?? null,
    institutionId: uuidOrNull(o.institutionId),
    userId: uuidOrNull(o.userId),
    context: ctx,
  };
}

async function defaultInsert(rows: AppLogRow[]): Promise<void> {
  const [{ db }, { appLogs }] = await Promise.all([import('../db/client.js'), import('../db/schema/platform.js')]);
  await db.insert(appLogs).values(rows);
}

export function createLogSink(opts: LogSinkOptions = {}): LogSink {
  const flushIntervalMs = opts.flushIntervalMs ?? 2000;
  const batchSize = opts.batchSize ?? 200;
  const maxBuffer = opts.maxBuffer ?? 5000;
  const insert = opts.insert ?? defaultInsert;

  let buffer: AppLogRow[] = [];
  let written = 0;
  let dropped = 0;
  let droppedSinceReport = 0;
  let failedBatches = 0;
  let lastStderr = 0;
  let inFlight: Promise<void> | null = null;
  let timer: NodeJS.Timeout | null = null;
  let closed = false;

  const complain = (message: string) => {
    // Never through the logger (it would feed back into this sink); at most once a minute.
    if (Date.now() - lastStderr < 60_000) return;
    lastStderr = Date.now();
    try {
      process.stderr.write(`[log-sink] ${message}\n`);
    } catch {
      /* ignore */
    }
  };

  const drain = async (): Promise<void> => {
    while (buffer.length) {
      const batch = buffer.slice(0, batchSize);
      buffer = buffer.slice(batch.length);
      if (droppedSinceReport > 0) {
        batch.push({
          at: new Date(),
          level: 40,
          service: batch[0]?.service ?? 'api',
          msg: `${droppedSinceReport} log lines were dropped (log buffer full)`,
          reqId: null,
          institutionId: null,
          userId: null,
          context: null,
        });
        droppedSinceReport = 0;
      }
      try {
        await insert(batch);
        written += batch.length;
      } catch (err) {
        failedBatches += 1;
        dropped += batch.length;
        complain(`could not store ${batch.length} log lines: ${(err as Error)?.message ?? 'unknown error'}`);
      }
    }
  };

  const flush = (): Promise<void> => {
    if (inFlight) return inFlight.then(() => (buffer.length ? flush() : undefined));
    if (!buffer.length) return Promise.resolve();
    inFlight = drain().finally(() => {
      inFlight = null;
    });
    return inFlight;
  };

  const ensureTimer = () => {
    if (timer || closed) return;
    timer = setInterval(() => void flush(), flushIntervalMs);
    timer.unref();
  };

  return {
    write(line: string) {
      try {
        if (closed) return;
        const o = JSON.parse(line) as LogObject;
        if (!o || typeof o !== 'object' || !shouldStore(o)) return;
        if (buffer.length >= maxBuffer) {
          dropped += 1;
          droppedSinceReport += 1;
          return;
        }
        buffer.push(toRow(o));
        ensureTimer();
        if (buffer.length >= batchSize) void flush();
      } catch {
        /* a malformed line is not worth crashing for */
      }
    },
    flush,
    stats: () => ({ buffered: buffer.length, written, dropped, failedBatches }),
    async close() {
      closed = true;
      if (timer) clearInterval(timer);
      timer = null;
      await flush();
    },
  };
}

/**
 * Enabled everywhere except tests (where tests create their own sinks), unless CP_LOG_SINK=1
 * forces it on (or CP_LOG_SINK=0 forces it off, e.g. for one-off scripts).
 */
export function logSinkEnabled(): boolean {
  const flag = process.env.CP_LOG_SINK;
  if (flag === '0' || flag === 'false') return false;
  if (flag === '1' || flag === 'true') return true;
  return !isTest;
}

/** The process-wide sink attached to the logger. */
export const logSink: LogSink = createLogSink();

/** Flush buffered lines (call before closing the database on shutdown). */
export const flushLogSink = (): Promise<void> => logSink.flush();
