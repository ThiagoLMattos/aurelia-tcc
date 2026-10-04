import { describe, expect, it } from 'vitest';

import { computeWeeklyReport, currentWeekStart } from '../src';
import type { Event } from '../src';
import { occurrence, routine, TZ } from './helpers';

const WEEK = '2024-01-01'; // Monday
const NOW = new Date('2024-02-01T12:00:00Z');

const exit = (at: string, date: string, id = at): Event => ({
  id, at, date, type: 'geofenceExit', payload: { lat: 0, lng: 0, distanceM: 200, resolvedAt: null, resolvedNote: null },
});
const ret = (at: string, date: string, id = at): Event => ({ id, at, date, type: 'geofenceReturn', payload: { lat: 0, lng: 0 } });
const sos = (at: string, date: string): Event => ({ id: at, at, date, type: 'sos', payload: { lat: null, lng: null } });

const report = (over: Partial<Parameters<typeof computeWeeklyReport>[0]> = {}) =>
  computeWeeklyReport({ weekStart: WEEK, routines: [], occurrences: [], events: [], now: NOW, timezone: TZ, ...over });

describe('computeWeeklyReport', () => {
  it('0/0 adherence is null, not 100', () => {
    const r = report();
    expect(r.adherence.all).toEqual({ done: 0, missed: 0, pct: null });
    expect(r.adherence.medication.pct).toBeNull();
    expect(r.days).toHaveLength(7);
    expect(r.weekEnd).toBe('2024-01-07');
  });

  it('computes adherence overall and for medication only', () => {
    const routines = [routine({ id: 'med', type: 'medication' }), routine({ id: 'meal' })];
    const occurrences = [
      occurrence({ routineId: 'med', date: '2024-01-01', status: 'done' }),
      occurrence({ routineId: 'med', date: '2024-01-02', status: 'done' }),
      occurrence({ routineId: 'med', date: '2024-01-03', status: 'missed' }),
      occurrence({ routineId: 'meal', date: '2024-01-03', status: 'missed' }),
      occurrence({ routineId: 'meal', date: '2024-01-08', status: 'done' }), // other week
    ];
    const r = report({ routines, occurrences });
    expect(r.adherence.medication).toEqual({ done: 2, missed: 1, pct: 67 });
    expect(r.adherence.all).toEqual({ done: 2, missed: 2, pct: 50 });
    expect(r.missedCount).toBe(2);
  });

  it('breaks the week down per day', () => {
    const r = report({
      routines: [routine()],
      occurrences: [occurrence({ date: '2024-01-03', status: 'done' }), occurrence({ date: '2024-01-03', routineId: 'x', status: 'missed' })],
      events: [sos('2024-01-03T15:00:00.000Z', '2024-01-03'), sos('2024-01-05T15:00:00.000Z', '2024-01-05')],
    });
    expect(r.days.map((d) => d.date)).toEqual(['2024-01-01', '2024-01-02', '2024-01-03', '2024-01-04', '2024-01-05', '2024-01-06', '2024-01-07']);
    expect(r.days[2]).toMatchObject({ done: 1, missed: 1, sos: 1 });
    expect(r.days[4]).toMatchObject({ sos: 1 });
    expect(r.sosCount).toBe(2);
  });

  it('sums minutes outside from exit/return pairs', () => {
    const r = report({
      events: [
        exit('2024-01-02T13:00:00.000Z', '2024-01-02'),
        ret('2024-01-02T13:45:00.000Z', '2024-01-02'),
        exit('2024-01-04T13:00:00.000Z', '2024-01-04'),
        ret('2024-01-04T13:10:00.000Z', '2024-01-04'),
      ],
    });
    expect(r.geofenceExits).toBe(2);
    expect(r.minutesOutside).toBe(55);
    expect(r.days[1]?.minutesOutside).toBe(45);
    expect(r.days[3]?.minutesOutside).toBe(10);
  });

  it('counts an exit with no return until now (past week: capped at week end)', () => {
    // Exit on Sunday 22:00 local (01:00Z Monday); week ended at 03:00Z Monday → 2 h.
    const e = exit('2024-01-08T01:00:00.000Z', '2024-01-07');
    expect(report({ events: [e], now: NOW }).minutesOutside).toBe(120);
    // Current week: counts until now.
    const now = new Date('2024-01-03T14:30:00Z');
    const open = exit('2024-01-03T13:00:00.000Z', '2024-01-03');
    expect(report({ events: [open], now }).minutesOutside).toBe(90);
  });

  it('ignores a return with no matching exit and events outside the week', () => {
    const r = report({ events: [ret('2024-01-02T13:00:00.000Z', '2024-01-02'), sos('2024-01-09T13:00:00.000Z', '2024-01-09')] });
    expect(r.minutesOutside).toBe(0);
    expect(r.sosCount).toBe(0);
  });

  it('normalises weekStart to the Monday of its week', () => {
    expect(report({ weekStart: '2024-01-05' }).weekStart).toBe('2024-01-01');
  });

  it('currentWeekStart uses the elder timezone', () => {
    // Monday 01:00Z is still Sunday in São Paulo → previous week.
    expect(currentWeekStart(new Date('2024-01-08T01:00:00Z'), TZ)).toBe('2024-01-01');
    expect(currentWeekStart(new Date('2024-01-08T01:00:00Z'), 'UTC')).toBe('2024-01-08');
  });
});
