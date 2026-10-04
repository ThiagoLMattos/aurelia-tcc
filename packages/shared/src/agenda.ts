import { z } from 'zod';

import { IdSchema, IsoDateTimeSchema, LocalDateSchema, LocalTimeSchema } from './primitives';
import type { LocalDate } from './primitives';
import { MedicationSchema, RoutineTypeSchema } from './routine';
import type { Routine } from './routine';
import { addDays, localDateOf, localTimeOf, minutesOfDay, weekdayOf } from './time';

export const AgendaStatusSchema = z.enum(['upcoming', 'now', 'pending', 'done', 'missed']);
export type AgendaStatus = z.infer<typeof AgendaStatusSchema>;

export const OccurrenceStatusSchema = z.enum(['done', 'missed']);
export const DoneBySchema = z.enum(['elder', 'caregiver']);
export type DoneBy = z.infer<typeof DoneBySchema>;

/** Wire shape of `elders/{id}/occurrences/{date}_{routineId}`. */
export const OccurrenceSchema = z.object({
  routineId: IdSchema,
  date: LocalDateSchema,
  scheduledTime: LocalTimeSchema,
  status: OccurrenceStatusSchema,
  doneAt: IsoDateTimeSchema.nullable(),
  doneBy: DoneBySchema.nullable(),
  markedMissedAt: IsoDateTimeSchema.nullable(),
});
export type Occurrence = z.infer<typeof OccurrenceSchema>;

export const AgendaItemSchema = z.object({
  routineId: IdSchema,
  date: LocalDateSchema,
  time: LocalTimeSchema,
  type: RoutineTypeSchema,
  name: z.string(),
  description: z.string(),
  medication: MedicationSchema.nullable(),
  status: AgendaStatusSchema,
  doneAt: IsoDateTimeSchema.nullable(),
  doneBy: DoneBySchema.nullable(),
});
export type AgendaItem = z.infer<typeof AgendaItemSchema>;

export const AgendaQuerySchema = z.object({ date: LocalDateSchema.optional() });
export type AgendaQuery = z.infer<typeof AgendaQuerySchema>;

export const AgendaResponseSchema = z.object({
  date: LocalDateSchema,
  items: z.array(AgendaItemSchema),
});
export type AgendaResponse = z.infer<typeof AgendaResponseSchema>;

export const AgendaDoneParamsSchema = z.object({
  elderId: IdSchema,
  date: LocalDateSchema,
  routineId: IdSchema,
});
export type AgendaDoneParams = z.infer<typeof AgendaDoneParamsSchema>;

export interface ComputeAgendaInput {
  routines: readonly Routine[];
  occurrences: readonly Occurrence[];
  date: LocalDate;
  now: Date;
  timezone: string;
  missedTaskTimeoutMin: number;
}

/** Id of an occurrence document: `{date}_{routineId}`. */
export function occurrenceId(date: LocalDate, routineId: string): string {
  return `${date}_${routineId}`;
}

/**
 * Agenda for one local date: active routines scheduled on that weekday, merged with stored occurrences.
 * Items are sorted by time, then name.
 */
export function computeAgenda(input: ComputeAgendaInput): AgendaItem[] {
  const { routines, occurrences, date, now, timezone, missedTaskTimeoutMin } = input;
  const weekday = weekdayOf(date);
  const today = localDateOf(now, timezone);
  const nowMinutes = minutesOfDay(localTimeOf(now, timezone));
  const byRoutine = new Map(occurrences.filter((o) => o.date === date).map((o) => [o.routineId, o]));

  const items: AgendaItem[] = [];
  for (const routine of routines) {
    if (!routine.active || !routine.weekdays.includes(weekday)) continue;
    const occurrence = byRoutine.get(routine.id);
    const scheduled = minutesOfDay(routine.time);

    let status: AgendaStatus;
    if (occurrence) {
      status = occurrence.status;
    } else if (date > today) {
      status = 'upcoming';
    } else if (date < today) {
      status = 'pending';
    } else if (nowMinutes < scheduled) {
      status = 'upcoming';
    } else if (nowMinutes < scheduled + missedTaskTimeoutMin) {
      status = 'now';
    } else {
      status = 'pending';
    }

    items.push({
      routineId: routine.id,
      date,
      time: routine.time,
      type: routine.type,
      name: routine.name,
      description: routine.description,
      medication: routine.medication,
      status,
      doneAt: occurrence?.doneAt ?? null,
      doneBy: occurrence?.doneBy ?? null,
    });
  }
  return items.sort((a, b) => a.time.localeCompare(b.time) || a.name.localeCompare(b.name));
}

/** Dates of the Monday–Sunday week starting at `weekStart`. */
export function weekDates(weekStart: LocalDate): LocalDate[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}
