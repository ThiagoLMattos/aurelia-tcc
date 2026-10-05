import { z } from 'zod';

import { weekDates } from './agenda';
import type { Occurrence } from './agenda';
import type { Event } from './event';
import { memoryAccuracyPct } from './game';
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
  /** Games finished that day. */
  games: z.number().int(),
});
export type DayReport = z.infer<typeof DayReportSchema>;

export const GamesReportSchema = z.object({
  /** Games finished in the week, of either kind. */
  sessions: z.number().int().min(0),
  /** Time spent on them, rounded to whole minutes. */
  minutes: z.number().int().min(0),
  memory: z.object({
    played: z.number().int().min(0),
    /** Best share of turns that found a pair (see `memoryAccuracyPct`); null when not played. */
    bestAccuracyPct: z.number().min(0).max(100).nullable(),
    /** Most pairs on a board finished that week; null when not played. */
    mostPairs: z.number().int().nullable(),
  }),
  sequence: z.object({
    played: z.number().int().min(0),
    /** Longest sequence repeated that week; null when not played. */
    best: z.number().int().nullable(),
  }),
  ticTacToe: z.object({
    played: z.number().int().min(0),
    wins: z.number().int().min(0),
    draws: z.number().int().min(0),
  }),
});
export type GamesReport = z.infer<typeof GamesReportSchema>;

export const WeeklyReportSchema = z.object({
  weekStart: LocalDateSchema,
  weekEnd: LocalDateSchema,
  adherence: z.object({ medication: AdherenceSchema, all: AdherenceSchema }),
  missedCount: z.number().int(),
  sosCount: z.number().int(),
  geofenceExits: z.number().int(),
  minutesOutside: z.number().int(),
  games: GamesReportSchema,
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
    dates.map((date) => [date, { date, done: 0, missed: 0, sos: 0, geofenceExits: 0, minutesOutside: 0, games: 0 }]),
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
  const games: GamesReport = {
    sessions: 0,
    minutes: 0,
    memory: { played: 0, bestAccuracyPct: null, mostPairs: null },
    sequence: { played: 0, best: null },
    ticTacToe: { played: 0, wins: 0, draws: 0 },
  };
  let gameSeconds = 0;

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
    if (event.type === 'gamePlayed') {
      const result = event.payload;
      day.games += 1;
      games.sessions += 1;
      gameSeconds += result.durationSec;
      if (result.game === 'memory') {
        games.memory.played += 1;
        games.memory.bestAccuracyPct = Math.max(games.memory.bestAccuracyPct ?? 0, memoryAccuracyPct(result));
        games.memory.mostPairs = Math.max(games.memory.mostPairs ?? 0, result.pairs);
      } else if (result.game === 'sequence') {
        games.sequence.played += 1;
        games.sequence.best = Math.max(games.sequence.best ?? 0, result.longest);
      } else {
        games.ticTacToe.played += 1;
        if (result.outcome === 'win') games.ticTacToe.wins += 1;
        if (result.outcome === 'draw') games.ticTacToe.draws += 1;
      }
    }
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
    games: { ...games, minutes: Math.round(gameSeconds / 60) },
    days: list,
  };
}

/** Monday of the current local week. */
export function currentWeekStart(now: Date, timezone: string): LocalDate {
  return weekStartOf(localDateOf(now, timezone));
}
