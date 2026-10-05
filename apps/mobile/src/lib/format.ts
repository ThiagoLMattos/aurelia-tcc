import { localTimeOf, type LocalDate } from '@aurelia/shared';

const MONTHS_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts.at(-1)?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}

/** 'HH:mm' of an ISO instant as seen in the elder's timezone. */
export function clockTime(iso: string, timezone: string): string {
  return localTimeOf(new Date(iso), timezone);
}

/** '15 jun' from 'YYYY-MM-DD'. */
export function shortDate(date: LocalDate): string {
  const [, month = '1', day = '1'] = date.split('-');
  return `${Number(day)} ${MONTHS_SHORT[Number(month) - 1]}`;
}

/** '17–23 jun' (or '28 jun–4 jul' across months) for a Monday–Sunday week. */
export function weekRange(weekStart: LocalDate, weekEnd: LocalDate): string {
  const [, startMonth = '1', startDay = '1'] = weekStart.split('-');
  const [, endMonth = '1', endDay = '1'] = weekEnd.split('-');
  if (startMonth === endMonth) return `${Number(startDay)}–${Number(endDay)} ${MONTHS_SHORT[Number(endMonth) - 1]}`;
  return `${shortDate(weekStart)}–${shortDate(weekEnd)}`;
}

export function dayOfMonth(date: LocalDate): number {
  return Number(date.slice(8, 10));
}

/** Whole years between a 'YYYY-MM-DD' birth date and `now`. */
export function ageOf(birthDate: LocalDate, now: Date = new Date()): number {
  const [year = 0, month = 1, day = 1] = birthDate.split('-').map(Number);
  let age = now.getFullYear() - year;
  if (now.getMonth() + 1 < month || (now.getMonth() + 1 === month && now.getDate() < day)) age -= 1;
  return age;
}

/** '+5511999990001' → '(11) 99999-0001'. Anything that is not a Brazilian number is shown as stored. */
export function formatPhone(e164: string): string {
  const match = /^\+55(\d{2})(\d{4,5})(\d{4})$/.exec(e164);
  return match ? `(${match[1]}) ${match[2]}-${match[3]}` : e164;
}

/** "agora", "12 min", "1 h 05" for a span in milliseconds. */
export function formatElapsed(ms: number): string {
  const minutes = Math.max(0, Math.floor(ms / 60_000));
  if (minutes < 1) return 'agora';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${String(rest).padStart(2, '0')}`;
}

/** mm:ss or h:mm:ss, for the live timer on the breach screen. */
export function formatStopwatch(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}

/** "Em 5 min", "Agora", "12 min atrás", "2 h atrás" for a signed number of minutes. */
export function countdownLabel(minutes: number): string {
  if (minutes === 0) return 'Agora';
  const span = formatElapsed(Math.abs(minutes) * 60_000);
  return minutes > 0 ? `Em ${span}` : `${span} atrás`;
}

/** Map link for a position; opens the phone's maps app (or the browser) without any map SDK. */
export function mapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}
