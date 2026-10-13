/**
 * scripts/migrateStorage.ts: local → S3 copy with dry run, idempotent re-runs, full SHA-256 verification and the
 * database key cross-check. Needs an S3 endpoint (S3_TEST_*, set by `npm run test:s3`).
 */
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { db } from '../src/db/client.js';
import { lessons } from '../src/db/schema/index.js';
import { migrateStorage, reportOk } from '../src/scripts/migrateStorage.js';
import { S3Storage } from '../src/lib/storageS3.js';
import { createWorld } from './helpers.js';
import { insertLesson } from './fixtures/lessons.js';

const endpoint = process.env.S3_TEST_ENDPOINT ?? '';

describe.runIf(endpoint)('storage migration (local → S3)', () => {
  const target = endpoint
    ? new S3Storage({
        endpoint,
        bucket: process.env.S3_TEST_BUCKET || 'classpulse-test',
        region: process.env.S3_TEST_REGION || 'garage',
        accessKeyId: process.env.S3_TEST_ACCESS_KEY_ID ?? '',
        secretAccessKey: process.env.S3_TEST_SECRET_ACCESS_KEY ?? '',
        tmpDir: path.resolve('.test-storage/tmp/migrate'),
      })
    : null;
  const id = randomUUID();
  const source = path.resolve(`.test-storage/migrate-${id}`);
  const keys = [`audio/${id}/a.wav`, `submissions/${id}/s/b.pdf`, `recordings/${id}/00000.pcm`];

  afterAll(async () => {
    for (const p of ['audio', 'submissions', 'recordings']) await target!.deletePrefix(`${p}/${id}`);
    await fs.rm(source, { recursive: true, force: true });
  });

  it('dry-runs, copies, verifies, cross-checks the database and is idempotent', async () => {
    for (const [i, key] of keys.entries()) {
      await fs.mkdir(path.dirname(path.join(source, key)), { recursive: true });
      await fs.writeFile(path.join(source, key), Buffer.alloc(1000 * (i + 1), i + 1));
    }
    // Never copied: the temp dir, half-written files, names that are not storage keys.
    await fs.mkdir(path.join(source, 'tmp'), { recursive: true });
    await fs.writeFile(path.join(source, 'tmp', 'upload.bin'), 'x');
    await fs.writeFile(path.join(source, `audio/${id}/a.wav.${randomUUID()}.part`), 'x');
    await fs.writeFile(path.join(source, `audio/${id}/bad name.wav`), 'x');

    const w = await createWorld();
    const lesson = await insertLesson({ institutionId: w.institution.id, teacherId: w.teacher.id, sectionId: w.section.id });
    await db.update(lessons).set({ audioObjectKey: keys[0] }).where(eq(lessons.id, lesson.id));
    const broken = await insertLesson({ institutionId: w.institution.id, teacherId: w.teacher.id, sectionId: w.section.id });
    await db.update(lessons).set({ audioObjectKey: `audio/${id}/gone.wav` }).where(eq(lessons.id, broken.id));

    const run = (dryRun: boolean, verifyHashes = true) =>
      migrateStorage({ sourceDir: source, excludeDirs: [path.join(source, 'tmp')], target: target!, dryRun, verifyHashes, concurrency: 2 });

    const dry = await run(true);
    expect(dry).toMatchObject({ files: 3, pending: 3, copied: 0, present: 0, failed: [] });
    expect(dry.invalid).toEqual([`audio/${id}/bad name.wav`]);
    expect(dry.dbMissingInTarget).toEqual([keys[0]]);
    expect(dry.dbMissingEverywhere).toEqual([`audio/${id}/gone.wav`]);
    expect(await target!.stat(keys[0]!)).toBeNull();

    const real = await run(false);
    expect(real).toMatchObject({ files: 3, copied: 3, present: 0, failed: [], verifiedCount: 3, countMismatches: [], hashed: 3 });
    expect(real).toMatchObject({ hashMismatches: [], dbMissingInTarget: [] });
    expect(reportOk(real, false)).toBe(true);
    for (const [i, key] of keys.entries()) expect((await target!.stat(key))?.size).toBe(1000 * (i + 1));
    expect(await target!.stat(`tmp/upload.bin`)).toBeNull();
    for (const key of keys) expect(existsSync(path.join(source, key))).toBe(true); // nothing local is touched

    const again = await run(false);
    expect(again).toMatchObject({ copied: 0, present: 3, failed: [], hashed: 3 });
    expect(reportOk(again, false)).toBe(true);

    // Same size, different bytes in the bucket: the full check catches it, --quick (sizes only) cannot.
    await target!.put(keys[1]!, Buffer.alloc(2000, 9));
    const corrupt = await run(false);
    expect(corrupt.hashMismatches).toEqual([keys[1]]);
    expect(reportOk(corrupt, false)).toBe(false);
    const quick = await run(false, false);
    expect(quick).toMatchObject({ hashed: 0, hashMismatches: [], verifiedCount: 3 });
    expect(reportOk(quick, false)).toBe(true);
  });
});
