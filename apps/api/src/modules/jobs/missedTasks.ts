import { addDays, instantOf, localDateOf, weekdayOf, type LocalDate, type Occurrence } from '@aurelia/shared';
import type { Logger } from 'pino';

import type { Clock } from '../../clock';
import type { ElderDoc } from '../../repos';
import type { Notifier } from '../../push/notify';
import type { EldersRepo } from '../../repos/elders';
import type { OccurrencesRepo } from '../../repos/occurrences';
import type { RoutinesRepo } from '../../repos/routines';
import { toOccurrence } from '../agenda/serialize';
import type { EventsService } from '../events/service';

interface Deps {
  elders: EldersRepo;
  routines: RoutinesRepo;
  occurrences: OccurrencesRepo;
  events: EventsService;
  notifier: Notifier;
  now: Clock;
  logger: Logger;
}

/** What the job created, so the caller can notify caregivers. */
export interface MissedTask {
  elder: ElderDoc;
  eventId: string;
  routineName: string;
  occurrence: Occurrence;
}

const MINUTE_MS = 60_000;

export function createMissedTasksJob({ elders, routines, occurrences, events, notifier, now, logger }: Deps) {
  async function runForElder(elder: ElderDoc, current: Date): Promise<MissedTask[]> {
    const today = localDateOf(current, elder.timezone);
    // Yesterday too, so a task due just before midnight is still caught by a run just after it.
    const dates: LocalDate[] = [addDays(today, -1), today];

    const candidates = (await routines.list(elder.id)).filter((r) => r.active && r.alertIfMissed);
    if (candidates.length === 0) return [];
    const existing = new Set(
      (await occurrences.between(elder.id, dates[0] as LocalDate, today)).map((o) => `${o.date}_${o.routineId}`),
    );

    const created: MissedTask[] = [];
    for (const date of dates) {
      for (const routine of candidates) {
        if (!routine.weekdays.includes(weekdayOf(date)) || existing.has(`${date}_${routine.id}`)) continue;

        const scheduledAt = instantOf(date, routine.time, elder.timezone);
        // A routine created after its time on that day was never due, so it cannot have been missed.
        if (routine.createdAt > scheduledAt) continue;
        if (current.getTime() < scheduledAt.getTime() + elder.missedTaskTimeoutMin * MINUTE_MS) continue;

        const eventId = await occurrences.createMissed(
          elder.id,
          { routineId: routine.id, date, scheduledTime: routine.time, markedMissedAt: current },
          events.record(
            elder,
            {
              type: 'taskMissed',
              payload: { routineId: routine.id, routineName: routine.name, date, scheduledTime: routine.time },
            },
            current,
          ),
        );
        // null: another run (or the elder) got there first, so there is nothing to report.
        if (eventId === null) continue;

        created.push({
          elder,
          eventId,
          routineName: routine.name,
          occurrence: toOccurrence({
            routineId: routine.id,
            date,
            scheduledTime: routine.time,
            status: 'missed',
            doneAt: null,
            doneBy: null,
            markedMissedAt: current,
          }),
        });
      }
    }
    return created;
  }

  return {
    /**
     * Marks overdue `alertIfMissed` tasks as missed (spec §4). Safe to run twice: the occurrence id is
     * `{date}_{routineId}` and is written with create(), so each task is recorded once. One elder
     * failing does not stop the others.
     */
    async run(at: Date = now()): Promise<MissedTask[]> {
      const created: MissedTask[] = [];
      for (const elder of await elders.listAll()) {
        try {
          const missed = await runForElder(elder, at);
          created.push(...missed);
          for (const task of missed) {
            await notifier.taskMissed(elder, task.eventId, task.routineName, task.occurrence.scheduledTime);
          }
        } catch (error) {
          logger.error({ err: error, elderId: elder.id }, 'missed-task check failed for elder');
        }
      }
      return created;
    },
  };
}

export type MissedTasksJob = ReturnType<typeof createMissedTasksJob>;
