import { RoutineSchema, RoutinesResponseSchema } from '@aurelia/shared';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { bearer, buildApp, createScenario, expectApiError, fixedClock } from './helpers';

const now = fixedClock();
const app = buildApp({ now });

const meal = { type: 'meal', name: 'Almoço', time: '12:00', weekdays: [1, 2, 3, 4, 5] };
const pill = {
  type: 'medication',
  name: 'Losartana',
  time: '08:00',
  weekdays: [0, 1, 2, 3, 4, 5, 6],
  medication: { dosage: '50 mg', form: 'comprimido' },
};

async function setup() {
  const scenario = await createScenario();
  const base = `/api/v1/elders/${scenario.elderId}/routines`;
  const create = (body: unknown) => request(app).post(base).set(bearer(scenario.caregiver.token)).send(body as object);
  return { ...scenario, base, create };
}

describe('routines', () => {
  it('creates with defaults and lists in time order for both roles', async () => {
    const { create, base, caregiver, elderToken } = await setup();
    const created = await create(meal);
    expect(created.status).toBe(201);
    expect(RoutineSchema.parse(created.body)).toMatchObject({
      description: '',
      remindElder: true,
      alertIfMissed: false,
      active: true,
      medication: null,
      createdAt: now().toISOString(),
    });
    await create(pill);

    for (const token of [caregiver.token, elderToken]) {
      const list = await request(app).get(base).set(bearer(token));
      expect(list.status).toBe(200);
      expect(RoutinesResponseSchema.parse(list.body).items.map((r) => r.name)).toEqual(['Losartana', 'Almoço']);
    }
  });

  it('validates bodies', async () => {
    const { create } = await setup();
    const bad = [
      { ...meal, medication: pill.medication },
      { ...pill, medication: undefined },
      { ...meal, weekdays: [] },
      { ...meal, time: '8:00' },
      { ...meal, role: 'x' },
    ];
    for (const body of bad) expectApiError(await create(body), 400, 'VALIDATION_ERROR');
  });

  it('patches only what is sent and drops medication data when the type changes', async () => {
    const { create, base, caregiver } = await setup();
    const id = (await create(pill)).body.id as string;

    const renamed = await request(app).patch(`${base}/${id}`).set(bearer(caregiver.token)).send({ time: '09:30' });
    expect(renamed.body).toMatchObject({ time: '09:30', name: 'Losartana', medication: pill.medication });

    const asMeal = await request(app).patch(`${base}/${id}`).set(bearer(caregiver.token)).send({ type: 'meal' });
    expect(asMeal.body).toMatchObject({ type: 'meal', medication: null });
  });

  it('refuses to turn a routine into a medication without dose and form', async () => {
    const { create, base, caregiver } = await setup();
    const id = (await create(meal)).body.id as string;
    const patch = (body: object) => request(app).patch(`${base}/${id}`).set(bearer(caregiver.token)).send(body);

    expectApiError(await patch({ type: 'medication' }), 400, 'VALIDATION_ERROR');
    const ok = await patch({ type: 'medication', medication: pill.medication });
    expect(ok.body).toMatchObject({ type: 'medication', medication: pill.medication });
  });

  it('rejects empty patches and unknown fields, and 404s on a missing routine', async () => {
    const { create, base, caregiver } = await setup();
    const id = (await create(meal)).body.id as string;
    for (const body of [{}, { elderId: 'x' }]) {
      expectApiError(await request(app).patch(`${base}/${id}`).set(bearer(caregiver.token)).send(body), 400, 'VALIDATION_ERROR');
    }
    expectApiError(await request(app).patch(`${base}/missing`).set(bearer(caregiver.token)).send({ name: 'x' }), 404, 'NOT_FOUND');
  });

  it('DELETE deactivates instead of removing, and is idempotent', async () => {
    const { create, base, caregiver } = await setup();
    const id = (await create(meal)).body.id as string;
    expect((await request(app).delete(`${base}/${id}`).set(bearer(caregiver.token))).status).toBe(204);
    expect((await request(app).delete(`${base}/${id}`).set(bearer(caregiver.token))).status).toBe(204);

    const list = await request(app).get(base).set(bearer(caregiver.token));
    expect(list.body.items).toHaveLength(1);
    expect(list.body.items[0]).toMatchObject({ id, name: 'Almoço', active: false });
    expectApiError(await request(app).delete(`${base}/missing`).set(bearer(caregiver.token)), 404, 'NOT_FOUND');
  });
});
