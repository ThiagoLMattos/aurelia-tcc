import { CAREGIVER_INVITE_TTL_HOURS, ElderSchema } from '@aurelia/shared';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { bearer, buildApp, createCaregiver, createScenario, expectApiError, fixedClock, repos } from './helpers';

const clock = fixedClock('2026-03-11T15:00:00.000Z');
// The join limiter is per IP and every test shares one, so only the brute-force test uses a tight limit.
const app = buildApp({ now: clock, limits: { joinPer15Min: 1000 } });

const invite = async (token: string, elderId: string, renew = false) => {
  const response = await request(app)
    .post(`/api/v1/elders/${elderId}/caregiver-invites${renew ? '?renew=true' : ''}`)
    .set(bearer(token));
  expect([200, 201]).toContain(response.status);
  return response.body as { code: string; expiresAt: string };
};
const join = (token: string, code: string, target = app) => request(target).post('/api/v1/me/elders').set(bearer(token)).send({ code });
const caregiversOf = (token: string, elderId: string) => request(app).get(`/api/v1/elders/${elderId}/caregivers`).set(bearer(token));

describe('inviting another caregiver', () => {
  it('lets the invited caregiver follow the elder, with the same access', async () => {
    const { caregiver, elderId } = await createScenario();
    const bruno = await createCaregiver({ name: 'Bruno' });
    const { code, expiresAt } = await invite(caregiver.token, elderId);
    expect(expiresAt).toBe(new Date(clock().getTime() + CAREGIVER_INVITE_TTL_HOURS * 3_600_000).toISOString());

    expectApiError(await request(app).get(`/api/v1/elders/${elderId}`).set(bearer(bruno.token)), 403, 'FORBIDDEN');
    const joined = await join(bruno.token, code);
    expect(joined.status).toBe(201);
    expect(ElderSchema.parse(joined.body).id).toBe(elderId);

    expect((await request(app).get(`/api/v1/elders/${elderId}`).set(bearer(bruno.token))).status).toBe(200);
    const me = await request(app).get('/api/v1/me').set(bearer(bruno.token));
    expect(me.body.elders.map((e: { id: string }) => e.id)).toEqual([elderId]);

    // Any caregiver of the elder can invite in turn.
    expect((await invite(bruno.token, elderId)).code).toMatch(/^[A-Z2-9]{6}$/);

    const list = await caregiversOf(caregiver.token, elderId);
    expect(list.status).toBe(200);
    expect(list.body.items).toEqual(
      expect.arrayContaining([
        { id: caregiver.uid, name: caregiver.name, email: caregiver.email },
        { id: bruno.uid, name: 'Bruno', email: bruno.email },
      ]),
    );
  });

  it('keeps the invite already sent until it is renewed, used or expired', async () => {
    const { caregiver, elderId } = await createScenario();
    const bruno = await createCaregiver();
    const first = await invite(caregiver.token, elderId);
    expect(await invite(caregiver.token, elderId)).toEqual(first);
    expect((await join(bruno.token, first.code)).status).toBe(201);
    expect((await invite(caregiver.token, elderId)).code).not.toBe(first.code);
  });

  it('is single use, replaced by a renewed invite, and never signs a phone in', async () => {
    const { caregiver, elderId } = await createScenario();
    const [bruno, carla] = await Promise.all([createCaregiver(), createCaregiver()]);
    const first = await invite(caregiver.token, elderId);
    const second = await invite(caregiver.token, elderId, true);
    expect(second.code).not.toBe(first.code);
    expectApiError(await join(bruno.token, first.code), 404, 'NOT_FOUND');

    expectApiError(await request(app).post('/api/v1/auth/pair').send({ code: second.code }), 404, 'NOT_FOUND');
    expect((await join(bruno.token, second.code)).status).toBe(201);
    expectApiError(await join(carla.token, second.code), 404, 'NOT_FOUND');
  });

  it('keeps the elder phone code and the invite apart', async () => {
    const { caregiver, elderId } = await createScenario();
    const bruno = await createCaregiver();
    const phone = await request(app).post(`/api/v1/elders/${elderId}/pairing-codes`).set(bearer(caregiver.token));
    const { code } = await invite(caregiver.token, elderId);
    expectApiError(await join(bruno.token, phone.body.code as string), 404, 'NOT_FOUND');
    // Issuing the invite did not delete the phone code, and the other way round.
    expect((await request(app).post('/api/v1/auth/pair').send({ code: phone.body.code })).status).toBe(200);
    expect((await join(bruno.token, code)).status).toBe(201);
  });

  it('expires', async () => {
    const { caregiver, elderId } = await createScenario();
    const bruno = await createCaregiver();
    const { code } = await invite(caregiver.token, elderId);
    clock.set(new Date(clock().getTime() + CAREGIVER_INVITE_TTL_HOURS * 3_600_000));
    expectApiError(await join(bruno.token, code), 404, 'NOT_FOUND');
    clock.set('2026-03-11T15:00:00.000Z');
  });

  it('is for caregivers only', async () => {
    const { caregiver, other, elderId, elderToken } = await createScenario();
    const path = `/api/v1/elders/${elderId}/caregiver-invites`;
    expectApiError(await request(app).post(path).set(bearer(other.token)), 403, 'FORBIDDEN');
    expectApiError(await request(app).post(path).set(bearer(elderToken)), 403, 'FORBIDDEN');
    const { code } = await invite(caregiver.token, elderId);
    expectApiError(await join(elderToken, code), 403, 'FORBIDDEN');
    expectApiError(await request(app).post('/api/v1/me/elders').send({ code }), 401, 'UNAUTHENTICATED');
    expectApiError(await caregiversOf(elderToken, elderId), 403, 'FORBIDDEN');
  });

  it('rate limits guesses', async () => {
    const tight = buildApp({ now: clock, limits: { joinPer15Min: 2 } });
    const bruno = await createCaregiver();
    for (let i = 0; i < 2; i++) expectApiError(await join(bruno.token, 'ZZZZZZ', tight), 404, 'NOT_FOUND');
    expectApiError(await join(bruno.token, 'ZZZZZZ', tight), 429, 'RATE_LIMITED');
  });
});

