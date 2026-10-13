/**
 * Copy every stored file from the local driver (STORAGE_DIR) to the S3 bucket (S3_*), keeping keys.
 * Run it while STORAGE_DRIVER is still `local`, re-run it right before switching to `s3`:
 *
 *   node dist/scripts/migrateStorage.js --dry-run      (in the api container; or npm run storage:migrate -- --dry-run)
 *   node dist/scripts/migrateStorage.js
 *
 * - Idempotent and resumable: objects already in the bucket with the same size are not copied again.
 * - Verification (before the operator flips the driver): the bucket is listed again and must hold every
 *   local file at the same size (object count), and EVERY object is compared by SHA-256, local file vs
 *   the object streamed back from the bucket. `--quick` checks sizes only.
 * - Never buffers whole files: copies and hashes are streamed.
 * - Every key referenced in the database (lesson audio, submission files, teacher materials, recording
 *   chunks) is cross-checked against the bucket.
 * - The temp dir (`tmp/`, TMP_DIR), half-written `.part` files and probe files are never copied.
 * - Nothing local is changed or deleted.
 *
 * Exit code 0 when every file is in the bucket and every database key resolves; 1 otherwise.
 */
import { createHash } from 'node:crypto';
import { createReadStream, type Dirent } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { Readable } from 'node:stream';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { eq, inArray, isNotNull } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';
import { env } from '../config/env.js';
import { closeDb, db } from '../db/client.js';
import { lessons, recordingChunks, recordingSessions, submissionFiles, teacherMaterials } from '../db/schema/index.js';
import { KEY_PATTERN, type Storage } from '../lib/storageCommon.js';
import { S3Storage } from '../lib/storageS3.js';

const USAGE = 'Usage: migrateStorage [--dry-run] [--quick] [--concurrency <n>]';
const MAX_LISTED = 20;

export interface MigrateOptions {
  /** Local storage root (STORAGE_DIR). */
  sourceDir: string;
  /** Directories under the root that are never copied (the temp dir). */
  excludeDirs: string[];
  target: Storage;
  dryRun: boolean;
  /** Compare every object by SHA-256 (true), or by size only (false, --quick). */
  verifyHashes: boolean;
  concurrency: number;
  log?: (line: string) => void;
}

export interface MigrateReport {
  files: number;
  bytes: number;
  copied: number;
  copiedBytes: number;
  /** Already in the bucket with the same size. */
  present: number;
  /** Would be copied (dry run). */
  pending: number;
  /** Paths under the root that are not valid storage keys (not copied). */
  invalid: string[];
  failed: { key: string; error: string }[];
  /** Local files found in the bucket at the same size, from a fresh listing after the copy. */
  verifiedCount: number;
  /** Local files missing from the bucket or with a different size there (after the copy). */
  countMismatches: string[];
  hashed: number;
  hashMismatches: string[];
  /** Database keys missing from the bucket while the file exists locally: the migration is incomplete. */
  dbMissingInTarget: string[];
  /** Database keys with no file locally or in the bucket (already broken before the migration). */
  dbMissingEverywhere: string[];
  dbKeys: number;
}

/** Key columns of every table that stores object keys (recording chunks: see dbKeys). */
const KEY_COLUMNS: PgColumn[] = [lessons.audioObjectKey, submissionFiles.objectKey, teacherMaterials.objectKey];

/**
 * Every object key the database still needs. Chunk rows outlive their files once a recording is
 * assembled (or ended), so only chunks of recordings still in progress count.
 */
async function dbKeys(): Promise<string[]> {
  const keys: string[] = [];
  for (const column of KEY_COLUMNS) {
    const rows = await db.select({ key: column }).from(column.table).where(isNotNull(column));
    for (const { key } of rows as { key: string }[]) keys.push(key);
  }
  const chunks = await db
    .select({ key: recordingChunks.objectKey })
    .from(recordingChunks)
    .innerJoin(recordingSessions, eq(recordingSessions.id, recordingChunks.sessionId))
    .where(inArray(recordingSessions.status, ['pending', 'recording', 'stopping']));
  return [...keys, ...chunks.map((c) => c.key)];
}

