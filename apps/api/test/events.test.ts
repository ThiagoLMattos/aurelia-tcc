import { EventsPageSchema } from '@aurelia/shared';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { bearer, buildApp, buildServices, createElderDoc, createScenario, expectApiError, fixedClock, repos } from './helpers';

const clock = fixedClock();
const app = buildApp({ now: clock });
const services = buildServices(clock);

async function seed() {
  const scenario = await createScenario();
  const elder = (await repos.elders.get(scenario.elderId))!;
  const sos = (at: string) => services.events.append(elder, { type: 'sos', payload: { lat: null, lng: null } }, new Date(at));
  const returned = (at: string) =>
    services.events.append(elder, { type: 'geofenceReturn', payload: { lat: -23.5, lng: -46.6 } }, new Date(at));
  const list = (query = '', token = scenario.caregiver.token) =>
    request(app).get(`/api/v1/elders/${scenario.elderId}/events${query}`).set(bearer(token));
  return { ...scenario, elder, sos, returned, list };
}

describe('GET /elders/:elderId/events', () => {
  it('returns the timeline newest first', async () => {
    const { sos, returned, list } = await seed();
    await sos('2026-03-09T12:00:00Z');
    await returned('2026-03-10T12:00:00Z');
    await sos('2026-03-11T12:00:00Z');

    const response = await list();
    expect(response.status).toBe(200);
    const page = EventsPageSchema.parse(response.body);
    expect(page.items.map((e) => e.at)).toEqual([
      '2026-03-11T12:00:00.000Z',
      '2026-03-10T12:00:00.000Z',
      '2026-03-09T12:00:00.000Z',
    ]);
    expect(page.items[0]).toMatchObject({ type: 'sos', date: '2026-03-11' });
    expect(page.nextCursor).toBeNull();
  });

  it('pages with a cursor without losing or repeating events, including ties', async () => {
    const { sos, list } = await seed();
    const ids: string[] = [];
    for (const at of ['2026-03-01T10:00:00Z', '2026-03-02T10:00:00Z', '2026-03-02T10:00:00Z', '2026-03-03T10:00:00Z', '2026-03-04T10:00:00Z']) {
      ids.push((await sos(at)).id);
    }

    const seen: string[] = [];
    let cursor: string | null = null;
    let pages = 0;
    do {
      const response = await list(`?limit=2${cursor ? `&cursor=${cursor}` : ''}`);
      const page = EventsPageSchema.parse(response.body);
      expect(page.items.length).toBeLessThanOrEqual(2);
      seen.push(...page.items.map((e) => e.id));
      cursor = page.nextCursor;
      pages++;
    } while (cursor);

    expect(pages).toBe(3);
    expect(seen).toHaveLength(5);
    expect(new Set(seen)).toEqual(new Set(ids));
  });

  it('filters by type', async () => {
    const { sos, returned, list } = await seed();
    await sos('2026-03-09T12:00:00Z');
    await returned('2026-03-10T12:00:00Z');
    expect((await list('?types=sos')).body.items.map((e: { type: string }) => e.type)).toEqual(['sos']);
    expect((await list('?types=sos,geofenceReturn')).body.items).toHaveLength(2);
    expectApiError(await list('?types=nope'), 400, 'VALIDATION_ERROR');
  });

  it('filters by local dates, inclusive, in the elder’s timezone', async () => {
    const { sos, list } = await seed();
    await sos('2026-03-10T02:59:00Z'); // 23:59 on the 9th in São Paulo
    await sos('2026-03-10T03:00:00Z'); // 00:00 on the 10th
    await sos('2026-03-11T02:59:00Z'); // 23:59 on the 10th
    await sos('2026-03-11T03:00:00Z'); // 00:00 on the 11th

    const only10th = await list('?from=2026-03-10&to=2026-03-10');
    expect(only10th.body.items.map((e: { at: string }) => e.at)).toEqual(['2026-03-11T02:59:00.000Z', '2026-03-10T03:00:00.000Z']);
    expect((await list('?from=2026-03-11')).body.items).toHaveLength(1);
    expect((await list('?to=2026-03-09')).body.items).toHaveLength(1);
    expectApiError(await list('?from=2026-03-12&to=2026-03-10'), 400, 'VALIDATION_ERROR');
  });

  it('combines type and date filters and keeps each elder’s timeline separate', async () => {
    const { sos, returned, list, elderId } = await seed();
    const otherElder = (await repos.elders.get(await createElderDoc(['x'])))!;
    await services.events.append(otherElder, { type: 'sos', payload: { lat: null, lng: null } });
    await sos('2026-03-10T12:00:00Z');
    await returned('2026-03-10T13:00:00Z');
    await sos('2026-03-12T12:00:00Z');

    const response = await list('?types=sos&from=2026-03-10&to=2026-03-11');
    expect(response.body.items).toHaveLength(1);
    expect(elderId).not.toBe(otherElder.id);
  });

  it('rejects a cursor it did not issue, a bad limit, and non-caregivers', async () => {
    const { list, elderToken, other } = await seed();
    expectApiError(await list('?cursor=garbage'), 400, 'VALIDATION_ERROR');
    expectApiError(await list('?limit=0'), 400, 'VALIDATION_ERROR');
    expectApiError(await list('?limit=101'), 400, 'VALIDATION_ERROR');
    expectApiError(await list('', elderToken), 403, 'FORBIDDEN');
    expectApiError(await list('', other.token), 403, 'FORBIDDEN');
  });
});
