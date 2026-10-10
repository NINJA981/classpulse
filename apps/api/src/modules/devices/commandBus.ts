/**
 * In-process signal used to wake long-polling devices as soon as a command is
 * created (instead of waiting for the next 1 s database poll). Commands are only
 * created by the API process, which is also the process serving the long-polls.
 */
import { EventEmitter } from 'node:events';

const bus = new EventEmitter();
bus.setMaxListeners(0);

export function signalDeviceCommand(deviceUuid: string): void {
  bus.emit(deviceUuid);
}

/** Resolves when the device is signalled, the timeout passes, or the abort signal fires. */
export function waitForDeviceSignal(deviceUuid: string, timeoutMs: number, abort?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (abort?.aborted) return resolve();
    const done = () => {
      clearTimeout(timer);
      bus.off(deviceUuid, done);
      abort?.removeEventListener('abort', done);
      resolve();
    };
    const timer = setTimeout(done, Math.max(0, timeoutMs));
    bus.on(deviceUuid, done);
    abort?.addEventListener('abort', done, { once: true });
  });
}
