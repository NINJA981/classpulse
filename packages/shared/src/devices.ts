import { z } from 'zod';
import { Id, Language, text, type IsoDate } from './common.js';

/* ============================================================================
 * Raspberry Pi classroom device contract.
 *
 * All traffic is outbound from the device (no inbound ports):
 *   POST /api/devices/register                      { enrollmentToken, deviceId, agentVersion } -> { deviceKey }
 *   POST /api/devices/me/heartbeat                  DeviceHeartbeatInput -> { serverTime }
 *   GET  /api/devices/me/commands?wait=25           -> { command: DeviceCommand | null }   (long-poll)
 *   POST /api/devices/me/commands/:id/ack           { ok, error? }
 *   GET  /api/devices/me/sessions/:sessionId/chunks -> { received: number[] }
 *   PUT  /api/devices/me/sessions/:sessionId/chunks/:idx   raw PCM body (application/octet-stream)
 *        headers: X-Chunk-SHA256: <hex>
 *   POST /api/devices/me/sessions/:sessionId/finalize { totalChunks, durationSec }
 *
 * Device auth headers: `X-Device-Id` + `X-Device-Key`.
 * ========================================================================= */

export const DEVICE_ID_HEADER = 'x-device-id';
export const DEVICE_KEY_HEADER = 'x-device-key';
export const CHUNK_SHA256_HEADER = 'x-chunk-sha256';

/** Audio format every device must upload: signed 16-bit little-endian PCM, mono, 16 kHz. */
export const DEVICE_AUDIO_FORMAT = {
  encoding: 's16le',
  sampleRate: 16000,
  channels: 1,
  chunkSeconds: 60,
} as const;
/** Bytes per full chunk (16000 samples/s * 2 bytes * 60 s). */
export const DEVICE_CHUNK_MAX_BYTES = 16000 * 2 * 60;
export const DEVICE_MAX_CHUNKS_PER_SESSION = 6 * 60; // 6 hours

export const DeviceIdString = z
  .string()
  .trim()
  .regex(/^[a-z0-9][a-z0-9-]{2,63}$/, 'Device IDs are 3-64 chars: lowercase letters, digits, dashes');

export const DeviceRegisterInput = z.object({
  enrollmentToken: z.string().trim().min(16).max(128),
  deviceId: DeviceIdString,
  agentVersion: z.string().trim().max(40),
});
export type DeviceRegisterInput = z.infer<typeof DeviceRegisterInput>;

export interface DeviceRegisterResponse {
  deviceId: string;
  deviceKey: string;
  room: { id: Id; name: string };
}

export const DeviceStatus = z.enum(['online', 'offline', 'recording', 'error']);
export type DeviceStatus = z.infer<typeof DeviceStatus>;

export const DeviceHeartbeatInput = z.object({
  status: z.enum(['idle', 'recording', 'uploading', 'error']),
  micOk: z.boolean(),
  micName: z.string().trim().max(200).nullable().optional(),
  cpuTempC: z.number().min(-50).max(150).nullable().optional(),
  cpuPct: z.number().min(0).max(100).nullable().optional(),
  memPct: z.number().min(0).max(100).nullable().optional(),
  diskFreeMb: z.number().min(0).nullable().optional(),
  backlogChunks: z.number().int().min(0).default(0),
  activeSessionId: Id.nullable().optional(),
  agentVersion: z.string().trim().max(40),
  lastError: z.string().trim().max(500).nullable().optional(),
});
export type DeviceHeartbeatInput = z.infer<typeof DeviceHeartbeatInput>;

export type DeviceCommand =
  | { id: Id; type: 'start_recording'; payload: { sessionId: Id; lessonId: Id } }
  | { id: Id; type: 'stop_recording'; payload: { sessionId: Id } };

export const DeviceCommandAckInput = z.object({
  ok: z.boolean(),
  error: z.string().trim().max(500).nullable().optional(),
});
export type DeviceCommandAckInput = z.infer<typeof DeviceCommandAckInput>;

export const FinalizeRecordingInput = z.object({
  totalChunks: z.number().int().min(1).max(DEVICE_MAX_CHUNKS_PER_SESSION),
  durationSec: z.number().min(0),
});
export type FinalizeRecordingInput = z.infer<typeof FinalizeRecordingInput>;

/* ----------------------------------------------------------------------------
 * Admin / teacher views of devices
 * ------------------------------------------------------------------------- */

export interface DeviceSystemStats {
  micOk: boolean;
  micName: string | null;
  cpuTempC: number | null;
  cpuPct: number | null;
  memPct: number | null;
  diskFreeMb: number | null;
  backlogChunks: number;
  lastError: string | null;
}

export interface Device {
  id: Id;
  deviceId: string;
  name: string;
  room: { id: Id; name: string };
  status: DeviceStatus;
  agentVersion: string | null;
  lastHeartbeatAt: IsoDate | null;
  ipAddress: string | null;
  stats: DeviceSystemStats | null;
  activeRecordingId: Id | null;
  createdAt: IsoDate;
}

export const CreateEnrollmentTokenInput = z.object({
  roomId: Id,
  name: text(80),
});
export type CreateEnrollmentTokenInput = z.infer<typeof CreateEnrollmentTokenInput>;

export interface EnrollmentToken {
  token: string;
  name: string;
  room: { id: Id; name: string };
  expiresAt: IsoDate;
}

/* ----------------------------------------------------------------------------
 * Recording sessions (teacher starts/stops a class recording on a room device)
 * ------------------------------------------------------------------------- */

export const RECORDING_STATUSES = [
  'pending', // start command issued, device has not acked
  'recording',
  'stopping', // stop command issued; device draining its upload backlog
  'finalized', // audio assembled, generation queued
  'failed',
  'cancelled',
] as const;
export const RecordingStatus = z.enum(RECORDING_STATUSES);
export type RecordingStatus = z.infer<typeof RecordingStatus>;

export const StartRecordingInput = z.object({
  sectionId: Id,
  title: text(200),
  subject: text(120),
  language: Language.default('en-IN'),
  /** Optional explicit device; defaults to the online device in the section's room. */
  deviceId: Id.optional(),
});
export type StartRecordingInput = z.infer<typeof StartRecordingInput>;

export interface RecordingSession {
  id: Id;
  lessonId: Id;
  device: { id: Id; name: string; status: DeviceStatus };
  status: RecordingStatus;
  chunksReceived: number;
  expectedChunks: number | null;
  startedAt: IsoDate | null;
  stoppedAt: IsoDate | null;
  failureReason: string | null;
  createdAt: IsoDate;
}
