/** Fixtures shared by the devices and recordings tests. */
import { createHash } from 'node:crypto';
import { anon, as, createWorld } from './helpers.js';

export type World = Awaited<ReturnType<typeof createWorld>>;

export interface ProvisionedDevice {
  id: string;
  deviceId: string;
  key: string;
  headers: Record<string, string>;
}

let counter = 0;

export async function issueToken(world: World, roomId = world.room.id, name = 'Room device'): Promise<string> {
  const res = await as(world.admin).post('/api/admin/devices/enrollment-tokens').send({ roomId, name });
  if (res.status !== 201) throw new Error(`token issue failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.token as string;
}

/** Register a device in the world's room and send one heartbeat so it is online. */
export async function provisionDevice(world: World, opts: { roomId?: string; online?: boolean } = {}): Promise<ProvisionedDevice> {
  const token = await issueToken(world, opts.roomId);
  const deviceId = `rpi-test-${process.pid}-${++counter}`;
  const reg = await anon().post('/api/devices/register').send({ enrollmentToken: token, deviceId, agentVersion: '2.0.0' });
  if (reg.status !== 201) throw new Error(`register failed: ${reg.status} ${JSON.stringify(reg.body)}`);
  const key = reg.body.deviceKey as string;
  const headers = { 'X-Device-Id': deviceId, 'X-Device-Key': key };
  if (opts.online !== false) await heartbeat(headers);
  const list = await as(world.admin).get('/api/admin/devices');
  const row = (list.body as { id: string; deviceId: string }[]).find((d) => d.deviceId === deviceId)!;
  return { id: row.id, deviceId, key, headers };
}

export function heartbeat(headers: Record<string, string>, status: 'idle' | 'recording' | 'uploading' | 'error' = 'idle') {
  return anon()
    .post('/api/devices/me/heartbeat')
    .set(headers)
    .send({ status, micOk: true, micName: 'USB mic', cpuTempC: 48.5, cpuPct: 12, memPct: 30, diskFreeMb: 20000, backlogChunks: 0, agentVersion: '2.0.0' });
}

/** `seconds` of a 440 Hz tone as s16le mono 16 kHz PCM. */
export function pcm(seconds: number, phase = 0): Buffer {
  const samples = Math.round(16000 * seconds);
  const buf = Buffer.alloc(samples * 2);
  for (let i = 0; i < samples; i++) buf.writeInt16LE(Math.round(8000 * Math.sin((2 * Math.PI * 440 * (i + phase)) / 16000)), i * 2);
  return buf;
}

export const sha256 = (b: Buffer) => createHash('sha256').update(b).digest('hex');

export function putChunk(headers: Record<string, string>, sessionId: string, idx: number | string, body: Buffer, sha = sha256(body)) {
  return anon()
    .put(`/api/devices/me/sessions/${sessionId}/chunks/${idx}`)
    .set(headers)
    .set('Content-Type', 'application/octet-stream')
    .set('X-Chunk-SHA256', sha)
    .send(body);
}

export async function pollCommand(headers: Record<string, string>, wait = 0) {
  const res = await anon().get(`/api/devices/me/commands?wait=${wait}`).set(headers);
  if (res.status !== 200) throw new Error(`poll failed: ${res.status}`);
  return res.body.command as
    | { id: string; type: 'start_recording'; payload: { sessionId: string; lessonId: string } }
    | { id: string; type: 'stop_recording'; payload: { sessionId: string } }
    | null;
}

export function ack(headers: Record<string, string>, commandId: string, ok = true, error?: string) {
  return anon().post(`/api/devices/me/commands/${commandId}/ack`).set(headers).send({ ok, error });
}

/** Teacher starts a recording on the device and the device acks it. Returns the session id. */
export async function startedRecording(world: World, device: ProvisionedDevice) {
  const start = await as(world.teacher)
    .post('/api/recordings')
    .send({ sectionId: world.section.id, title: 'Light and shadows', subject: 'Science', deviceId: device.id });
  if (start.status !== 201) throw new Error(`start failed: ${start.status} ${JSON.stringify(start.body)}`);
  const command = await pollCommand(device.headers);
  if (!command || command.type !== 'start_recording') throw new Error('expected start command');
  const a = await ack(device.headers, command.id);
  if (a.status !== 204) throw new Error(`ack failed ${a.status}`);
  return { sessionId: start.body.id as string, lessonId: start.body.lessonId as string };
}
