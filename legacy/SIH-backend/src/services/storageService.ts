import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';

export interface StorageResult {
  url: string;
  key: string;
  storageProvider: 'local' | 's3' | 'r2';
}

class StorageService {
  private provider: 'local' | 's3' | 'r2';
  private localDir: string;
  private publicBaseUrl: string;

  constructor() {
    this.provider = (process.env.STORAGE_PROVIDER as any) || 'local';
    this.localDir = path.resolve(process.cwd(), process.env.UPLOADS_DIR || 'uploads');
    this.publicBaseUrl = process.env.PUBLIC_STORAGE_URL || '/uploads';

    if (!fs.existsSync(this.localDir)) {
      fs.mkdirSync(this.localDir, { recursive: true });
    }
  }

  /**
   * Saves a file to the active storage provider.
   */
  async saveFile(
    fileBufferOrStream: Buffer | Readable,
    filename: string,
    _mimeType: string = 'application/octet-stream'
  ): Promise<StorageResult> {
    const safeFilename = `${Date.now()}-${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

    if (this.provider === 's3' || this.provider === 'r2') {
      // In production S3/R2 mode, can be extended with @aws-sdk/client-s3 if keys are present
      const endpoint = process.env.S3_ENDPOINT;
      const bucket = process.env.S3_BUCKET_NAME;
      if (endpoint && bucket && process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY) {
        try {
          // @ts-ignore
          const s3Module: any = await import('@aws-sdk/client-s3');
          const { S3Client, PutObjectCommand } = s3Module;
          const s3 = new S3Client({
            endpoint,
            region: process.env.S3_REGION || 'auto',
            credentials: {
              accessKeyId: process.env.S3_ACCESS_KEY_ID,
              secretAccessKey: process.env.S3_SECRET_ACCESS_KEY
            }
          });

          const buffer = Buffer.isBuffer(fileBufferOrStream)
            ? fileBufferOrStream
            : await (async () => {
                const chunks: Buffer[] = [];
                for await (const chunk of fileBufferOrStream) {
                  chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
                }
                return Buffer.concat(chunks);
              })();

          await s3.send(
            new PutObjectCommand({
              Bucket: bucket,
              Key: safeFilename,
              Body: buffer,
              ContentType: _mimeType
            })
          );

          const publicUrl = process.env.S3_PUBLIC_DOMAIN
            ? `${process.env.S3_PUBLIC_DOMAIN.replace(/\/$/, '')}/${safeFilename}`
            : `${endpoint.replace(/\/$/, '')}/${bucket}/${safeFilename}`;

          return {
            url: publicUrl,
            key: safeFilename,
            storageProvider: this.provider
          };
        } catch (s3Error: any) {
          console.warn('[Storage] S3 upload failed, falling back to local persistent volume:', s3Error.message);
        }
      }
    }

    // Default / fallback: save to persistent local directory
    const targetPath = path.join(this.localDir, safeFilename);
    if (Buffer.isBuffer(fileBufferOrStream)) {
      await fs.promises.writeFile(targetPath, fileBufferOrStream);
    } else {
      const writeStream = fs.createWriteStream(targetPath);
      await pipeline(fileBufferOrStream, writeStream);
    }

    return {
      url: `${this.publicBaseUrl.replace(/\/$/, '')}/${safeFilename}`,
      key: safeFilename,
      storageProvider: 'local'
    };
  }

  /**
   * Returns the absolute path on disk for local files, or null if remote.
   */
  getLocalPath(keyOrUrl: string): string | null {
    const filename = path.basename(keyOrUrl);
    const candidate = path.join(this.localDir, filename);
    return fs.existsSync(candidate) ? candidate : null;
  }

  /**
   * Streams a file from storage.
   */
  createReadStream(keyOrUrl: string): Readable | null {
    const localPath = this.getLocalPath(keyOrUrl);
    if (localPath) {
      return fs.createReadStream(localPath);
    }
    return null;
  }
}

export const storageService = new StorageService();
