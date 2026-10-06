import type { Logger } from 'pino';

import type { Clock } from '../../clock';
import type { Notifier } from '../../push/notify';
import type { DevicesRepo } from '../../repos/devices';
import type { EldersRepo } from '../../repos/elders';
import type { EventsService } from '../events/service';
import type { DailySummaryJob } from './dailySummary';
import type { EscalationJob } from './escalation';
import type { MissedTasksJob } from './missedTasks';

interface Deps {
  elders: EldersRepo;
  devices: DevicesRepo;
  events: EventsService;
  missedTasks: MissedTasksJob;
  escalation: EscalationJob;
  dailySummary: DailySummaryJob;
  notifier: Notifier;
  now: Clock;
  logger: Logger;
}

/** A tracker silent for longer than this is reported offline. */
export const DEVICE_OFFLINE_AFTER_MIN = 15;

export interface JobsSummary {
  missedTasks: number;
  devicesOffline: number;
  alertsEscalated: number;
  dailySummaries: number;
}

export function createJobsService({ elders, devices, events, missedTasks, escalation, dailySummary, notifier, now, logger }: Deps) {
  let running = false;
  let escalating = false;

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
        const escalated = await escalation.run(at);
        const summaries = await dailySummary.run(at);
        return { missedTasks: missed.length, devicesOffline: offline, alertsEscalated: escalated, dailySummaries: summaries };
      } finally {
        running = false;
      }
    },

    /**
     * Only the alert escalation, which the scheduler runs every minute so contacts hear about an
     * unanswered SOS soon after ESCALATE_AFTER_MIN. Null when a previous escalation run is still going.
     */
    async escalateAlerts(at: Date = now()): Promise<number | null> {
      if (escalating) return null;
      escalating = true;
      try {
        return await escalation.run(at);
      } finally {
        escalating = false;
      }
    },
  };
}

export type JobsService = ReturnType<typeof createJobsService>;