async function localFiles(root: string, exclude: string[]): Promise<{ key: string; full: string; size: number }[]> {
  const out: { key: string; full: string; size: number }[] = [];
  const skip = new Set(exclude.map((d) => path.resolve(d)));
  const walk = async (dir: string): Promise<void> => {
    let entries: Dirent[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!skip.has(path.resolve(full))) await walk(full);
      } else if (entry.isFile()) {
        if (entry.name.endsWith('.part') || entry.name.startsWith('.probe-')) continue;
        const s = await fs.stat(full).catch(() => null);
        if (s) out.push({ key: path.relative(root, full).split(path.sep).join('/'), full, size: s.size });
      }
    }
  };
  await walk(root);
  return out;
}

async function sha256Of(stream: Readable): Promise<string> {
  const hash = createHash('sha256');
  for await (const chunk of stream) hash.update(chunk as Buffer);
  return hash.digest('hex');
}

async function mapLimit<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (next < items.length) await fn(items[next++]!);
  });
  await Promise.all(workers);
}

export async function migrateStorage(opts: MigrateOptions): Promise<MigrateReport> {
  const log = opts.log ?? (() => undefined);
  const root = path.resolve(opts.sourceDir);
  const report: MigrateReport = {
    files: 0,
    bytes: 0,
    copied: 0,
    copiedBytes: 0,
    present: 0,
    pending: 0,
    invalid: [],
    failed: [],
    verifiedCount: 0,
    countMismatches: [],
    hashed: 0,
    hashMismatches: [],
    dbMissingInTarget: [],
    dbMissingEverywhere: [],
    dbKeys: 0,
  };

  const all = await localFiles(root, opts.excludeDirs);
  const files = all.filter((f) => {
    const ok = KEY_PATTERN.test(f.key) && !f.key.includes('..');
    if (!ok) report.invalid.push(f.key);
    return ok;
  });
  report.files = files.length;
  report.bytes = files.reduce((sum, f) => sum + f.size, 0);
  log(`Local: ${files.length} file(s), ${report.bytes} bytes under ${root}`);

  // What the bucket already holds, under every top-level prefix found locally (one listing, no HEAD per file).
  const prefixes = [...new Set(files.map((f) => f.key.split('/')[0]!))];
  const remote = new Map<string, number>();
  for (const prefix of prefixes) for await (const o of opts.target.list(prefix)) remote.set(o.key, o.size);

  let done = 0;
  await mapLimit(files, opts.concurrency, async (f) => {
    if (remote.get(f.key) === f.size) {
      report.present++;
    } else if (opts.dryRun) {
      report.pending++;
    } else {
      try {
        const stat = await opts.target.put(f.key, createReadStream(f.full));
        if (stat.size !== f.size) throw new Error(`size ${stat.size} in the bucket, ${f.size} locally`);
        remote.set(f.key, stat.size);
        report.copied++;
        report.copiedBytes += f.size;
      } catch (err) {
        report.failed.push({ key: f.key, error: err instanceof Error ? err.message.split('\n')[0]! : String(err) });
      }
    }
    if (++done % 500 === 0) log(`  … ${done}/${files.length}`);
  });

  // Verification against a fresh listing: every local file is in the bucket at the same size.
  const listed = new Map<string, number>();
  for (const prefix of prefixes) for await (const o of opts.target.list(prefix)) listed.set(o.key, o.size);
  for (const f of files) {
    if (listed.get(f.key) === f.size) report.verifiedCount++;
    else if (!opts.dryRun) report.countMismatches.push(f.key);
  }

  // Content: SHA-256 of every object in the bucket against its local file (streamed on both sides).
  if (opts.verifyHashes) {
    const inTarget = files.filter((f) => listed.get(f.key) === f.size);
    await mapLimit(inTarget, opts.concurrency, async (f) => {
      const [local, stored] = await Promise.all([sha256Of(createReadStream(f.full)), opts.target.read(f.key).then(sha256Of)]);
      report.hashed++;
      if (local !== stored) report.hashMismatches.push(f.key);
      if (report.hashed % 500 === 0) log(`  … verified ${report.hashed}/${inTarget.length}`);
    });
  }

  // Every key the database refers to must be in the bucket.
  const localKeys = new Set(files.map((f) => f.key));
  for (const key of await dbKeys()) {
    report.dbKeys++;
    if (listed.has(key)) continue;
    // Not seen locally under a listed prefix: ask the bucket directly before calling it missing.
    if (!localKeys.has(key) && (await opts.target.stat(key))) continue;
    if (localKeys.has(key)) report.dbMissingInTarget.push(key);
    else report.dbMissingEverywhere.push(key);
  }
  return report;
}

