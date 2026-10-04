import { describe, expect, it } from 'vitest';

import { addDays, instantOf, isValidTimezone, localDateOf, localTimeOf, minutesOfDay, weekStartOf, weekdayOf } from '../src';
import { TZ } from './helpers';

describe('time', () => {
  it('localDateOf differs from the UTC date around midnight', () => {
    const instant = new Date('2024-01-03T01:30:00Z'); // 22:30 on Jan 2 in São Paulo
    expect(instant.toISOString().slice(0, 10)).toBe('2024-01-03');
    expect(localDateOf(instant, TZ)).toBe('2024-01-02');
    expect(localDateOf(instant, 'UTC')).toBe('2024-01-03');
  });

  it('localTimeOf is zero padded and 24h', () => {
    expect(localTimeOf(new Date('2024-01-03T11:05:00Z'), TZ)).toBe('08:05');
    expect(localTimeOf(new Date('2024-01-03T03:00:00Z'), TZ)).toBe('00:00');
  });

  it('weekdayOf / addDays / weekStartOf', () => {
    expect(weekdayOf('2024-01-01')).toBe(1); // Monday
    expect(weekdayOf('2024-01-07')).toBe(0); // Sunday
    expect(addDays('2024-02-28', 2)).toBe('2024-03-01'); // leap year
    expect(addDays('2024-01-01', -1)).toBe('2023-12-31');
    expect(weekStartOf('2024-01-03')).toBe('2024-01-01');
    expect(weekStartOf('2024-01-01')).toBe('2024-01-01');
    expect(weekStartOf('2024-01-07')).toBe('2024-01-01'); // Sunday belongs to the week before
    expect(weekStartOf('2024-01-08')).toBe('2024-01-08');
  });

  it('minutesOfDay', () => {
    expect(minutesOfDay('00:00')).toBe(0);
    expect(minutesOfDay('08:30')).toBe(510);
    expect(minutesOfDay('23:59')).toBe(1439);
  });

  it('instantOf converts wall-clock time to an instant', () => {
    expect(instantOf('2024-01-03', '08:00', TZ).toISOString()).toBe('2024-01-03T11:00:00.000Z');
    expect(instantOf('2024-01-03', '00:00', TZ).toISOString()).toBe('2024-01-03T03:00:00.000Z');
    expect(instantOf('2024-07-01', '12:00', 'Europe/London').toISOString()).toBe('2024-07-01T11:00:00.000Z'); // BST
    expect(instantOf('2024-01-01', '12:00', 'Europe/London').toISOString()).toBe('2024-01-01T12:00:00.000Z');
  });

  it('isValidTimezone', () => {
    expect(isValidTimezone(TZ)).toBe(true);
    expect(isValidTimezone('Mars/Olympus')).toBe(false);
  });
});
