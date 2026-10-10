import type { Server, Socket } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents, SessionUser } from '@classpulse/shared';

export interface LiveMembership {
  sessionId: string;
  role: 'host' | 'player';
  participantId: string | null;
}

export interface SocketData {
  /** Set by the handshake middleware from the session cookie — the only source of identity. */
  user: SessionUser;
  live: LiveMembership | null;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface InterServerEvents {}

export type AppServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
export type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
