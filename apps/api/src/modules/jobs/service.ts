import type { Logger } from 'pino';

import type { Clock } from '../../clock';
import type { Notifier } from '../../push/notify';
import type { DevicesRepo } from '../../repos/devices';
import type { EldersRepo } from '../../repos/elders';
import type { EventsService } from '../events/service';
import type { MissedTasksJob } from './missedTasks';

interface Deps {
  elders: EldersRepo;
  devices: DevicesRepo;
  events: EventsService;
  missedTasks: MissedTasksJob;
  notifier: Notifier;
  now: Clock;
  logger: Logger;
}

/** A tracker silent for longer than this is reported offline. */
export const DEVICE_OFFLINE_AFTER_MIN = 15;

export interface JobsSummary {
  missedTasks: number;
  devicesOffline: number;
}

export function createJobsService({ elders, devices, events, missedTasks, notifier, now, logger }: Deps) {
  let running = false;

  async function checkDevicesOffline(at: Date): Promise<number> {
    const cutoff = new Date(at.getTime() - DEVICE_OFFLINE_AFTER_MIN * 60_000);
    let reported = 0;
    for (const elder of await elders.listAll()) {
      try {
        for (const device of await devices.list(elder.id)) {
          const eventId = await devices.markOffline(elder.id, device.id, cutoff, at, (lastSeenAt) =>
            events.record(
              elder,
              { type: 'deviceOffline', payload: { deviceId: device.id, lastSeenAt: lastSeenAt?.toISOString() ?? null } },
              at,
            ),
          );
          if (eventId === null) continue;
          reported += 1;
          await notifier.deviceOffline(elder, eventId, device.label);
        }
      } catch (error) {
        logger.error({ err: error, elderId: elder.id }, 'device-offline check failed for elder');
      }
    }
    return reported;
  }

  return {
    checkDevicesOffline,

    /**
     * Every periodic job, once. Returns null instead of starting when a previous run is still going,
     * so the scheduler and the HTTP trigger can never overlap.
     */
    async runAll(at: Date = now()): Promise<JobsSummary | null> {
      if (running) return null;
      running = true;
      try {
        const missed = await missedTasks.run(at);
        const offline = await checkDevicesOffline(at);
        return { missedTasks: missed.length, devicesOffline: offline };
      } finally {
        running = false;
      }
    },
  };
}

export type JobsService = ReturnType<typeof createJobsService>;
