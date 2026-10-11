import pino from 'pino';
import { env, isProd, isTest } from '../config/env.js';
import { logSink, logSinkEnabled } from './logSink.js';

const options: pino.LoggerOptions = {
  level: env.NODE_ENV === 'test' ? 'silent' : env.LOG_LEVEL,
  base: { service: process.env.CP_PROCESS_NAME ?? 'api' },
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
      options,
      pino.multistream([
        { level: 'trace', stream: consoleStream },
        { level: 'info', stream: logSink },
      ]),
    )
  : pino(options, consoleStream);

export type Logger = typeof logger;
