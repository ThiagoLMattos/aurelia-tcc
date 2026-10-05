import { AgendaItemSchema, AgendaResponseSchema, type AgendaItem } from '@aurelia/shared';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { bearer, buildApp, createScenario, expectApiError, fixedClock } from './helpers';

// Wednesday 2026-03-11, noon in São Paulo.
const now = fixedClock('2026-03-11T15:00:00.000Z');
const app = buildApp({ now });

const everyDay = [0, 1, 2, 3, 4, 5, 6];

async function setup() {
  const scenario = await createScenario();
  const elder = `/api/v1/elders/${scenario.elderId}`;
  const addRoutine = async (body: Record<string, unknown>) => {
    const response = await request(app)
      .post(`${elder}/routines`)
      .set(bearer(scenario.caregiver.token))
      .send({ type: 'meal', weekdays: everyDay, ...body });
    expect(response.status).toBe(201);
    return response.body.id as string;
  };
  const agenda = (token: string, date?: string) =>
    request(app).get(`${elder}/agenda${date ? `?date=${date}` : ''}`).set(bearer(token));
  const done = (token: string, date: string, routineId: string) =>
    request(app).post(`${elder}/agenda/${date}/${routineId}/done`).set(bearer(token));
  const undo = (token: string, date: string, routineId: string) =>
    request(app).delete(`${elder}/agenda/${date}/${routineId}/done`).set(bearer(token));
  const events = (types?: string) =>
    request(app).get(`${elder}/events${types ? `?types=${types}` : ''}`).set(bearer(scenario.caregiver.token));
  return { ...scenario, addRoutine, agenda, done, undo, events };
}

describe('GET agenda', () => {
  it('computes statuses with the shared function and orders by time', async () => {
    const { addRoutine, agenda, caregiver, elderToken } = await setup();
    await addRoutine({ name: 'Jantar', time: '18:00' });
    await addRoutine({ name: 'Almoço', time: '12:00' });
    await addRoutine({ name: 'Café', time: '08:00' });
    await addRoutine({ name: 'Inativa', time: '09:00', active: false });
    await addRoutine({ name: 'Só domingo', time: '10:00', weekdays: [0] });

    for (const token of [caregiver.token, elderToken]) {
      const response = await agenda(token);
      expect(response.status).toBe(200);
      const body = AgendaResponseSchema.parse(response.body);
      expect(body.date).toBe('2026-03-11');
      expect(body.items.map((i) => [i.name, i.status])).toEqual([
        ['Café', 'pending'],
        ['Almoço', 'now'],
        ['Jantar', 'upcoming'],
      ]);
    }
  });

  it('defaults to the elder’s local date, not the server’s', async () => {
    const { addRoutine, agenda, caregiver } = await setup();
    await addRoutine({ name: 'Café', time: '08:00' });
    // 02:00Z on the 12th is still 23:00 on the 11th in São Paulo.
    now.set('2026-03-12T02:00:00.000Z');
    try {
      const response = await agenda(caregiver.token);
      expect(response.body.date).toBe('2026-03-11');
      expect(response.body.items[0].status).toBe('pending');
    } finally {
      now.set('2026-03-11T15:00:00.000Z');
    }
  });

  it('validates the date', async () => {
    const { agenda, caregiver } = await setup();
    expectApiError(await agenda(caregiver.token, '2026-13-40'), 400, 'VALIDATION_ERROR');
  });
});

