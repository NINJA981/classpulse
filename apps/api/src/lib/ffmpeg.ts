/**
 * ffmpeg/ffprobe helpers. Uses the system binaries if FFMPEG_PATH/FFPROBE_PATH are
 * set (Docker image installs them), otherwise the bundled static builds.
 */
import { spawn } from 'node:child_process';
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

/** Duration in seconds, or throws AppError(BAD_REQUEST) if the file is not decodable audio. */
export async function probeDurationSec(inputPath: string): Promise<number> {
  try {
    const { stdout } = await run(FFPROBE, [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      inputPath,
    ], 60_000);
    const duration = Number.parseFloat(stdout.trim());
    if (!Number.isFinite(duration) || duration <= 0) throw new Error('no duration');
    return duration;
  } catch {
    throw new AppError('UNSUPPORTED_MEDIA_TYPE', 'The file could not be read as audio');
  }
}

/** Transcode any supported audio file to 16 kHz mono 16-bit PCM WAV (the STT input format). */
export async function normalizeToWav(inputPath: string, outputPath: string): Promise<void> {
  try {
    await run(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', '-i', inputPath, '-vn', '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le', outputPath]);
  } catch {
    throw new AppError('UNSUPPORTED_MEDIA_TYPE', 'The audio file could not be converted. Upload MP3, WAV, M4A, OGG or WEBM audio.');
  }
}

/** Cut a segment of a WAV file (used to split long audio for STT). */
export async function sliceWav(inputPath: string, outputPath: string, startSec: number, durationSec: number): Promise<void> {
  await run(FFMPEG, [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-ss', String(startSec), '-t', String(durationSec),
    '-i', inputPath, '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le', outputPath,
  ]);
}
