/**
 * Decompression-bomb checks for ZIP containers (DOCX) before a full parser touches them.
 *
 * `scanZip` reads only the central directory (cheap, no decompression) and rejects archives with too
 * many entries, too much declared uncompressed data, or an entry with a suspicious compression ratio.
 * `verifyZipInflation` then inflates every entry with a hard output cap, so an archive whose headers lie
 * about sizes is caught too. Both throw ZipLimitError for limit violations and ZipFormatError for
 * archives that are not well-formed. No relative imports: this module also runs inside the extraction
 * worker.
 */
import { inflateRawSync } from 'node:zlib';

export interface ZipLimits {
  /** Maximum total uncompressed size of all entries, in bytes. */
  maxTotalBytes: number;
  maxEntries: number;
  /** Maximum uncompressed/compressed ratio of one entry (checked for entries above `ratioMinBytes`). */
  maxRatio: number;
  /** Tiny entries (e.g. a block of zeros) can have a high ratio harmlessly; they are not ratio-checked. */
  ratioMinBytes: number;
}

export const DOCX_ZIP_LIMITS: ZipLimits = {
  maxTotalBytes: 50 * 1024 * 1024,
  maxEntries: 500,
  maxRatio: 100,
  ratioMinBytes: 256 * 1024,
};

export interface ZipEntry {
  name: string;
  method: number;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
}

export class ZipLimitError extends Error {
  override name = 'ZipLimitError';
}

export class ZipFormatError extends Error {
  override name = 'ZipFormatError';
}

const EOCD_SIG = 0x06054b50;
const CDH_SIG = 0x02014b50;
const LFH_SIG = 0x04034b50;
const EOCD_MIN = 22;
const MAX_COMMENT = 0xffff;

function findEndOfCentralDirectory(buf: Buffer): number {
  const stop = Math.max(0, buf.length - EOCD_MIN - MAX_COMMENT);
  for (let i = buf.length - EOCD_MIN; i >= stop; i--) {
    if (buf.readUInt32LE(i) === EOCD_SIG) return i;
  }
  throw new ZipFormatError('No end of central directory');
}

/** Central-directory scan; throws ZipLimitError / ZipFormatError. */
export function scanZip(buf: Buffer, limits: ZipLimits = DOCX_ZIP_LIMITS): ZipEntry[] {
  if (buf.length < EOCD_MIN) throw new ZipFormatError('Too small');
  const eocd = findEndOfCentralDirectory(buf);
  const totalEntries = buf.readUInt16LE(eocd + 10);
  const cdSize = buf.readUInt32LE(eocd + 12);
  const cdOffset = buf.readUInt32LE(eocd + 16);
  // ZIP64 markers: a Word document never needs them at our upload size.
  if (totalEntries === 0xffff || cdSize === 0xffffffff || cdOffset === 0xffffffff) throw new ZipLimitError('ZIP64 archive');
  if (totalEntries > limits.maxEntries) throw new ZipLimitError(`Too many entries (${totalEntries})`);
  if (cdOffset + cdSize > eocd) throw new ZipFormatError('Central directory out of range');

  const entries: ZipEntry[] = [];
  let total = 0;
  let p = cdOffset;
  const end = cdOffset + cdSize;
  while (p < end) {
    if (p + 46 > end || buf.readUInt32LE(p) !== CDH_SIG) throw new ZipFormatError('Bad central directory header');
    const method = buf.readUInt16LE(p + 10);
    const compressedSize = buf.readUInt32LE(p + 20);
    const uncompressedSize = buf.readUInt32LE(p + 24);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localHeaderOffset = buf.readUInt32LE(p + 42);
    const name = buf.subarray(p + 46, p + 46 + nameLen).toString('utf8');
    if (compressedSize === 0xffffffff || uncompressedSize === 0xffffffff || localHeaderOffset === 0xffffffff) {
      throw new ZipLimitError('ZIP64 entry');
    }
    entries.push({ name, method, compressedSize, uncompressedSize, localHeaderOffset });
    if (entries.length > limits.maxEntries) throw new ZipLimitError(`Too many entries (> ${limits.maxEntries})`);
    total += uncompressedSize;
    if (total > limits.maxTotalBytes) throw new ZipLimitError(`Expands to more than ${limits.maxTotalBytes} bytes`);
    if (uncompressedSize > limits.ratioMinBytes && uncompressedSize / Math.max(1, compressedSize) > limits.maxRatio) {
      throw new ZipLimitError(`Entry ${name.slice(0, 80)} has a compression ratio above ${limits.maxRatio}`);
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

/**
 * Inflate every entry with its declared size as a hard cap (the bytes are discarded). Catches archives
 * whose headers understate the real size. Only "stored" and "deflate" entries are accepted.
 */
export function verifyZipInflation(buf: Buffer, entries: ZipEntry[]): void {
  for (const e of entries) {
    const h = e.localHeaderOffset;
    if (h + 30 > buf.length || buf.readUInt32LE(h) !== LFH_SIG) throw new ZipFormatError('Bad local file header');
    const start = h + 30 + buf.readUInt16LE(h + 26) + buf.readUInt16LE(h + 28);
    const data = buf.subarray(start, start + e.compressedSize);
    if (data.length !== e.compressedSize) throw new ZipFormatError('Entry data out of range');
    if (e.method === 0) {
      if (e.compressedSize !== e.uncompressedSize) throw new ZipLimitError('Stored entry size mismatch');
    } else if (e.method === 8) {
      try {
        // Output beyond the declared size means the header lied.
        inflateRawSync(data, { maxOutputLength: Math.max(1, e.uncompressedSize) });
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === 'ERR_BUFFER_TOO_LARGE' || err instanceof RangeError) {
          throw new ZipLimitError(`Entry ${e.name.slice(0, 80)} is larger than declared`);
        }
        throw new ZipFormatError('Corrupt entry');
      }
    } else {
      throw new ZipFormatError(`Unsupported compression method ${e.method}`);
    }
  }
}
