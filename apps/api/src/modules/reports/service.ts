import {
  addDays,
  computeWeeklyReport,
  instantOf,
  localDateOf,
  weekStartOf,
  type Occurrence,
  type WeeklyReport,
  type WeeklyReportQuery,
} from '@aurelia/shared';

import type { Clock } from '../../clock';
import type { ElderDoc, OccurrenceDoc } from '../../repos';
import type { EventsRepo } from '../../repos/events';
import type { OccurrencesRepo } from '../../repos/occurrences';
import type { RoutinesRepo } from '../../repos/routines';
import { toOccurrence } from '../agenda/serialize';
import { toRoutine } from '../routines/serialize';

interface Deps {
  routines: RoutinesRepo;
  occurrences: OccurrencesRepo;
  events: EventsRepo;
  now: Clock;
}

export function createReportsService({ routines, occurrences, events, now }: Deps) {
  return {
    async weekly(elder: ElderDoc, query: WeeklyReportQuery): Promise<WeeklyReport> {
      const current = now();
      const weekStart = weekStartOf(query.weekStart ?? localDateOf(current, elder.timezone));
      const weekEnd = addDays(weekStart, 6);

      const [routineDocs, occurrenceDocs, weekEvents] = await Promise.all([
        routines.list(elder.id),
        occurrences.between(elder.id, weekStart, weekEnd),
        events.between(
          elder.id,
          instantOf(weekStart, '00:00', elder.timezone),
          instantOf(addDays(weekEnd, 1), '00:00', elder.timezone),
        ),
      ]);

      return computeWeeklyReport({
        weekStart,
        routines: routineDocs.map(toRoutine),
        occurrences: occurrenceDocs.map((doc: OccurrenceDoc): Occurrence => toOccurrence(doc)),
        events: weekEvents,
        now: current,
        timezone: elder.timezone,
      });
    },
  };
}

export type ReportsService = ReturnType<typeof createReportsService>;
