/**
 * Socket.IO server. Authenticates every connection from the `cp_session`
 * cookie (never from client-supplied ids), joins each socket to `user:<id>`
 * for personal notifications (lesson progress, recording updates) and wires
 * the live-quiz engine.
 */
import type { Server as HttpServer } from 'node:http';
import { parse as parseCookie } from 'cookie';
import { Server } from 'socket.io';
import { SESSION_COOKIE, type ServerToClientEvents } from '@classpulse/shared';
import { allowedOrigins } from '../config/env.js';
import { logger } from '../lib/logger.js';
import { resolveSession } from '../lib/session.js';
import { setLocalEmitter, subscribeToWorkerNotifications } from '../realtime/notify.js';
import { LiveQuizEngine } from './liveQuiz.js';
import type { AppServer } from './types.js';

export interface SocketHandle {
  readonly io: AppServer;
  close(): Promise<void>;
}

export const userRoom = (userId: string) => `user:${userId}`;

export function attachSockets(server: HttpServer): SocketHandle {
  const io: AppServer = new Server(server, {
    path: '/socket.io',
    cors: { origin: allowedOrigins, credentials: true },
    serveClient: false,
    maxHttpBufferSize: 64 * 1024,
    pingInterval: 20_000,
    pingTimeout: 20_000,
    // Browsers send cookies on cross-site WebSocket handshakes: refuse foreign origins.
    allowRequest: (req, cb) => {
      const origin = req.headers.origin;
      cb(null, !origin || allowedOrigins.includes(origin));
    },
  });

  io.use((socket, next) => {
    const header = socket.request.headers.cookie;
    const token = header ? parseCookie(header)[SESSION_COOKIE] : undefined;
    resolveSession(token)
      .then((user) => {
        if (!user) return next(new Error('UNAUTHENTICATED'));
        if (user.mustChangePassword) return next(new Error('PASSWORD_CHANGE_REQUIRED'));
        socket.data.user = user;
        socket.data.live = null;
        next();
      })
      .catch((err: unknown) => {
        logger.error({ err }, 'Socket authentication failed');
        next(new Error('INTERNAL'));
      });
  });

  const live = new LiveQuizEngine(io);

  io.on('connection', (socket) => {
    void socket.join(userRoom(socket.data.user.id));
    live.register(socket);
  });

  let active = true;
  const emit = <E extends 'lesson:progress' | 'recording:update'>(
    userId: string,
    event: E,
    payload: Parameters<ServerToClientEvents[E]>[0],
  ) => {
    if (!active) return;
    // The generic event/payload pair is checked by notifyUser's signature.
    (io.to(userRoom(userId)).emit as (ev: string, data: unknown) => boolean)(event, payload);
  };
  setLocalEmitter(emit);
  const unsubscribe = subscribeToWorkerNotifications(emit).catch((err: unknown) => {
    logger.error({ err }, 'Failed to subscribe to worker notifications');
    return async () => undefined;
  });

  return {
    io,
    close: async () => {
      active = false;
      live.close();
      await (await unsubscribe)();
      await new Promise<void>((resolve) => {
        io.close(() => resolve());
      });
    },
  };
}
