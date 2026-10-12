/**
 * ffmpeg/ffprobe helpers. Uses the system binaries if FFMPEG_PATH/FFPROBE_PATH are
 * set (Docker image installs them), otherwise the bundled static builds.
 *
 * Every invocation reads its input with INPUT_GUARD: local files only (no http/tcp/udp/...) and only
 * plain audio/video container demuxers. Without it, a DASH/HLS manifest or concat script uploaded as
 * "lecture.mp3" makes ffmpeg fetch URLs from inside the server (blind SSRF).
 */
import { spawn } from 'node:child_process';
import { open, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { AppError } from './errors.js';

const require = createRequire(import.meta.url);

function resolveBinary(envVar: string, pkg: string, pick: (mod: unknown) => string | null): string {
  const fromEnv = process.env[envVar];
  if (fromEnv) return fromEnv;
  try {
    const p = pick(require(pkg));
    if (p) return p;
  } catch {
    /* fall through */
  }
  return envVar === 'FFMPEG_PATH' ? 'ffmpeg' : 'ffprobe';
}

const FFMPEG = resolveBinary('FFMPEG_PATH', 'ffmpeg-static', (m) => m as string | null);
const FFPROBE = resolveBinary('FFPROBE_PATH', 'ffprobe-static', (m) => (m as { path?: string }).path ?? null);

function run(bin: string, args: string[], timeoutMs = 10 * 60_000): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d: Buffer) => (stdout += d.toString()));
    child.stderr.on('data', (d: Buffer) => {
      stderr += d.toString();
      if (stderr.length > 20_000) stderr = stderr.slice(-20_000);
    });
    const timer = setTimeout(() => child.kill('SIGKILL'), timeoutMs);
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${bin} exited with code ${code}: ${stderr.split('\n').slice(-5).join(' ').trim()}`));
    });
  });
}

/**
 * Demuxers ffmpeg may use for user audio. A demuxer whose name list (e.g. "mov,mp4,m4a,3gp,3g2,mj2",
 * "matroska,webm") shares any entry with this list is allowed; dash, hls, concat, image2, lavfi, ... are not.
 */
export const SAFE_DEMUXERS = 'mp3,wav,mov,mp4,m4a,3gp,3g2,mj2,ogg,matroska,webm,aac,flac,mpeg';

/** Input options placed before every `-i`: read local files only, with safe demuxers only. */
export const INPUT_GUARD: readonly string[] = ['-protocol_whitelist', 'file', '-format_whitelist', SAFE_DEMUXERS];

/** 16 kHz mono 16-bit PCM: bytes per second of a normalized WAV. */
export const WAV_BYTES_PER_SEC = 32_000;
const WAV_HEADER_BYTES = 44;

const notAudio = () => new AppError('UNSUPPORTED_MEDIA_TYPE', 'The file could not be read as audio');

/**
 * Cheap content sniff before ffmpeg sees the file: true when the first bytes match an audio container we
 * accept (WAV, MP3 / ADTS AAC, MP4/M4A/3GP/MOV, Ogg/Opus, WebM/Matroska, FLAC, MPEG-PS). Text files such
 * as playlists, manifests and concat scripts never match.
 */
export function looksLikeAudioContainer(head: Buffer): boolean {
  if (head.length < 4) return false;
  const ascii = (start: number, end: number) => head.subarray(start, end).toString('latin1');
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WAVE') return true;
  if (ascii(0, 3) === 'ID3') return true; // MP3 (or AAC) with an ID3v2 tag
  if (head[0] === 0xff && (head[1]! & 0xe0) === 0xe0) return true; // MPEG audio / ADTS AAC frame sync
  if (ascii(0, 4) === 'OggS' || ascii(0, 4) === 'fLaC') return true;
  if (head[0] === 0x1a && head[1] === 0x45 && head[2] === 0xdf && head[3] === 0xa3) return true; // EBML: WebM / Matroska
  if (head[0] === 0x00 && head[1] === 0x00 && head[2] === 0x01 && head[3] === 0xba) return true; // MPEG-PS pack header
  // ISO BMFF / QuickTime: a box type at offset 4 (ftyp first; old QuickTime files may start with another box).
  return head.length >= 8 && ['ftyp', 'moov', 'mdat', 'wide', 'free', 'skip', 'pnot'].includes(ascii(4, 8));
}

/** Throws UNSUPPORTED_MEDIA_TYPE unless the file starts like an accepted audio container. */
export async function assertAudioContainer(inputPath: string): Promise<void> {
  const fh = await open(inputPath, 'r');
  try {
    const head = Buffer.alloc(12);
    const { bytesRead } = await fh.read(head, 0, head.length, 0);
    if (!looksLikeAudioContainer(head.subarray(0, bytesRead))) throw notAudio();
  } finally {
    await fh.close();
  }
}

/**
 * Container duration in seconds; null when the file is readable audio but its header has no duration
 * (e.g. browser MediaRecorder WebM). Throws UNSUPPORTED_MEDIA_TYPE when ffprobe cannot read the file.
 */
export async function probeAudioDurationSec(inputPath: string): Promise<number | null> {
  let stdout: string;
  try {
    ({ stdout } = await run(FFPROBE, [
      '-v', 'error',
      ...INPUT_GUARD,
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      inputPath,
    ], 60_000));
  } catch {
    throw notAudio();
  }
  const value = stdout.trim();
  if (value === 'N/A') return null;
  const duration = Number.parseFloat(value);
  if (!Number.isFinite(duration) || duration <= 0) throw notAudio();
  return duration;
}

/** Duration in seconds, or throws AppError(UNSUPPORTED_MEDIA_TYPE) if the file is not decodable audio. */
export async function probeDurationSec(inputPath: string): Promise<number> {
  const duration = await probeAudioDurationSec(inputPath);
  if (duration === null) throw notAudio();
  return duration;
}

/**
 * Transcode any supported audio file to 16 kHz mono 16-bit PCM WAV (the STT input format).
 * `maxSec` stops decoding after that many seconds, whatever the container claims.
 */
export async function normalizeToWav(inputPath: string, outputPath: string, opts: { maxSec?: number } = {}): Promise<void> {
  const limit = opts.maxSec && opts.maxSec > 0 ? ['-t', String(opts.maxSec)] : [];
  try {
    await run(FFMPEG, [
      '-hide_banner', '-loglevel', 'error', '-y',
      ...INPUT_GUARD,
      '-i', inputPath,
      ...limit,
      '-vn', '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le', outputPath,
    ]);
  } catch {
    throw new AppError('UNSUPPORTED_MEDIA_TYPE', 'The audio file could not be converted. Upload MP3, WAV, M4A, OGG or WEBM audio.');
  }
}

/**
 * Exact length of a WAV written by normalizeToWav, from its size (16 kHz mono 16-bit). This is the
 * authoritative duration for quotas: it is what was decoded, not what the uploaded container claims.
 */
export async function normalizedWavDurationSec(wavPath: string): Promise<number> {
  const { size } = await stat(wavPath);
  return Math.round((Math.max(0, size - WAV_HEADER_BYTES) / WAV_BYTES_PER_SEC) * 1000) / 1000;
}

/** Cut a segment of a WAV file (used to split long audio for STT). */
export async function sliceWav(inputPath: string, outputPath: string, startSec: number, durationSec: number): Promise<void> {
  await run(FFMPEG, [
    '-hide_banner', '-loglevel', 'error', '-y',
    ...INPUT_GUARD,
    '-ss', String(startSec), '-t', String(durationSec),
    '-i', inputPath, '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le', outputPath,
  ]);
}
