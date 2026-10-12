import { Writable } from 'node:stream';
import express from 'express';
import pino from 'pino';
import { pinoHttp } from 'pino-http';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { loggerOptions } from '../src/lib/logger.js';
import { createLogSink, type AppLogRow } from '../src/lib/logSink.js';
import { redactPgDetail, scrubError } from '../src/lib/logScrub.js';
import { createInstitution, createUser } from './helpers.js';

const SECRET_EMAIL = 'leaky.person@example.org';
const SECRET_HASH = '$2b$12$abcdefghijklmnopqrstuvSECRETHASHxxxxxxxxxxxxxxxxxxxxxx';

/** A logger with the production options, writing JSON lines into an array. */
function captureLogger() {
  const lines: string[] = [];
  const stream = new Writable({
    write(chunk, _enc, cb) {
      lines.push(...String(chunk).split('\n').filter(Boolean));
      cb();
    },
  });
  const log = pino({ ...loggerOptions, level: 'info' }, stream);
  return { log, lines, all: () => lines.join('\n') };
}

/** A real DrizzleQueryError: a duplicate email insert (unique index), with the email and a hash as params. */
async function duplicateEmailError(): Promise<Error> {
  const inst = await createInstitution();
  await createUser(inst.id, 'teacher', { email: SECRET_EMAIL });
  try {
    await createUser(inst.id, 'teacher', { email: SECRET_EMAIL, passwordHash: SECRET_HASH });
  } catch (err) {
    return err as Error;
  }
  throw new Error('expected a unique violation');
}

describe('log scrubbing (L6)', () => {
  it('the raw Drizzle error really does carry the values (sanity check)', async () => {
    const err = await duplicateEmailError();
    expect(err.message).toMatch(/^Failed query:/);
    expect(err.message).toContain(SECRET_EMAIL);
    expect((err as Error & { cause?: { detail?: string } }).cause?.detail).toContain(SECRET_EMAIL);
  });

  it('drops params from message, stack and fields but keeps the SQL and the Postgres diagnosis', async () => {
    const err = await duplicateEmailError();
    const { log, lines, all } = captureLogger();
    log.error({ err }, 'Unhandled error');
    log.error(err); // msg comes from err.message
    log.error({ err }); // likewise
    log.warn({ err: err.message }, 'as a string');
    log.error({ error: err }, 'under `error`');

    expect(all()).not.toContain(SECRET_EMAIL);
    expect(all()).not.toContain('SECRETHASH');
    const first = JSON.parse(lines[0]!);
    expect(first.err.type).toBe('DrizzleQueryError');
    expect(first.err.message).toMatch(/^Failed query: insert into "users"/);
    expect(first.err.message).toContain('params: [redacted]');
    expect(first.err.stack).toContain('params: [redacted]');
    expect(first.err.stack).toMatch(/\n\s+at /); // the stack frames are kept
    expect(first.err.params).toBe('[redacted]');
    expect(first.err.query).toMatch(/\$1/);
    // pino's serializer folds the cause into message/stack; the cause must be scrubbed too.
    expect(first.err.message).toContain('duplicate key value violates unique constraint "users_email_unique"');
    const second = JSON.parse(lines[1]!);
    expect(second.msg).toMatch(/^Failed query:/);
    expect(second.msg).toContain('params: [redacted]');
  });

  it('also scrubs errors logged through pino-http (which installs its own err serializer)', async () => {
    const err = await duplicateEmailError();
    const { log, all } = captureLogger();
    const app = express();
    app.use(pinoHttp({ logger: log }));
    app.get('/boom', (req, res) => {
      req.log.error({ err }, 'Unhandled error');
      res.err = err;
      res.status(500).end();
    });
    await request(app).get('/boom').expect(500);
    expect(all()).toContain('Unhandled error');
    expect(all()).toContain('request errored');
    expect(all()).not.toContain(SECRET_EMAIL);
    expect(all()).not.toContain('SECRETHASH');
  });

  it('keeps the Postgres fields of the cause and redacts the values in detail', async () => {
    const err = await duplicateEmailError();
    const scrubbed = scrubError(err) as Error & { cause: Record<string, unknown>; params?: unknown };
    expect(scrubbed).toBeInstanceOf(Error);
    expect(scrubbed.params).toBe('[redacted]');
    expect(scrubbed.cause.code).toBe('23505');
    expect(scrubbed.cause.constraint).toBe('users_email_unique');
    expect(scrubbed.cause.table).toBe('users');
    expect(scrubbed.cause.detail).toBe('Key (email)=([redacted]) already exists.');
    // The original error is untouched (it may still be handled or rethrown).
    expect(err.message).toContain(SECRET_EMAIL);
  });

  it('redacts the shapes of Postgres detail messages', () => {
    expect(redactPgDetail('Key (institution_id, email)=(1a2b, x@y.z) already exists.')).toBe(
      'Key (institution_id, email)=([redacted]) already exists.',
    );
    expect(redactPgDetail('Key (section_id)=(abc) is not present in table "sections".')).toBe(
      'Key (section_id)=([redacted]) is not present in table "sections".',
    );
    expect(redactPgDetail('Key (lower(email::text))=(a (b) c) already exists.')).toBe(
      'Key (lower(email::text))=([redacted]) already exists.',
    );
    expect(redactPgDetail('Failing row contains (1, Priya, priya@x.in, null).')).toBe('Failing row contains ([redacted]).');
    expect(redactPgDetail('Something new with (secret) and "quoted"')).not.toMatch(/secret|quoted/);
  });

  it('drops the quoted input from data-exception messages', () => {
    const pgErr = Object.assign(new Error('invalid input syntax for type uuid: "not-a-uuid-SECRET"'), {
      code: '22P02',
      severity: 'ERROR',
      routine: 'string_to_uuid',
    });
    const scrubbed = scrubError(pgErr);
    expect(scrubbed.message).toBe('invalid input syntax for type uuid: "[redacted]"');
    expect(scrubbed.stack).not.toContain('SECRET');
  });

  it('leaves ordinary errors alone', () => {
    const err = new Error('Something else went wrong');
    expect(scrubError(err)).toBe(err);
  });

  it('scrubs the app_logs context and message as well', async () => {
    const err = await duplicateEmailError();
    const rows: AppLogRow[] = [];
    const sink = createLogSink({ insert: async (r) => void rows.push(...r), flushIntervalMs: 60_000 });
    // A raw line in an unexpected shape (as if a caller had bypassed the serializers).
    sink.write(
      JSON.stringify({
        level: 50,
        time: Date.now(),
        msg: err.message,
        failure: { message: err.message, query: 'insert into "users" values ($1)', params: [SECRET_EMAIL, SECRET_HASH] },
        pg: { code: '23505', severity: 'ERROR', detail: `Key (email)=(${SECRET_EMAIL}) already exists.`, constraint: 'users_email_unique' },
      }),
    );
    // And a line produced by the real logger.
    const { log, lines } = captureLogger();
    log.error({ err }, 'Unhandled error');
    sink.write(lines[0]!);
    await sink.close();

    expect(rows).toHaveLength(2);
    const dump = JSON.stringify(rows);
    expect(dump).not.toContain(SECRET_EMAIL);
    expect(dump).not.toContain('SECRETHASH');
    expect(rows[0]!.msg).toContain('params: [redacted]');
    expect((rows[0]!.context as { pg: { detail: string } }).pg.detail).toBe('Key (email)=([redacted]) already exists.');
    expect((rows[1]!.context as { err: { type: string } }).err.type).toBe('DrizzleQueryError');
  });
});
