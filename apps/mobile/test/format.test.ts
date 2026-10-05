import { describe, expect, it } from 'vitest';

import { ageOf, countdownLabel, firstName, formatElapsed, formatPhone, formatStopwatch, initials, mapsUrl, weekRange } from '@/lib/format';

describe('format', () => {
  it('shortens names', () => {
    expect(firstName('  Maria Gorete ')).toBe('Maria');
    expect(initials('maria gorete silva')).toBe('MS');
    expect(initials('Ana')).toBe('A');
  });

  it('formats phones, leaving foreign numbers alone', () => {
    expect(formatPhone('+5511999990001')).toBe('(11) 99999-0001');
    expect(formatPhone('+551133334444')).toBe('(11) 3333-4444');
    expect(formatPhone('+14155550123')).toBe('+14155550123');
  });

  it('formats elapsed time and the stopwatch', () => {
    expect(formatElapsed(20_000)).toBe('agora');
    expect(formatElapsed(12 * 60_000)).toBe('12 min');
    expect(formatElapsed(65 * 60_000)).toBe('1 h 05');
    expect(formatElapsed(120 * 60_000)).toBe('2 h');
    expect(formatStopwatch(65_000)).toBe('01:05');
    expect(formatStopwatch(3_725_000)).toBe('1:02:05');
    expect(formatStopwatch(-5)).toBe('00:00');
  });

  it('labels countdowns', () => {
    expect(countdownLabel(5)).toBe('Em 5 min');
    expect(countdownLabel(0)).toBe('Agora');
    expect(countdownLabel(-12)).toBe('12 min atrás');
    expect(countdownLabel(-942)).toBe('15 h 42 atrás');
  });

  it('labels week ranges', () => {
    expect(weekRange('2026-06-15', '2026-06-21')).toBe('15–21 jun');
    expect(weekRange('2026-06-29', '2026-07-05')).toBe('29 jun–5 jul');
  });

  it('computes ages and map links', () => {
    expect(ageOf('1947-03-15', new Date(2026, 2, 14))).toBe(78);
    expect(ageOf('1947-03-15', new Date(2026, 2, 15))).toBe(79);
    expect(mapsUrl(-22.9, -43.1)).toContain('query=-22.9,-43.1');
  });
});
