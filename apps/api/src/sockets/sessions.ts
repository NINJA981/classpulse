/**
 * Socket revocation helpers usable from any module without importing the live-quiz engine.
 *
 * Every authenticated socket joins `user:<id>` and `school:<institutionId>`. The API process
 * registers its Socket.IO server here; in the worker (no sockets) every helper is a no-op.
 * Disconnecting is a fast path only: sockets/index.ts also re-validates every connected socket
 * periodically, so a session revoked from another process is dropped within a minute.
 */
import type { AppServer } from './types.js';

export const userRoom = (userId: string) => `user:${userId}`;
export const schoolRoom = (institutionId: string) => `school:${institutionId}`;

let server: AppServer | null = null;

export function setSocketServer(io: AppServer | null): void {
  server = io;
}

/** Drop every socket of a user (disabled, deleted, password reset, sessions revoked). */
export function disconnectUserSockets(userId: string): void {
  server?.in(userRoom(userId)).disconnectSockets(true);
}

/** Drop every socket of a school's users (school suspended or deleted). */
export function disconnectSchoolSockets(institutionId: string): void {
  server?.in(schoolRoom(institutionId)).disconnectSockets(true);
}
