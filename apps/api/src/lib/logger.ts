import pino from 'pino';
import { env, isProd, isTest } from '../config/env.js';
import { scrubError, scrubText } from './logScrub.js';
import { logSink, logSinkEnabled } from './logSink.js';

/** pino's error serializer, after removing bound query parameters and Postgres row values (lib/logScrub.ts). */
const errSerializer = (err: unknown): unknown => pino.stdSerializers.err(scrubError(err) as Error);

const ERROR_KEYS = new Set(['err', 'error']);

/**
 * Applied to every log object before serializers run, so it also covers child loggers whose `err` serializer
 * is replaced (pino-http installs pino's standard one): any Error value, and string `err`/`error` fields
 * (`{ err: err.message }`), are scrubbed.
 */
function scrubLogObject(obj: Record<string, unknown>): Record<string, unknown> {
  let out: Record<string, unknown> | null = null;
  for (const [key, value] of Object.entries(obj)) {
    const scrubbed = value instanceof Error || (ERROR_KEYS.has(key) && typeof value === 'string') ? scrubError(value) : value;
    if (scrubbed !== value) (out ??= { ...obj })[key] = scrubbed;
  }
  return out ?? obj;
}

export const loggerOptions: pino.LoggerOptions = {
  level: env.NODE_ENV === 'test' ? 'silent' : env.LOG_LEVEL,
  base: { service: process.env.CP_PROCESS_NAME ?? 'api' },
  serializers: { err: errSerializer, error: errSerializer },
  formatters: { log: scrubLogObject },
  hooks: {
    // pino takes the line's `msg` from err.message when none is given (`logger.error(err)` or
    // `logger.error({ err })`); give it the scrubbed message instead, and scrub string messages too.
    logMethod(args, method) {
      const [first, second] = args as unknown[];
      let err: unknown = first instanceof Error ? first : undefined;
      if (!err && first && typeof first === 'object') {
        const o = first as Record<string, unknown>;
        if (o.err instanceof Error && o.msg === undefined) err = o.err;
      }
      if (err && typeof second !== 'string') {
        const msg = scrubText((err as Error).message);
        const merging = first instanceof Error ? { err: first } : first;
        return method.apply(this, [merging, msg, ...args.slice(1)] as unknown as Parameters<typeof method>);
      }
      const scrubbed = args.map((a, i) => (i > 0 && typeof a === 'string' ? scrubText(a) : a));
      return method.apply(this, scrubbed as Parameters<typeof method>);
    },
  },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.headers["x-device-key"]',
      'req.headers["x-exam-token"]',
      '*.attemptToken',
      '*.accessCode',
      'res.headers["set-cookie"]',
      '*.password',
      '*.newPassword',
      '*.currentPassword',
      '*.passwordHash',
      '*.deviceKey',
      '*.enrollmentToken',
      '*.token',
      '*.apiKey',
      '*.challengeToken',
      '*.recoveryCode',
    ],
    censor: '[redacted]',
  },
};

/** Console output: JSON in production (and tests), pretty-printed in development. */
const consoleStream: pino.DestinationStream =
  isProd || isTest
    ? pino.destination(1)
    : pino.transport({ target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } });

/**
 * stdout as before, plus (outside tests) the app_logs database sink for the platform console.
 * The sink applies its own filter (see lib/logSink.ts); it only ever sees info and above.
 */
export const logger = logSinkEnabled()
  ? pino(
      loggerOptions,
      pino.multistream([
        { level: 'trace', stream: consoleStream },
        { level: 'info', stream: logSink },
      ]),
    )
  : pino(loggerOptions, consoleStream);

export type Logger = typeof logger;
