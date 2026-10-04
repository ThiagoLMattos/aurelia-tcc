import type { LocalDate, LocalTime } from './primitives';

export function isValidTimezone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function partsOf(date: Date, timezone: string): Record<string, string> {
  let formatter = formatterCache.get(timezone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatterCache.set(timezone, formatter);
  }
  const out: Record<string, string> = {};
  for (const part of formatter.formatToParts(date)) out[part.type] = part.value;
  return out;
}

/** The calendar date ('YYYY-MM-DD') at `date`, as seen in `timezone`. */
export function localDateOf(date: Date, timezone: string): LocalDate {
  const p = partsOf(date, timezone);
  return `${p.year}-${p.month}-${p.day}`;
}

/** The wall-clock time ('HH:mm') at `date`, as seen in `timezone`. */
export function localTimeOf(date: Date, timezone: string): LocalTime {
  const p = partsOf(date, timezone);
  return `${p.hour}:${p.minute}`;
}

export function minutesOfDay(time: LocalTime): number {
  const [h, m] = time.split(':').map(Number) as [number, number];
  return h * 60 + m;
}

function toUtcDate(localDate: LocalDate): Date {
  const [y, m, d] = localDate.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d));
}

function fromUtcDate(date: Date): LocalDate {
  return date.toISOString().slice(0, 10);
}

/** 0 = Sunday … 6 = Saturday. */
export function weekdayOf(localDate: LocalDate): number {
  return toUtcDate(localDate).getUTCDay();
}

export function addDays(localDate: LocalDate, days: number): LocalDate {
  const date = toUtcDate(localDate);
  date.setUTCDate(date.getUTCDate() + days);
  return fromUtcDate(date);
}

/** The Monday of the week containing `localDate` (weeks run Monday–Sunday). */
export function weekStartOf(localDate: LocalDate): LocalDate {
  const weekday = weekdayOf(localDate);
  return addDays(localDate, -((weekday + 6) % 7));
}

/** The instant at which the wall clock in `timezone` reads `localDate` `localTime`. */
export function instantOf(localDate: LocalDate, localTime: LocalTime, timezone: string): Date {
  const [y, m, d] = localDate.split('-').map(Number) as [number, number, number];
  const [h, min] = localTime.split(':').map(Number) as [number, number];
  const wallAsUtc = Date.UTC(y, m - 1, d, h, min);
  const offsetAt = (instant: number) => {
    const p = partsOf(new Date(instant), timezone);
    const asUtc = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute), Number(p.second));
    return asUtc - Math.floor(instant / 1000) * 1000;
  };
  const first = wallAsUtc - offsetAt(wallAsUtc);
  return new Date(wallAsUtc - offsetAt(first));
}
