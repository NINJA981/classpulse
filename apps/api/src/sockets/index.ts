/**
 * Socket.IO server. Authenticates every connection from the `cp_session`
 * cookie (never from client-supplied ids), joins each socket to `user:<id>`
 * for personal notifications (lesson progress, recording updates) and
 * `school:<id>`, and wires the live-quiz engine.
 *
 * Sessions stay revocable: every connected socket is re-validated every minute (and at once
 * when this process changes a school's state or the platform settings), so a password reset,
 * disabled account, suspended school or maintenance drops the socket. Each socket's events are
 * rate limited, and a user keeps at most MAX_SOCKETS_PER_USER sockets.
 */
import type { Server as HttpServer } from 'node:http';
import { parse as parseCookie } from 'cookie';
import { Server } from 'socket.io';
import { SESSION_COOKIE, type Ack, type ServerToClientEvents, type SessionUser } from '@classpulse/shared';
import { allowedOrigins, isProd } from '../config/env.js';
import { logger } from '../lib/logger.js';
import { isOwnOrigin } from '../lib/origins.js';
import { onPlatformStateChange } from '../lib/platformState.js';
import { resolveSession } from '../lib/session.js';
import { setLocalEmitter, subscribeToWorkerNotifications } from '../realtime/notify.js';
import { LiveQuizEngine } from './liveQuiz.js';
import { MAX_SOCKETS_PER_USER, SOCKET_ABUSE_LIMIT, SOCKET_EVENT_LIMIT, SOCKET_REVALIDATE_MS, TokenBucket } from './rateLimit.js';
import { schoolRoom, setSocketServer, userRoom } from './sessions.js';
import type { AppServer, AppSocket } from './types.js';

export interface SocketHandle {
  readonly io: AppServer;
  close(): Promise<void>;
}

export { userRoom } from './sessions.js';

const RATE_LIMITED: Ack<never> = {
  ok: false,
  error: { code: 'RATE_LIMITED', message: 'Too many requests. Please slow down.' },
};

/** Refuse events past the socket's token bucket; drop the socket when the flood continues. */
function limitEvents(socket: AppSocket): void {
  const events = new TokenBucket(SOCKET_EVENT_LIMIT);
  const abuse = new TokenBucket(SOCKET_ABUSE_LIMIT);
  socket.use((packet, next) => {
    if (events.take()) return next();
    const ack = packet[packet.length - 1];
    if (typeof ack === 'function') (ack as (res: Ack<never>) => void)(RATE_LIMITED);
    if (!abuse.take()) {
      logger.warn({ userId: socket.data.user.id }, 'Socket dropped for flooding events');
      socket.disconnect(true);
    }
  });
}

/** Keep at most MAX_SOCKETS_PER_USER sockets per user: drop the oldest ones. */
function capUserSockets(io: AppServer, userId: string): void {
  const ids = io.of('/').adapter.rooms.get(userRoom(userId));
  if (!ids || ids.size <= MAX_SOCKETS_PER_USER) return;
  const excess = [...ids].slice(0, ids.size - MAX_SOCKETS_PER_USER); // insertion order: oldest first
  for (const id of excess) io.of('/').sockets.get(id)?.disconnect(true);
}

/**
 * Re-check the session behind each socket (one lookup per distinct token) and drop the ones
 * that are no longer valid. A lookup that fails (database down) keeps the socket.
 */
export async function revalidateSockets(sockets: Iterable<AppSocket>): Promise<number> {
  const checks = new Map<string, Promise<SessionUser | null | undefined>>();
  let dropped = 0;
  for (const socket of [...sockets]) {
    const token = socket.data.token;
    let check = checks.get(token);
    if (!check) {
      check = resolveSession(token).catch((err: unknown) => {
        logger.warn({ err }, 'Socket session re-check failed');
        return undefined;
      });
      checks.set(token, check);
    }
    const user = await check;
    if (user === undefined || !socket.connected) continue;
    if (!user || user.id !== socket.data.user.id || user.mustChangePassword) {
      socket.disconnect(true);
      dropped++;
    }
  }
  return dropped;
}

export function attachSockets(server: HttpServer): SocketHandle {
  const io: AppServer = new Server(server, {
    path: '/socket.io',
    // Same-origin in production (no CORS). Development may connect cross-port (NEXT_PUBLIC_SOCKET_URL).
    ...(isProd ? {} : { cors: { origin: allowedOrigins, credentials: true } }),
    serveClient: false,
    maxHttpBufferSize: 64 * 1024,
    pingInterval: 20_000,
    pingTimeout: 20_000,
    // Browsers send cookies on cross-site WebSocket handshakes: only the page's own origin may connect.
    allowRequest: (req, cb) => {
      const origin = req.headers.origin;
      const forwardedHost = req.headers['x-forwarded-host'];
      const hosts = [req.headers.host, (Array.isArray(forwardedHost) ? forwardedHost[0] : forwardedHost)?.split(',')[0]];
      cb(null, origin === undefined || isOwnOrigin(origin, hosts));
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
        socket.data.token = token!;
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
    const user = socket.data.user;
    void socket.join([userRoom(user.id), schoolRoom(user.institutionId)]);
    capUserSockets(io, user.id);
    limitEvents(socket);
    live.register(socket);
  });

  setSocketServer(io);
  const revalidate = (sockets: Iterable<AppSocket>) =>
    revalidateSockets(sockets)
      .then((dropped) => {
        if (dropped) logger.info({ dropped }, 'Dropped sockets whose session is no longer valid');
      })
      .catch((err: unknown) => logger.warn({ err }, 'Socket re-validation failed'));
  let periodicRunning = false;
  const revalidateTimer = setInterval(() => {
    if (periodicRunning) return;
    periodicRunning = true;
    void revalidate(io.of('/').sockets.values()).finally(() => {
      periodicRunning = false;
    });
  }, SOCKET_REVALIDATE_MS);
  revalidateTimer.unref();
  // A school suspended (or maintenance switched on) from this process: act now, not in a minute.
  const stopListening = onPlatformStateChange((institutionId) => {
    if (institutionId === null) return void revalidate(io.of('/').sockets.values());
    const ids = [...(io.of('/').adapter.rooms.get(schoolRoom(institutionId)) ?? [])];
    void revalidate(ids.flatMap((id) => io.of('/').sockets.get(id) ?? []));
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
      clearInterval(revalidateTimer);
      stopListening();
      setSocketServer(null);
      live.close();
      await (await unsubscribe)();
      await new Promise<void>((resolve) => {
        io.close(() => resolve());
      });
    },
  };
}
