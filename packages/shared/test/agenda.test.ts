import { describe, expect, it } from 'vitest';

import { computeAgenda, occurrenceId, weekDates } from '../src';
import { occurrence, routine, TZ } from './helpers';

const DATE = '2024-01-03'; // Wednesday
const at = (hhmm: string) => new Date(`2024-01-03T${hhmm}:00-03:00`);
const run = (now: Date, extra: Partial<Parameters<typeof computeAgenda>[0]> = {}) =>
  computeAgenda({ routines: [routine()], occurrences: [], date: DATE, now, timezone: TZ, missedTaskTimeoutMin: 30, ...extra });

describe('computeAgenda', () => {
  it('filters by weekday', () => {
    const routines = [routine({ id: 'wed', weekdays: [3] }), routine({ id: 'mon', weekdays: [1] })];
    expect(run(at('07:00'), { routines }).map((i) => i.routineId)).toEqual(['wed']);
  });

  it('excludes inactive routines', () => {
    expect(run(at('07:00'), { routines: [routine({ active: false })] })).toEqual([]);
  });

  it('transitions upcoming → now → pending around the window', () => {
    expect(run(at('07:59'))[0]?.status).toBe('upcoming');
    expect(run(at('08:00'))[0]?.status).toBe('now');
    expect(run(at('08:29'))[0]?.status).toBe('now');
    expect(run(at('08:30'))[0]?.status).toBe('pending');
    expect(run(at('08:30'), { missedTaskTimeoutMin: 60 })[0]?.status).toBe('now');
  });

  it('past dates are pending, future dates upcoming', () => {
    expect(run(at('07:00'), { date: '2024-01-02' })[0]?.status).toBe('pending');
    expect(run(at('23:00'), { date: '2024-01-04' })[0]?.status).toBe('upcoming');
  });

  it('occurrences override the computed status and carry done info', () => {
    const doneAt = '2024-01-03T11:05:00.000Z';
    const done = run(at('12:00'), { occurrences: [occurrence({ status: 'done', doneAt, doneBy: 'elder' })] })[0];
    expect(done).toMatchObject({ status: 'done', doneAt, doneBy: 'elder' });
    expect(run(at('07:00'), { occurrences: [occurrence({ status: 'missed' })] })[0]?.status).toBe('missed');
  });

  it('ignores occurrences of other dates', () => {
    expect(run(at('07:00'), { occurrences: [occurrence({ date: '2024-01-02' })] })[0]?.status).toBe('upcoming');
  });

  it('sorts by time then name', () => {
    const routines = [
      routine({ id: 'b', time: '12:00', name: 'B' }),
      routine({ id: 'a', time: '12:00', name: 'A' }),
      routine({ id: 'c', time: '07:00', name: 'C' }),
    ];
    expect(run(at('06:00'), { routines }).map((i) => i.routineId)).toEqual(['c', 'a', 'b']);
  });

  it('uses the elder timezone for "today" (UTC midnight vs São Paulo date)', () => {
    // 2024-01-04T01:00Z is still Jan 3 at 22:00 in São Paulo.
    const now = new Date('2024-01-04T01:00:00Z');
    const items = run(now, { routines: [routine({ time: '21:00' }), routine({ id: 'late', time: '23:00' })] });
    expect(items.map((i) => i.status)).toEqual(['pending', 'upcoming']);
    // For Jan 4 (the UTC date) it is still in the future for São Paulo.
    expect(run(now, { date: '2024-01-04' })[0]?.status).toBe('upcoming');
  });

  it('occurrenceId / weekDates', () => {
    expect(occurrenceId('2024-01-03', 'r1')).toBe('2024-01-03_r1');
    expect(weekDates('2024-01-01')).toHaveLength(7);
    expect(weekDates('2024-01-01')[6]).toBe('2024-01-07');
  });
});
