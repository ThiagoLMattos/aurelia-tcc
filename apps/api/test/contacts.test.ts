import { ContactSchema, ContactsResponseSchema, MAX_EMERGENCY_CONTACTS } from '@aurelia/shared';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { bearer, buildApp, createScenario, expectApiError, fixedClock } from './helpers';

const app = buildApp({ now: fixedClock() });

async function setup() {
  const scenario = await createScenario();
  const base = `/api/v1/elders/${scenario.elderId}/contacts`;
  const create = (body: object, token = scenario.caregiver.token) => request(app).post(base).set(bearer(token)).send(body);
  const contact = (name: string, extra: object = {}) => ({ name, phone: '+5511999999999', relation: 'Filha', ...extra });
  return { ...scenario, base, create, contact };
}

describe('contacts', () => {
  it('normalises phones to E.164 and fills defaults', async () => {
    const { create, contact } = await setup();
    const response = await create(contact('Ana', { phone: '(11) 98888-7777' }));
    expect(response.status).toBe(201);
    expect(ContactSchema.parse(response.body)).toMatchObject({
      phone: '+5511988887777',
      isEmergency: false,
      priority: 100,
    });
    expectApiError(await create(contact('Bia', { phone: '123' })), 400, 'VALIDATION_ERROR');
  });

  it('lists by priority, then name, for both roles', async () => {
    const { create, contact, base, caregiver, elderToken } = await setup();
    await create(contact('Zeca', { priority: 1 }));
    await create(contact('Bia', { priority: 5 }));
    await create(contact('Ana', { priority: 5 }));

    for (const token of [caregiver.token, elderToken]) {
      const list = await request(app).get(base).set(bearer(token));
      expect(ContactsResponseSchema.parse(list.body).items.map((c) => c.name)).toEqual(['Zeca', 'Ana', 'Bia']);
    }
  });

  it('allows the elder to manage contacts too', async () => {
    const { create, contact, elderToken, base } = await setup();
    const created = await create(contact('Ana'), elderToken);
    expect(created.status).toBe(201);
    const patched = await request(app).patch(`${base}/${created.body.id}`).set(bearer(elderToken)).send({ name: 'Ana Paula' });
    expect(patched.body.name).toBe('Ana Paula');
  });

  it('caps emergency contacts at five on create and on patch', async () => {
    const { create, contact, base, caregiver } = await setup();
    for (let i = 0; i < MAX_EMERGENCY_CONTACTS; i++) {
      expect((await create(contact(`Contato ${i}`, { isEmergency: true }))).status).toBe(201);
    }
    expectApiError(await create(contact('Sexto', { isEmergency: true })), 409, 'CONFLICT');

    const regular = await create(contact('Vizinha'));
    expect(regular.status).toBe(201);
    const promote = await request(app).patch(`${base}/${regular.body.id}`).set(bearer(caregiver.token)).send({ isEmergency: true });
    expectApiError(promote, 409, 'CONFLICT');
    expect((await request(app).patch(`${base}/${regular.body.id}`).set(bearer(caregiver.token)).send({ priority: 3 })).status).toBe(200);
  });

  it('does not count a contact that is already an emergency contact against the limit', async () => {
    const { create, contact, base, caregiver } = await setup();
    const ids: string[] = [];
    for (let i = 0; i < MAX_EMERGENCY_CONTACTS; i++) ids.push((await create(contact(`C${i}`, { isEmergency: true }))).body.id);
    const again = await request(app).patch(`${base}/${ids[0]}`).set(bearer(caregiver.token)).send({ isEmergency: true, name: 'Renomeado' });
    expect(again.status).toBe(200);
  });

  it('rejects extra fields and empty patches, 404s on missing, deletes idempotently', async () => {
    const { create, contact, base, caregiver } = await setup();
    expectApiError(await create({ ...contact('Ana'), elderId: 'x' }), 400, 'VALIDATION_ERROR');
    const id = (await create(contact('Ana'))).body.id as string;
    expectApiError(await request(app).patch(`${base}/${id}`).set(bearer(caregiver.token)).send({}), 400, 'VALIDATION_ERROR');
    expectApiError(await request(app).patch(`${base}/missing`).set(bearer(caregiver.token)).send({ name: 'x' }), 404, 'NOT_FOUND');
    expect((await request(app).delete(`${base}/${id}`).set(bearer(caregiver.token))).status).toBe(204);
    expect((await request(app).delete(`${base}/${id}`).set(bearer(caregiver.token))).status).toBe(204);
    expect((await request(app).get(base).set(bearer(caregiver.token))).body.items).toEqual([]);
  });
});
