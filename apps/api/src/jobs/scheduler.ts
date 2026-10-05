import cron from 'node-cron';
import type { Logger } from 'pino';

import type { JobsService } from '../modules/jobs/service';

/** Every 5 minutes (spec §4), plus the alert escalation every minute. Started from server.ts only, never from tests. */
export function startScheduler(jobs: JobsService, logger: Logger): { stop(): void } {
  const task = cron.schedule('*/5 * * * *', async () => {
    try {
      const summary = await jobs.runAll();
      if (!summary) logger.warn('previous job run still in progress; skipping this tick');
      else logger.info(summary, 'scheduled jobs finished');
    } catch (error) {
      logger.error({ err: error }, 'scheduled jobs failed');
    }
  });
  // Every minute: an unanswered SOS should reach the emergency contacts soon after ESCALATE_AFTER_MIN.
  const escalation = cron.schedule('* * * * *', async () => {
    try {
      const escalated = await jobs.escalateAlerts();
      if (escalated) logger.info({ alertsEscalated: escalated }, 'alerts escalated to emergency contacts');
    } catch (error) {
      logger.error({ err: error }, 'alert escalation failed');
    }
  });
  return {
    stop: () => {
      void task.stop();
      void escalation.stop();
    },
  };
}