describe('removing a caregiver', () => {
  async function shared() {
    const { caregiver, elderId } = await createScenario();
    const bruno = await createCaregiver({ name: 'Bruno' });
    await join(bruno.token, (await invite(caregiver.token, elderId)).code);
    return { ana: caregiver, bruno, elderId };
  }
  const remove = (token: string, elderId: string, caregiverId: string) =>
    request(app).delete(`/api/v1/elders/${elderId}/caregivers/${caregiverId}`).set(bearer(token));

  it('lets one caregiver remove another, who loses access at once', async () => {
    const { ana, bruno, elderId } = await shared();
    expect((await remove(ana.token, elderId, bruno.uid)).status).toBe(204);
    expectApiError(await request(app).get(`/api/v1/elders/${elderId}`).set(bearer(bruno.token)), 403, 'FORBIDDEN');
    expect((await repos.users.get(bruno.uid))?.elderIds).toEqual([]);
    expect((await repos.elders.get(elderId))?.caregiverIds).toEqual([ana.uid]);
  });

  it('lets a caregiver leave, but never the last one', async () => {
    const { ana, bruno, elderId } = await shared();
    expect((await remove(ana.token, elderId, ana.uid)).status).toBe(204);
    expectApiError(await remove(bruno.token, elderId, bruno.uid), 409, 'CONFLICT');
    expect((await repos.elders.get(elderId))?.caregiverIds).toEqual([bruno.uid]);
  });

  it('answers 404 for someone who does not follow the elder', async () => {
    const { ana, elderId } = await shared();
    const outsider = await createCaregiver();
    expectApiError(await remove(ana.token, elderId, outsider.uid), 404, 'NOT_FOUND');
  });
});
