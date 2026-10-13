/**
 * S3-compatible storage driver (self-hosted Garage in production). Objects keep the same keys as the
 * local driver. Files are still served only through the API (auth, auditing, CSP), never by presigned
 * URLs, so the bucket stays internal.
 *
 * Garage specifics: path-style addressing, region `garage`, and checksums only where the S3 API
 * requires them (DeleteObjects).
 */
import { createReadStream, createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import http from 'node:http';
import https from 'node:https';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import {
  assertKey,
  assertObjectSize,
  limitedStream,
  normalizePrefix,
  tmpPathIn,
  type ByteRange,
  type ObjectInfo,
  type ObjectStat,
  type Storage,
} from './storageCommon.js';

export interface S3StorageConfig {
  endpoint: string;
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  tmpDir: string;
  /** Concurrent connections to the S3 endpoint (keep-alive pool). */
  maxSockets?: number;
}

/** Multipart part size: big enough for few requests per lecture, small enough to bound memory (x queue size). */
const PART_SIZE = 16 * 1024 * 1024;
const UPLOAD_QUEUE_SIZE = 4;
/** S3's DeleteObjects limit. */
const DELETE_BATCH = 1000;
const READY_TIMEOUT_MS = 5_000;

function isNotFound(err: unknown): boolean {
  const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
  return e?.name === 'NotFound' || e?.name === 'NoSuchKey' || e?.$metadata?.httpStatusCode === 404;
}

export class S3Storage implements Storage {
  readonly driver = 's3' as const;
  readonly tmpDir: string;
  readonly bucket: string;
  private readonly client: S3Client;

  constructor(config: S3StorageConfig) {
    this.tmpDir = path.resolve(config.tmpDir);
    this.bucket = config.bucket;
    const agentOptions = { keepAlive: true, maxSockets: config.maxSockets ?? 64 };
    this.client = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      forcePathStyle: true,
      credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
      // Only send/validate the optional CRC checksums when an operation requires them.
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
      maxAttempts: 3,
      requestHandler: {
        httpAgent: new http.Agent(agentOptions),
        httpsAgent: new https.Agent(agentOptions),
        connectionTimeout: 5_000,
        // Time until response headers (or until a request body is sent). No socket idle timeout: a
        // paused audio download legitimately leaves the connection idle.
        requestTimeout: 120_000,
        throwOnRequestTimeout: true,
      },
    });
  }

  newTmpPath(ext = ''): string {
    return tmpPathIn(this.tmpDir, ext);
  }

  async put(key: string, body: Buffer | Readable): Promise<ObjectStat> {
    assertKey(key);
    if (Buffer.isBuffer(body)) {
      assertObjectSize(key, body.length);
      await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentLength: body.length }));
    } else {
      await this.upload(key, limitedStream(key, body));
    }
    return this.statOrThrow(key);
  }

  async putFile(key: string, localPath: string): Promise<ObjectStat> {
    assertKey(key);
    const { size } = await fs.stat(localPath);
    assertObjectSize(key, size);
    if (size < PART_SIZE) {
      await this.client.send(
        new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: createReadStream(localPath), ContentLength: size }),
      );
    } else {
      await this.upload(key, createReadStream(localPath));
    }
    const stat = await this.statOrThrow(key);
    if (stat.size !== size) throw new Error(`Stored object size ${stat.size} does not match the file (${size} bytes)`);
    await fs.rm(localPath, { force: true });
    return stat;
  }

  private async upload(key: string, body: Readable): Promise<void> {
    const upload = new Upload({
      client: this.client,
      params: { Bucket: this.bucket, Key: key, Body: body },
      partSize: PART_SIZE,
      queueSize: UPLOAD_QUEUE_SIZE,
      leavePartsOnError: false,
    });
    await upload.done();
  }

  private async statOrThrow(key: string): Promise<ObjectStat> {
    const stat = await this.stat(key);
    if (!stat) throw new Error('Object missing right after upload');
    return stat;
  }

  async stat(key: string): Promise<ObjectStat | null> {
    try {
      assertKey(key);
    } catch {
      return null;
    }
    try {
      const head = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return { size: head.ContentLength ?? 0, modifiedAt: head.LastModified ?? new Date(0) };
    } catch (err) {
      if (isNotFound(err)) return null;
      throw err;
    }
  }

  async read(key: string, range?: ByteRange): Promise<Readable> {
    assertKey(key);
    const out = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key, Range: range ? `bytes=${range.start}-${range.end}` : undefined }),
    );
    if (!(out.Body instanceof Readable)) throw new Error('Unexpected S3 response body');
    // Destroying this stream (pipeline does it when the client goes away) closes the S3 connection.
    return out.Body;
  }

  async withLocalFile<T>(key: string, fn: (localPath: string) => Promise<T>): Promise<T> {
    const local = this.newTmpPath(path.extname(key));
    await fs.mkdir(this.tmpDir, { recursive: true });
    try {
      await pipeline(await this.read(key), createWriteStream(local));
      return await fn(local);
    } finally {
      await fs.rm(local, { force: true }).catch(() => undefined);
    }
  }

  async *list(prefix: string): AsyncIterable<ObjectInfo> {
    const p = normalizePrefix(prefix);
    let token: string | undefined;
    do {
      const page = await this.client.send(new ListObjectsV2Command({ Bucket: this.bucket, Prefix: p, ContinuationToken: token }));
      for (const o of page.Contents ?? []) {
        if (o.Key) yield { key: o.Key, size: o.Size ?? 0, modifiedAt: o.LastModified ?? new Date(0) };
      }
      token = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (token);
  }

  async listPrefixes(prefix: string): Promise<string[]> {
    const p = normalizePrefix(prefix);
    const out: string[] = [];
    let token: string | undefined;
    do {
      const page = await this.client.send(
        new ListObjectsV2Command({ Bucket: this.bucket, Prefix: p, Delimiter: '/', ContinuationToken: token }),
      );
      for (const cp of page.CommonPrefixes ?? []) if (cp.Prefix) out.push(cp.Prefix.replace(/\/+$/, ''));
      token = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (token);
    return out;
  }

  async delete(key: string): Promise<void> {
    assertKey(key);
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async deletePrefix(prefix: string): Promise<void> {
    const p = normalizePrefix(prefix);
    // List from the start after each batch: the deleted keys are gone, so nothing is skipped.
    for (;;) {
      const page = await this.client.send(new ListObjectsV2Command({ Bucket: this.bucket, Prefix: p, MaxKeys: DELETE_BATCH }));
      const keys = (page.Contents ?? []).flatMap((o) => (o.Key ? [{ Key: o.Key }] : []));
      if (!keys.length) return;
      const res = await this.client.send(
        new DeleteObjectsCommand({ Bucket: this.bucket, Delete: { Objects: keys, Quiet: true } }),
      );
      if (res.Errors?.length) {
        const first = res.Errors[0]!;
        throw new Error(`Could not delete ${res.Errors.length} object(s) under ${p}: ${first.Code ?? 'error'} ${first.Message ?? ''}`.trim());
      }
      if (!page.IsTruncated) return;
    }
  }

  async checkReady(): Promise<void> {
    await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }), { abortSignal: AbortSignal.timeout(READY_TIMEOUT_MS) });
  }
}
