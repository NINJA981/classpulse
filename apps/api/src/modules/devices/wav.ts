/**
 * Assemble raw s16le / 16 kHz / mono PCM chunk files into one WAV file by
 * writing a RIFF header and streaming the chunks in order. Pure Node (no ffmpeg),
 * so a 6-hour recording (~690 MB) never sits in memory.
 *
 * Used instead of lib/ffmpeg.ts#pcmChunksToWav, whose argument order makes
 * ffmpeg reject the concat list (`-f s16le` overrides `-f concat`).
 */
import { createReadStream, createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { DEVICE_AUDIO_FORMAT } from '@classpulse/shared';

const BITS = 16;

export function wavHeader(dataBytes: number, sampleRate: number = DEVICE_AUDIO_FORMAT.sampleRate, channels: number = DEVICE_AUDIO_FORMAT.channels): Buffer {
  const blockAlign = (channels * BITS) / 8;
  const h = Buffer.alloc(44);
  h.write('RIFF', 0, 'ascii');
  h.writeUInt32LE(36 + dataBytes, 4);
  h.write('WAVE', 8, 'ascii');
  h.write('fmt ', 12, 'ascii');
  h.writeUInt32LE(16, 16); // PCM fmt chunk size
  h.writeUInt16LE(1, 20); // PCM
  h.writeUInt16LE(channels, 22);
  h.writeUInt32LE(sampleRate, 24);
  h.writeUInt32LE(sampleRate * blockAlign, 28);
  h.writeUInt16LE(blockAlign, 32);
  h.writeUInt16LE(BITS, 34);
  h.write('data', 36, 'ascii');
  h.writeUInt32LE(dataBytes, 40);
  return h;
}

/** Returns the PCM duration in seconds. */
export async function assemblePcmToWav(chunkPaths: string[], outPath: string): Promise<number> {
  let dataBytes = 0;
  for (const p of chunkPaths) dataBytes += (await fs.stat(p)).size;
  const out = createWriteStream(outPath);
  try {
    await new Promise<void>((resolve, reject) => out.write(wavHeader(dataBytes), (err) => (err ? reject(err) : resolve())));
    for (const p of chunkPaths) await pipeline(createReadStream(p), out, { end: false });
  } finally {
    await new Promise<void>((resolve) => out.end(() => resolve()));
  }
  const bytesPerSec = DEVICE_AUDIO_FORMAT.sampleRate * DEVICE_AUDIO_FORMAT.channels * (BITS / 8);
  return dataBytes / bytesPerSec;
}
