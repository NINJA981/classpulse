/**
 * Fire-and-forget `notify()` for job producers (lesson pipeline, resources queue, deploy watcher).
 * `notify()` never throws by contract; this is a second line of defence so a notification problem can never
 * change a job's outcome or its retry behaviour.
 */
import { logger } from '../lib/logger.js';
import { notify, type NotifyInput } from '../modules/notifications/notify.js';

type Notifier = (input: NotifyInput) => Promise<void> | void;
let override: Notifier | null = null;

/**
 * Tests: capture producer notifications instead of delivering them (vi.mock can't reach notify.js there,
 * because test/setup.ts loads the whole app first). Pass null to restore.
 */
export function setNotifierForTests(fn: Notifier | null): void {
  override = fn;
}

export function sendNotification(input: NotifyInput): void {
  const fail = (err: unknown) => logger.warn({ err, kind: input.kind }, 'Notification could not be sent');
  try {
    void Promise.resolve((override ?? notify)(input)).catch(fail);
  } catch (err) {
    fail(err);
  }
}
