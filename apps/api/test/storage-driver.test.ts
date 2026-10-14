/**
 * Storage driver contract: every driver behaves the same for the operations the app relies on.
 * The local driver always runs; the S3 driver runs when S3_TEST_ENDPOINT is set (`npm run test:s3`
 * sets it to the dev Garage; see vitest.config.ts for the S3_TEST_* variables).
 */
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { DEVICE_CHUNK_MAX_BYTES, SUBMISSION_FILE_MAX_MB } from '@classiq/shared';
import { LocalStorage, maxObjectBytes, storage as appStorage, type Storage } from '../src/lib/storage.js';
import { S3Storage } from '../src/lib/storageS3.js';

const s3Endpoint = process.env.S3_TEST_ENDPOINT ?? '';
const s3Config = () => ({
  endpoint: s3Endpoint,
  bucket: process.env.S3_TEST_BUCKET || 'classpulse-test',
  region: process.env.S3_TEST_REGION || 'garage',
  accessKeyId: process.env.S3_TEST_ACCESS_KEY_ID ?? '',
  secretAccessKey: process.env.S3_TEST_SECRET_ACCESS_KEY ?? '',
  tmpDir: path.resolve('.test-storage/tmp/s3-contract'),
});

const drivers: { name: string; make: () => Storage }[] = [
  { name: 'local', make: () => new LocalStorage(path.resolve('.test-storage/contract'), path.resolve('.test-storage/tmp/local-contract')) },
  ...(s3Endpoint ? [{ name: 's3', make: () => new S3Storage(s3Config()) }] : []),
];

async function readAll(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks);
}

const sha256 = (b: Buffer) => createHash('sha256').update(b).digest('hex');