export function reportOk(r: MigrateReport, dryRun: boolean): boolean {
  if (r.failed.length || r.hashMismatches.length) return false;
  if (dryRun) return true;
  return r.countMismatches.length === 0 && r.verifiedCount === r.files && r.dbMissingInTarget.length === 0;
}

function printReport(r: MigrateReport, dryRun: boolean, quick: boolean): void {
  const list = (title: string, keys: string[]) => {
    if (!keys.length) return;
    console.log(`${title} (${keys.length}):`);
    for (const k of keys.slice(0, MAX_LISTED)) console.log(`  ${k}`);
    if (keys.length > MAX_LISTED) console.log(`  … and ${keys.length - MAX_LISTED} more`);
  };
  console.log(dryRun ? '\nDry run — nothing was copied.' : '\nMigration report');
  console.log(`  Local files:         ${r.files} (${(r.bytes / 1048576).toFixed(1)} MB)`);
  console.log(`  Already in bucket:   ${r.present}`);
  if (dryRun) console.log(`  Would copy:          ${r.pending}`);
  else console.log(`  Copied now:          ${r.copied} (${(r.copiedBytes / 1048576).toFixed(1)} MB)`);
  console.log(`  Failed:              ${r.failed.length}`);
  console.log(`  In bucket (listed):  ${r.verifiedCount} of ${r.files} at the same size`);
  console.log(`  SHA-256:             ${r.hashed} compared, ${r.hashMismatches.length} mismatched${quick ? ' (--quick: sizes only)' : ''}`);
  console.log(`  Database keys:       ${r.dbKeys} checked`);
  list('Copy failures', r.failed.map((f) => `${f.key}: ${f.error}`));
  list('Missing from the bucket or a different size there', r.countMismatches);
  list('Content mismatches (delete them from the bucket, then re-run to copy them again)', r.hashMismatches);
  list(dryRun ? 'Database keys not in the bucket yet' : 'Database keys missing from the bucket (file exists locally)', r.dbMissingInTarget);
  list('Database keys with no file anywhere (broken before the migration)', r.dbMissingEverywhere);
  list('Skipped paths that are not valid storage keys', r.invalid);
  console.log(reportOk(r, dryRun) ? '\nOK' : '\nNOT OK — fix the problems above and re-run.');
}

async function main(): Promise<number> {
  const { values } = parseArgs({
    options: {
      'dry-run': { type: 'boolean', default: false },
      quick: { type: 'boolean', default: false },
      concurrency: { type: 'string', default: '4' },
    },
    strict: true,
  });
  const concurrency = Number(values.concurrency);
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 32) {
    console.error(USAGE);
    return 1;
  }
  if (!env.S3_ENDPOINT || !env.S3_ACCESS_KEY_ID || !env.S3_SECRET_ACCESS_KEY) {
    console.error('Set S3_ENDPOINT, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY (and S3_BUCKET) to the target bucket first.');
    return 1;
  }
  const target = new S3Storage({
    endpoint: env.S3_ENDPOINT,
    bucket: env.S3_BUCKET,
    region: env.S3_REGION,
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    tmpDir: env.TMP_DIR,
  });
  await target.checkReady();
  const sourceDir = path.resolve(env.STORAGE_DIR);
  console.log(`Copying ${sourceDir} → ${env.S3_ENDPOINT} bucket ${env.S3_BUCKET}${values['dry-run'] ? ' (dry run)' : ''}`);
  const report = await migrateStorage({
    sourceDir,
    excludeDirs: [path.join(sourceDir, 'tmp'), env.TMP_DIR],
    target,
    dryRun: values['dry-run'],
    verifyHashes: !values.quick,
    concurrency,
    log: (line) => console.log(line),
  });
  printReport(report, values['dry-run'], values.quick);
  return reportOk(report, values['dry-run']) ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  let exitCode = 1;
  try {
    exitCode = await main();
  } catch (err) {
    console.error('migrateStorage failed:', err instanceof Error ? err.message : err);
  } finally {
    await closeDb();
  }
  process.exit(exitCode);
}
