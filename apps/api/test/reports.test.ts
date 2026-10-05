import { WeeklyReportSchema } from '@aurelia/shared';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { bearer, buildApp, buildServices, createScenario, expectApiError, fixedClock, repos } from './helpers';

// Thursday 2026-03-12, 10:00 in São Paulo. The report week is Mon 03-09 … Sun 03-15.
const clock = fixedClock('2026-03-12T13:00:00.000Z');
const app = buildApp({ now: clock });
const services = buildServices(clock);

const created = new Date('2026-03-01T00:00:00Z');
const everyDay = [0, 1, 2, 3, 4, 5, 6];

describe('GET /elders/:elderId/reports/weekly', () => {
  it('matches the numbers of a fixture week', async () => {
    const { elderId, caregiver } = await createScenario();
    const elder = (await repos.elders.get(elderId))!;
    const med = await repos.routines.create(
      elderId,
      { type: 'medication', name: 'Losartana', description: '', time: '08:00', weekdays: everyDay, medication: { dosage: '50 mg', form: 'comprimido' }, remindElder: true, alertIfMissed: true, active: true },
      created,
    );
    const meal = await repos.routines.create(
      elderId,
      { type: 'meal', name: 'Almoço', description: '', time: '12:00', weekdays: everyDay, remindElder: true, alertIfMissed: false, active: true },
      created,
    );

    const done = (routineId: string, date: string, time: string) =>
      repos.occurrences.createDone(
        elderId,
        { routineId, date, scheduledTime: time, doneAt: new Date(`${date}T15:00:00Z`), doneBy: 'elder' },
        services.events.record(elder, { type: 'taskDone', payload: { routineId, routineName: 'x', date, scheduledTime: time, doneBy: 'elder', undoneAt: null } }, new Date(`${date}T15:00:00Z`)),
      );
    const missed = (routineId: string, date: string, time: string) =>
      repos.occurrences.createMissed(
        elderId,
        { routineId, date, scheduledTime: time, markedMissedAt: new Date(`${date}T20:00:00Z`) },
        services.events.record(elder, { type: 'taskMissed', payload: { routineId, routineName: 'x', date, scheduledTime: time } }, new Date(`${date}T20:00:00Z`)),
      );

    await done(med.id, '2026-03-09', '08:00');
    await done(meal.id, '2026-03-09', '12:00');
    await missed(med.id, '2026-03-10', '08:00');
    await done(med.id, '2026-03-11', '08:00');
    await missed(meal.id, '2026-03-11', '12:00');
    // Last week: must not count.
    await missed(med.id, '2026-03-08', '08:00');

    const append = (draft: Parameters<typeof services.events.append>[1], at: string) => services.events.append(elder, draft, new Date(at));
    await append({ type: 'sos', payload: { lat: null, lng: null } }, '2026-03-10T14:00:00Z');
    await append({ type: 'geofenceExit', payload: { lat: -23.5, lng: -46.6, distanceM: 300, resolvedAt: null, resolvedNote: null } }, '2026-03-11T14:00:00Z');
    await append({ type: 'geofenceReturn', payload: { lat: -23.5, lng: -46.6 } }, '2026-03-11T14:30:00Z');
    // Left at 09:00 local on Thursday and has not come back: counts until "now" (10:00 local).
    await append({ type: 'geofenceExit', payload: { lat: -23.5, lng: -46.6, distanceM: 400, resolvedAt: null, resolvedNote: null } }, '2026-03-12T12:00:00Z');

    const response = await request(app).get(`/api/v1/elders/${elderId}/reports/weekly`).set(bearer(caregiver.token));
    expect(response.status).toBe(200);
    const report = WeeklyReportSchema.parse(response.body);

    expect(report).toMatchObject({
      weekStart: '2026-03-09',
      weekEnd: '2026-03-15',
      adherence: { medication: { done: 2, missed: 1, pct: 67 }, all: { done: 3, missed: 2, pct: 60 } },
      missedCount: 2,
      sosCount: 1,
      geofenceExits: 2,
      minutesOutside: 30 + 60,
    });
    expect(report.days.map((d) => [d.date, d.done, d.missed, d.sos, d.geofenceExits, d.minutesOutside])).toEqual([
      ['2026-03-09', 2, 0, 0, 0, 0],
      ['2026-03-10', 0, 1, 1, 0, 0],
      ['2026-03-11', 1, 1, 0, 1, 30],
      ['2026-03-12', 0, 0, 0, 1, 60],
      ['2026-03-13', 0, 0, 0, 0, 0],
      ['2026-03-14', 0, 0, 0, 0, 0],
      ['2026-03-15', 0, 0, 0, 0, 0],
    ]);

    // Any date in the previous week selects that week (it holds the Sunday-the-8th miss seeded above).
    const previous = await request(app)
      .get(`/api/v1/elders/${elderId}/reports/weekly?weekStart=2026-03-04`)
      .set(bearer(caregiver.token));
    expect(previous.body).toMatchObject({ weekStart: '2026-03-02', adherence: { medication: { done: 0, missed: 1, pct: 0 } } });
    const lastSunday = await request(app)
      .get(`/api/v1/elders/${elderId}/reports/weekly?weekStart=2026-03-08`)
      .set(bearer(caregiver.token));
    expect(lastSunday.body).toMatchObject({ weekStart: '2026-03-02', missedCount: 1 });
  });

  it('reports no adherence (not 100%) for an empty week', async () => {
    const { elderId, caregiver } = await createScenario();
    const response = await request(app).get(`/api/v1/elders/${elderId}/reports/weekly`).set(bearer(caregiver.token));
    expect(response.body.adherence).toEqual({
      medication: { done: 0, missed: 0, pct: null },
      all: { done: 0, missed: 0, pct: null },
    });
  });

  it('rejects a malformed week', async () => {
    const { elderId, caregiver } = await createScenario();
    const response = await request(app)
      .get(`/api/v1/elders/${elderId}/reports/weekly?weekStart=nope`)
      .set(bearer(caregiver.token));
    expectApiError(response, 400, 'VALIDATION_ERROR');
  });

  it('is for caregivers of that elder only', async () => {
    const { elderId, elderToken, other } = await createScenario();
    const path = `/api/v1/elders/${elderId}/reports/weekly`;
    expectApiError(await request(app).get(path).set(bearer(elderToken)), 403, 'FORBIDDEN');
    expectApiError(await request(app).get(path).set(bearer(other.token)), 403, 'FORBIDDEN');
  });
});
