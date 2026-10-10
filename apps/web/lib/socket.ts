'use client';
import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@classpulse/shared';

export type ClassPulseSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

/**
 * Same-origin in production (Caddy routes /socket.io to the API). In development
 * set NEXT_PUBLIC_SOCKET_URL=http://localhost:5000 — the session cookie is sent
 * because cookies are scoped by host, not port.
 */
export function connectSocket(): ClassPulseSocket {
  const url = process.env.NEXT_PUBLIC_SOCKET_URL || undefined;
  return io(url ?? '', {
    path: '/socket.io',
    withCredentials: true,
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });
}

/** Emit with an acknowledgement as a promise (rejects on server error or timeout). */
export function emitWithAck<T>(
  socket: ClassPulseSocket,
  emit: (ack: (res: { ok: true; data: T } | { ok: false; error: { code: string; message: string } }) => void) => void,
  timeoutMs = 10_000,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('The server did not respond in time')), timeoutMs);
    emit((res) => {
      clearTimeout(timer);
      if (res.ok) resolve(res.data);
      else reject(new Error(res.error.message));
    });
  });
}