describe.each(drivers)('storage driver: $name', ({ make }) => {
  const storage = make();
  const base = `contract/${randomUUID()}`;

  afterAll(async () => {
    await storage.deletePrefix(base);
  });

  it('is ready and has a local temp dir', async () => {
    await expect(storage.checkReady()).resolves.toBeUndefined();
    expect(path.isAbsolute(storage.tmpDir)).toBe(true);
    expect(storage.newTmpPath('.wav')).toMatch(/\.wav$/);
    expect(path.dirname(storage.newTmpPath())).toBe(storage.tmpDir);
  });

  it('puts buffers and streams, stats and reads them (full and ranged, inclusive)', async () => {
    const body = Buffer.from('0123456789abcdef');
    const key = `${base}/put/one.bin`;
    const stat = await storage.put(key, body);
    expect(stat.size).toBe(body.length);
    expect(Math.abs(stat.modifiedAt.getTime() - Date.now())).toBeLessThan(5 * 60_000);
    expect(await storage.stat(key)).toMatchObject({ size: body.length });
    expect(await readAll(await storage.read(key))).toEqual(body);
    expect((await readAll(await storage.read(key, { start: 2, end: 5 }))).toString()).toBe('2345');
    expect((await readAll(await storage.read(key, { start: 15, end: 15 }))).toString()).toBe('f');

    const streamed = `${base}/put/two.bin`;
    expect((await storage.put(streamed, Readable.from([Buffer.from('ab'), Buffer.from('cd')]))).size).toBe(4);
    expect((await readAll(await storage.read(streamed))).toString()).toBe('abcd');

    // Overwrite replaces the object.
    await storage.put(key, Buffer.from('new'));
    expect((await readAll(await storage.read(key))).toString()).toBe('new');
  });

  it('moves a large local file in (multipart on S3) and consumes it', async () => {
    const body = randomBytes(20 * 1024 * 1024 + 123);
    await fs.mkdir(storage.tmpDir, { recursive: true });
    const local = storage.newTmpPath('.wav');
    await fs.writeFile(local, body);
    const key = `${base}/big/lecture.wav`;
    expect((await storage.putFile(key, local)).size).toBe(body.length);
    expect(existsSync(local)).toBe(false);
    expect(sha256(await readAll(await storage.read(key)))).toBe(sha256(body));
    const tail = await readAll(await storage.read(key, { start: body.length - 10, end: body.length - 1 }));
    expect(tail).toEqual(body.subarray(body.length - 10));
  }, 120_000);

  it('refuses objects over the size limit of their prefix (buffers, streams and files)', async () => {
    expect(maxObjectBytes(`submissions/a/b/c.pdf`)).toBe(SUBMISSION_FILE_MAX_MB * 1024 * 1024);
    expect(maxObjectBytes(`recordings/a/00000.pcm`)).toBe(DEVICE_CHUNK_MAX_BYTES);
    expect(maxObjectBytes(`audio/a/b.wav`)).toBeGreaterThan(400 * 1024 * 1024); // a 6-hour device recording fits

    const big = `${base.replace('contract/', 'submissions/')}/s/big.pdf`;
    await expect(storage.put(big, Buffer.alloc(SUBMISSION_FILE_MAX_MB * 1024 * 1024 + 1))).rejects.toMatchObject({ code: 'PAYLOAD_TOO_LARGE' });
    const chunk = `${base.replace('contract/', 'recordings/')}/00000.pcm`;
    const tooMuch = Readable.from([Buffer.alloc(DEVICE_CHUNK_MAX_BYTES), Buffer.alloc(10)]);
    await expect(storage.put(chunk, tooMuch)).rejects.toMatchObject({ code: 'PAYLOAD_TOO_LARGE' });
    expect(await storage.stat(chunk)).toBeNull();
    await fs.mkdir(storage.tmpDir, { recursive: true });
    const local = storage.newTmpPath('.pdf');
    await fs.writeFile(local, Buffer.alloc(SUBMISSION_FILE_MAX_MB * 1024 * 1024 + 1));
    await expect(storage.putFile(big, local)).rejects.toMatchObject({ code: 'PAYLOAD_TOO_LARGE' });
    expect(await storage.stat(big)).toBeNull();
    await fs.rm(local, { force: true });
    // Exactly at the limit is fine.
    expect((await storage.put(chunk, Readable.from([Buffer.alloc(DEVICE_CHUNK_MAX_BYTES)]))).size).toBe(DEVICE_CHUNK_MAX_BYTES);
    await storage.deletePrefix(chunk.replace(/\/00000\.pcm$/, ''));
    expect(await storage.stat(chunk)).toBeNull();
    if (storage.driver === 'local') {
      const leftovers = [];
      for await (const o of storage.list('recordings')) if (o.key.startsWith(chunk.replace(/00000\.pcm$/, ''))) leftovers.push(o.key);
      expect(leftovers).toEqual([]); // no half-written .part file
    }
  });

  it('returns null / rejects for missing or invalid keys', async () => {
    expect(await storage.stat(`${base}/missing/nothing.bin`)).toBeNull();
    expect(await storage.stat('../etc/passwd')).toBeNull();
    await expect(storage.read(`${base}/missing/nothing.bin`)).rejects.toThrow();
    await expect(storage.put('../escape/x', Buffer.from('x'))).rejects.toThrow(/Invalid storage key/);
    await expect(storage.put('Audio/x', Buffer.from('x'))).rejects.toThrow(/Invalid storage key/);
    await expect(storage.deletePrefix('..')).rejects.toThrow(/Invalid storage key/);
  });

  it('deletes single objects (missing ones too)', async () => {
    const key = `${base}/del/one.bin`;
    await storage.put(key, Buffer.from('x'));
    await storage.delete(key);
    expect(await storage.stat(key)).toBeNull();
    await expect(storage.delete(key)).resolves.toBeUndefined();
  });

  it('deletePrefix removes exactly prefix/ (audio/a never matches audio/ab)', async () => {
    const keys = [`${base}/audio/a/1.wav`, `${base}/audio/a/sub/2.wav`, `${base}/audio/ab/1.wav`, `${base}/audio/a.wav`];
    for (const key of keys) await storage.put(key, Buffer.from('x'));
    await storage.deletePrefix(`${base}/audio/a`);
    expect(await storage.stat(keys[0]!)).toBeNull();
    expect(await storage.stat(keys[1]!)).toBeNull();
    expect(await storage.stat(keys[2]!)).not.toBeNull();
    expect(await storage.stat(keys[3]!)).not.toBeNull();
    await storage.deletePrefix(`${base}/audio/ab/`); // trailing slash is the same prefix
    expect(await storage.stat(keys[2]!)).toBeNull();
    await expect(storage.deletePrefix(`${base}/audio/none`)).resolves.toBeUndefined();
  });

  it('lists objects under a prefix and its child prefixes', async () => {
    const keys = [`${base}/list/x1/00000.pcm`, `${base}/list/x1/00001.pcm`, `${base}/list/x2/00000.pcm`, `${base}/list/file.bin`];
    for (const [i, key] of keys.entries()) await storage.put(key, Buffer.alloc(i + 1));
    await storage.put(`${base}/listx/other.bin`, Buffer.from('x'));

    const listed = [];
    for await (const o of storage.list(`${base}/list`)) listed.push(o);
    expect(listed.map((o) => o.key).sort()).toEqual([...keys].sort());
    for (const o of listed) {
      expect(o.size).toBe(keys.indexOf(o.key) + 1);
      expect(o.modifiedAt).toBeInstanceOf(Date);
    }
    expect((await storage.listPrefixes(`${base}/list`)).sort()).toEqual([`${base}/list/x1`, `${base}/list/x2`]);

    const none = [];
    for await (const o of storage.list(`${base}/nothing`)) none.push(o);
    expect(none).toEqual([]);
    expect(await storage.listPrefixes(`${base}/nothing`)).toEqual([]);
  });

  it('withLocalFile gives a readable path and cleans up temp copies', async () => {
    const key = `${base}/local/audio.wav`;
    await storage.put(key, Buffer.from('RIFF....'));
    let seen = '';
    const result = await storage.withLocalFile(key, async (p) => {
      seen = p;
      expect(path.extname(p)).toBe('.wav');
      return (await fs.readFile(p)).toString();
    });
    expect(result).toBe('RIFF....');
    if (storage.driver === 's3') {
      expect(seen.startsWith(storage.tmpDir)).toBe(true);
      expect(existsSync(seen)).toBe(false);
      await expect(storage.withLocalFile(key, async (p) => {
        seen = p;
        throw new Error('stt failed');
      })).rejects.toThrow('stt failed');
      expect(existsSync(seen)).toBe(false);
    } else {
      expect(existsSync(seen)).toBe(true); // the stored file itself, never copied
    }
    await expect(storage.withLocalFile(`${base}/local/missing.wav`, async () => 1)).rejects.toThrow();
  });
});

