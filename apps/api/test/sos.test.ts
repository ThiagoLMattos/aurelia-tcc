import { SosResponseSchema } from '@aurelia/shared';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { bearer, buildApp, createScenario, expectApiError, fixedClock } from './helpers';

const now = fixedClock();
const app = buildApp({ now });

describe('POST /elders/:elderId/sos', () => {
  it('stores the event with coordinates, or without', async () => {
    const { elderId, elderToken, caregiver } = await createScenario();
    const path = `/api/v1/elders/${elderId}/sos`;

    const withPosition = await request(app).post(path).set(bearer(elderToken)).send({ lat: -23.55, lng: -46.63 });
    expect(withPosition.status).toBe(201);
    const { eventId } = SosResponseSchema.parse(withPosition.body);
    const without = await request(app).post(path).set(bearer(elderToken)).send({});
    expect(without.status).toBe(201);

    const timeline = await request(app).get(`/api/v1/elders/${elderId}/events?types=sos`).set(bearer(caregiver.token));
    expect(timeline.body.items).toHaveLength(2);
    const stored = timeline.body.items.find((e: { id: string }) => e.id === eventId);
    expect(stored).toMatchObject({ type: 'sos', at: now().toISOString(), payload: { lat: -23.55, lng: -46.63 } });
    expect(timeline.body.items.find((e: { id: string }) => e.id === without.body.eventId).payload).toEqual({
      lat: null,
      lng: null,
      acknowledgedAt: null,
      acknowledgedBy: null,
      escalatedAt: null,
    });
  });

  it('is elder-only and needs both coordinates or none', async () => {
    const { elderId, elderToken, caregiver, other, otherElderToken } = await createScenario();
    const path = `/api/v1/elders/${elderId}/sos`;
    expectApiError(await request(app).post(path).set(bearer(caregiver.token)).send({}), 403, 'FORBIDDEN');
    expectApiError(await request(app).post(path).set(bearer(other.token)).send({}), 403, 'FORBIDDEN');
    expectApiError(await request(app).post(path).set(bearer(otherElderToken)).send({}), 403, 'FORBIDDEN');
    expectApiError(await request(app).post(path).send({}), 401, 'UNAUTHENTICATED');
    expectApiError(await request(app).post(path).set(bearer(elderToken)).send({ lat: -23.5 }), 400, 'VALIDATION_ERROR');
  });
});
