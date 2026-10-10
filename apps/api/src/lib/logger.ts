import pino from 'pino';
import { env, isProd } from '../config/env.js';

export const logger = pino({
  level: env.NODE_ENV === 'test' ? 'silent' : env.LOG_LEVEL,
  base: { service: process.env.CP_PROCESS_NAME ?? 'api' },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.headers["x-device-key"]',
      'res.headers["set-cookie"]',
      '*.password',
      '*.newPassword',
      '*.currentPassword',
      '*.passwordHash',
      '*.deviceKey',
      '*.enrollmentToken',
      '*.token',
    ],
    censor: '[redacted]',
  },
  ...(isProd
    ? {}
    : {
        transport: { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } },
      }),
});

export type Logger = typeof logger;
