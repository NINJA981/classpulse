/** STUB — replaced by the realtime workstream. Attaches Socket.IO to the HTTP server. */
import type { Server as HttpServer } from 'node:http';

export interface SocketHandle {
  close(): Promise<void>;
}

export function attachSockets(_server: HttpServer): SocketHandle {
  return { close: async () => undefined };
}
