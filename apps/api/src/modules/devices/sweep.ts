/** STUB — replaced by the realtime/hardware workstream. Marks silent devices offline. */
import type { PeriodicTask } from '../../jobs/periodic.js';

export const deviceSweepTask: PeriodicTask = { name: 'device-sweep', intervalMs: 60_000, run: async () => undefined };
