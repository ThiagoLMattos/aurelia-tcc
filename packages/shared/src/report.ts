import { z } from 'zod';

import { weekDates } from './agenda';
import type { Occurrence } from './agenda';
import type { Event } from './event';
import { IdSchema, LocalDateSchema } from './primitives';
import type { LocalDate } from './primitives';
import type { Routine } from './routine';
import { addDays, instantOf, localDateOf, weekStartOf } from './time';

export const AdherenceSchema = z.object({
  done: z.number().int().min(0),
  missed: z.number().int().min(0),
  /** Whole-number percentage, or null when there were no scheduled tasks (never 100 for 0/0). */
  pct: z.number().min(0).max(100).nullable(),
});
export type Adherence = z.infer<typeof AdherenceSchema>;

export const DayReportSchema = z.object({
  date: LocalDateSchema,
  done: z.number().int(),
  missed: z.number().int(),
  sos: z.number().int(),
  geofenceExits: z.number().int(),
  minutesOutside: z.number().int(),
});
export type DayReport = z.infer<typeof DayReportSchema>;

export const WeeklyReportSchema = z.object({
  weekStart: LocalDateSchema,
  weekEnd: LocalDateSchema,
  adherence: z.object({ medication: AdherenceSchema, all: AdherenceSchema }),
  missedCount: z.number().int(),
  sosCount: z.number().int(),
  geofenceExits: z.number().int(),
  minutesOutside: z.number().int(),
  days: z.array(DayReportSchema).length(7),
});
export type WeeklyReport = z.infer<typeof WeeklyReportSchema>;

export const WeeklyReportQuerySchema = z.object({
  /** Any date inside the wanted week works; it is normalised to that week's Monday. Default: current week. */
  weekStart: LocalDateSchema.optional(),
});
export type WeeklyReportQuery = z.infer<typeof WeeklyReportQuerySchema>;

export const ReportParamsSchema = z.object({ elderId: IdSchema });

export interface ComputeWeeklyReportInput {
  weekStart: LocalDate;
  routines: readonly Routine[];
  /** Occurrences of the week (others are ignored). */
  occurrences: readonly Occurrence[];
  /** Events of the week; a geofenceExit without a later geofenceReturn counts until `now` (capped at week end). */
  events: readonly Event[];
  now: Date;
  timezone: string;
}

function adherence(done: number, missed: number): Adherence {
  const total = done + missed;
  return { done, missed, pct: total === 0 ? null : Math.round((done / total) * 100) };
}

/**
 * Weekly aggregation (spec §4). Minutes outside are attributed to the local day on which the exit
 * happened, even if the elder returns after midnight.
 */
export function computeWeeklyReport(input: ComputeWeeklyReportInput): WeeklyReport {
  const { routines, occurrences, events, now, timezone } = input;
  const weekStart = weekStartOf(input.weekStart);
  const dates = weekDates(weekStart);
  const weekEnd = dates[6] as LocalDate;
  const medicationIds = new Set(routines.filter((r) => r.type === 'medication').map((r) => r.id));

  const days = new Map<LocalDate, DayReport>(
    dates.map((date) => [date, { date, done: 0, missed: 0, sos: 0, geofenceExits: 0, minutesOutside: 0 }]),
  );
  let medDone = 0;
  let medMissed = 0;

  for (const occurrence of occurrences) {
    const day = days.get(occurrence.date);
    if (!day) continue;
    const isMed = medicationIds.has(occurrence.routineId);
    if (occurrence.status === 'done') {
      day.done += 1;
      if (isMed) medDone += 1;
    } else {
      day.missed += 1;
      if (isMed) medMissed += 1;
    }
  }

  const weekEndInstant = instantOf(addDays(weekEnd, 1), '00:00', timezone).getTime();
  const sorted = events
    .filter((event) => days.has(event.date))
    .slice()
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  let openExit: { at: number; date: LocalDate } | null = null;

  const closeExit = (until: number) => {
    if (!openExit) return;
    const day = days.get(openExit.date);
    if (day) day.minutesOutside += Math.max(0, Math.round((until - openExit.at) / 60_000));
    openExit = null;
  };

  for (const event of sorted) {
    const day = days.get(event.date) as DayReport;
    if (event.type === 'sos') day.sos += 1;
    if (event.type === 'geofenceExit') {
      day.geofenceExits += 1;
      if (!openExit) openExit = { at: Date.parse(event.at), date: event.date };
    }
    if (event.type === 'geofenceReturn') closeExit(Date.parse(event.at));
  }
  closeExit(Math.min(now.getTime(), weekEndInstant));

  const list = [...days.values()].map((d) => ({ ...d }));
  const sum = (pick: (d: DayReport) => number) => list.reduce((total, d) => total + pick(d), 0);
  const done = sum((d) => d.done);
  const missed = sum((d) => d.missed);

  return {
    weekStart,
    weekEnd,
    adherence: { medication: adherence(medDone, medMissed), all: adherence(done, missed) },
    missedCount: missed,
    sosCount: sum((d) => d.sos),
    geofenceExits: sum((d) => d.geofenceExits),
    minutesOutside: sum((d) => d.minutesOutside),
    days: list,
  };
}

/** Monday of the current local week. */
export function currentWeekStart(now: Date, timezone: string): LocalDate {
  return weekStartOf(localDateOf(now, timezone));
}