describe('marking done', () => {
  it('records the confirmation, returns the item and writes one taskDone event', async () => {
    const { addRoutine, done, agenda, events, elderToken, caregiver } = await setup();
    const id = await addRoutine({ name: 'Almoço', time: '12:00' });

    const response = await done(elderToken, '2026-03-11', id);
    expect(response.status).toBe(200);
    const item: AgendaItem = AgendaItemSchema.parse(response.body);
    expect(item).toMatchObject({ routineId: id, status: 'done', doneBy: 'elder', doneAt: now().toISOString() });

    const list = await agenda(caregiver.token);
    expect(list.body.items[0]).toMatchObject({ status: 'done', doneBy: 'elder' });

    const timeline = await events('taskDone');
    expect(timeline.body.items).toHaveLength(1);
    expect(timeline.body.items[0]).toMatchObject({
      type: 'taskDone',
      date: '2026-03-11',
      payload: { routineId: id, routineName: 'Almoço', doneBy: 'elder', scheduledTime: '12:00', undoneAt: null },
    });
  });

  it('answers 409 the second time, whoever confirms', async () => {
    const { addRoutine, done, elderToken, caregiver } = await setup();
    const id = await addRoutine({ name: 'Almoço', time: '12:00' });
    expect((await done(elderToken, '2026-03-11', id)).status).toBe(200);
    expectApiError(await done(elderToken, '2026-03-11', id), 409, 'CONFLICT');
    expectApiError(await done(caregiver.token, '2026-03-11', id), 409, 'CONFLICT');
  });

  it('lets the elder confirm only today', async () => {
    const { addRoutine, done, elderToken } = await setup();
    const id = await addRoutine({ name: 'Almoço', time: '12:00' });
    expectApiError(await done(elderToken, '2026-03-10', id), 403, 'FORBIDDEN');
    expectApiError(await done(elderToken, '2026-03-12', id), 403, 'FORBIDDEN');
  });

  it('lets a caregiver confirm today and the two days before, not older or future', async () => {
    const { addRoutine, done, caregiver } = await setup();
    const id = await addRoutine({ name: 'Almoço', time: '12:00' });
    for (const date of ['2026-03-11', '2026-03-10', '2026-03-09']) {
      const response = await done(caregiver.token, date, id);
      expect(response.status, date).toBe(200);
      expect(response.body.doneBy).toBe('caregiver');
    }
    expectApiError(await done(caregiver.token, '2026-03-08', id), 403, 'FORBIDDEN');
    expectApiError(await done(caregiver.token, '2026-03-12', id), 403, 'FORBIDDEN');
  });

  it('404s for a routine that is missing, inactive or not scheduled that day', async () => {
    const { addRoutine, done, caregiver } = await setup();
    const inactive = await addRoutine({ name: 'Antiga', time: '09:00', active: false });
    const sundayOnly = await addRoutine({ name: 'Domingo', time: '10:00', weekdays: [0] });
    for (const id of ['missing', inactive, sundayOnly]) {
      expectApiError(await done(caregiver.token, '2026-03-11', id), 404, 'NOT_FOUND');
    }
  });
});

describe('undo', () => {
  it('removes the confirmation, keeps the event flagged and appends nothing', async () => {
    const { addRoutine, done, undo, agenda, events, caregiver } = await setup();
    const id = await addRoutine({ name: 'Almoço', time: '12:00' });
    await done(caregiver.token, '2026-03-11', id);

    expect((await undo(caregiver.token, '2026-03-11', id)).status).toBe(204);

    expect((await agenda(caregiver.token)).body.items[0]).toMatchObject({ status: 'now', doneAt: null, doneBy: null });
    const timeline = await events();
    expect(timeline.body.items).toHaveLength(1);
    expect(timeline.body.items[0].payload.undoneAt).toBe(now().toISOString());

    // It can be confirmed again after an undo.
    expect((await done(caregiver.token, '2026-03-11', id)).status).toBe(200);
  });

  it('404s when there is nothing to undo, and is for caregivers only', async () => {
    const { addRoutine, done, undo, caregiver, elderToken } = await setup();
    const id = await addRoutine({ name: 'Almoço', time: '12:00' });
    expectApiError(await undo(caregiver.token, '2026-03-11', id), 404, 'NOT_FOUND');
    await done(elderToken, '2026-03-11', id);
    expectApiError(await undo(elderToken, '2026-03-11', id), 403, 'FORBIDDEN');
  });
});
