import { DAILY_SUMMARY_TIME, localDateOf, localTimeOf } from '@aurelia/shared';
import type { Logger } from 'pino';

import type { Clock } from '../../clock';
import type { Notifier } from '../../push/notify';
import type { EldersRepo } from '../../repos/elders';
import type { UsersRepo } from '../../repos/users';
import type { AssistantService } from '../assistant/service';
import type { EventsService } from '../events/service';

interface Deps {
  elders: EldersRepo;
  users: UsersRepo;
  assistant: AssistantService;
  events: EventsService;
  notifier: Notifier;
  now: Clock;
  logger: Logger;
}

/**
 * "Insights da Aurélia": once the elder's evening comes (DAILY_SUMMARY_TIME), Aurélia summarises the
 * day for the caregivers who turned it on. One summary per elder per day; a day with nothing to tell
 * gets none. Runs with the other periodic jobs; returns how many summaries were written.
 */
export function createDailySummaryJob({ elders, users, assistant, events, notifier, now, logger }: Deps) {
  return {
    async run(at: Date = now()): Promise<number> {
      let written = 0;
      for (const elder of await elders.listAll()) {
        if (localTimeOf(at, elder.timezone) < DAILY_SUMMARY_TIME) continue;
        const date = localDateOf(at, elder.timezone);
        try {
          const caregivers = await users.getMany(elder.caregiverIds);
          if (!caregivers.some((user) => user.settings.notifyAssistantInsights)) continue;
          if (!(await elders.claimDailySummary(elder.id, date))) continue;
          let text: string | null;
          try {
            text = await assistant.summarizeDay(elder, at);
          } catch (error) {
            // Leave the day open, so the next run tries again.
            await elders.releaseDailySummary(elder.id);
            throw error;
          }
          if (text === null) continue;
          const event = await events.append(elder, { type: 'dailySummary', payload: { text } }, at);
          await notifier.dailySummary(elder, event.id, text);
          written += 1;
        } catch (error) {
          logger.warn({ err: error, elderId: elder.id }, 'daily summary failed for elder');
        }
      }
      return written;
    },
  };
}

export type DailySummaryJob = ReturnType<typeof createDailySummaryJob>;