describe('local driver: TMP_DIR on another volume', () => {
  it('putFile copies to a .part file next to the destination, then renames (EXDEV fallback)', async () => {
    const local = new LocalStorage(path.resolve('.test-storage/contract'), path.resolve('.test-storage/tmp/local-contract'));
    await fs.mkdir(local.tmpDir, { recursive: true });
    const src = local.newTmpPath('.wav');
    await fs.writeFile(src, 'RIFF-exdev');
    const key = `contract/${randomUUID()}/exdev.wav`;
    const rename = fs.rename.bind(fs);
    const renames: [string, string][] = [];
    const spy = vi.spyOn(fs, 'rename').mockImplementation(async (from, to) => {
      renames.push([String(from), String(to)]);
      if (String(from) === src) throw Object.assign(new Error('cross-device link not permitted'), { code: 'EXDEV' });
      return rename(from, to);
    });
    try {
      expect((await local.putFile(key, src)).size).toBe(10);
    } finally {
      spy.mockRestore();
    }
    const dest = local.pathOf(key);
    expect(renames).toHaveLength(2);
    expect(renames[1]![0].startsWith(`${dest}.`) && renames[1]![0].endsWith('.part')).toBe(true);
    expect(renames[1]![1]).toBe(dest);
    expect(await fs.readFile(dest, 'utf8')).toBe('RIFF-exdev');
    expect(existsSync(src)).toBe(false);
    expect((await fs.readdir(path.dirname(dest))).filter((f) => f.endsWith('.part'))).toEqual([]);
    await local.deletePrefix(key.replace(/\/exdev\.wav$/, ''));
  });
});

it('the app uses the configured driver', () => {
  expect(appStorage.driver).toBe(process.env.STORAGE_DRIVER);
});

describe.runIf(s3Endpoint)('S3 driver readiness', () => {
  it('fails checkReady for a bucket that does not exist', async () => {
    const bad = new S3Storage({ ...s3Config(), bucket: `missing-${randomUUID().slice(0, 8)}` });
    await expect(bad.checkReady()).rejects.toThrow();
  });
});
