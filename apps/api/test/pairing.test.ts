import { PAIRING_CODE_ALPHABET, PairResponseSchema } from '@aurelia/shared';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { bearer, buildApp, createScenario, exchangeCustomToken, expectApiError, firebase, fixedClock } from './helpers';

const now = fixedClock();
// The limiter is per IP and every test shares one, so only the brute-force test uses a tight limit.
const app = buildApp({ now, pairPer15Min: 1000 });
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const issue = async (token: string, elderId: string) => {
  const response = await request(app).post(`/api/v1/elders/${elderId}/pairing-codes`).set(bearer(token));
  expect(response.status).toBe(201);
  return response.body as { code: string; expiresAt: string };
};

const pair = (code: string, target = app) => request(target).post('/api/v1/auth/pair').send({ code });

describe('issuing codes', () => {
  it('returns a 6 character code from the safe alphabet that expires in 15 minutes', async () => {
    const { caregiver, elderId } = await createScenario();
    const { code, expiresAt } = await issue(caregiver.token, elderId);
    expect(code).toMatch(new RegExp(`^[${PAIRING_CODE_ALPHABET}]{6}$`));
    expect(expiresAt).toBe(new Date(now().getTime() + 15 * 60_000).toISOString());
  });

  it('replaces the elder’s earlier unused code', async () => {
    const { caregiver, elderId } = await createScenario();
    const first = await issue(caregiver.token, elderId);
    const second = await issue(caregiver.token, elderId);
    expect(second.code).not.toBe(first.code);
    expectApiError(await pair(first.code), 404, 'NOT_FOUND');
    expect((await pair(second.code)).status).toBe(200);
  });

  it('is for caregivers of that elder only', async () => {
    const { other, elderId, elderToken } = await createScenario();
    const path = `/api/v1/elders/${elderId}/pairing-codes`;
    expectApiError(await request(app).post(path).set(bearer(other.token)), 403, 'FORBIDDEN');
    expectApiError(await request(app).post(path).set(bearer(elderToken)), 403, 'FORBIDDEN');
    expectApiError(await request(app).post(path), 401, 'UNAUTHENTICATED');
  });
});

describe('POST /auth/pair', () => {
  it('returns a custom token that signs in as the elder', async () => {
    const { caregiver, elderId } = await createScenario();
    const { code } = await issue(caregiver.token, elderId);

    const response = await pair(code.toLowerCase());
    expect(response.status).toBe(200);
    const body = PairResponseSchema.parse(response.body);
    expect(body.elder).toEqual({ id: elderId, name: 'Dona Maria' });

    const idToken = await exchangeCustomToken(body.customToken);
    const claims = await firebase.auth.verifyIdToken(idToken, true);
    expect(claims.uid).toBe(`elder_${elderId}`);
    expect(claims.role).toBe('elder');
    expect(claims.elderId).toBe(elderId);

    const me = await request(app).get('/api/v1/me').set(bearer(idToken));
    expect(me.status).toBe(200);
    expect(me.body.role).toBe('elder');
    expect(me.body.elder.phonePaired).toBe(true);
  });

  it('rejects a reused code, an expired code and an unknown code with the same answer', async () => {
    const { caregiver, elderId } = await createScenario();

    const used = await issue(caregiver.token, elderId);
    expect((await pair(used.code)).status).toBe(200);
    const reused = await pair(used.code);

    const stale = await issue(caregiver.token, elderId);
    now.set(new Date(now().getTime() + 15 * 60_000));
    const expired = await pair(stale.code);
    now.set('2026-03-11T15:00:00.000Z');

    const unknown = await pair('ZZZZZZ');

    for (const response of [reused, expired, unknown]) {
      expectApiError(response, 404, 'NOT_FOUND');
      expect(response.body.error.message).toBe(unknown.body.error.message);
    }
  });

  it('rejects a malformed code', async () => {
    expectApiError(await pair('12'), 400, 'VALIDATION_ERROR');
    expectApiError(await request(app).post('/api/v1/auth/pair').send({ code: 'ABC234', extra: 1 }), 400, 'VALIDATION_ERROR');
  });

  it('rate limits guessing', async () => {
    const limited = buildApp({ now, pairPer15Min: 3 });
    for (let i = 0; i < 3; i++) expectApiError(await pair('ZZZZZZ', limited), 404, 'NOT_FOUND');
    expectApiError(await pair('ZZZZZZ', limited), 429, 'RATE_LIMITED');
  });

  it('pairing again signs the previous phone out', async () => {
    const { caregiver, elderId } = await createScenario();
    const first = PairResponseSchema.parse((await pair((await issue(caregiver.token, elderId)).code)).body);
    const oldToken = await exchangeCustomToken(first.customToken);
    await firebase.db.collection('elders').doc(elderId).update({ pushTokens: ['ExponentPushToken[old]'] });
    expect((await request(app).get('/api/v1/me').set(bearer(oldToken))).status).toBe(200);

    // Token revocation has one-second resolution.
    await sleep(1100);
    const second = PairResponseSchema.parse((await pair((await issue(caregiver.token, elderId)).code)).body);
    const newToken = await exchangeCustomToken(second.customToken);

    expectApiError(await request(app).get('/api/v1/me').set(bearer(oldToken)), 401, 'UNAUTHENTICATED');
    expect((await request(app).get('/api/v1/me').set(bearer(newToken))).status).toBe(200);
    expect((await firebase.db.collection('elders').doc(elderId).get()).data()?.pushTokens).toEqual([]);
  });
});

describe('DELETE /elders/:elderId/session', () => {
  it('signs the elder phone out and clears its push tokens', async () => {
    const { caregiver, elderId } = await createScenario();
    const paired = PairResponseSchema.parse((await pair((await issue(caregiver.token, elderId)).code)).body);
    const elderIdToken = await exchangeCustomToken(paired.customToken);
    await request(app)
      .post('/api/v1/me/push-tokens')
      .set(bearer(elderIdToken))
      .send({ token: 'ExponentPushToken[elder]' });

    await sleep(1100);
    const response = await request(app).delete(`/api/v1/elders/${elderId}/session`).set(bearer(caregiver.token));
    expect(response.status).toBe(204);

    expectApiError(await request(app).get('/api/v1/me').set(bearer(elderIdToken)), 401, 'UNAUTHENTICATED');
    const elder = await request(app).get(`/api/v1/elders/${elderId}`).set(bearer(caregiver.token));
    expect(elder.body.phonePaired).toBe(false);
    expect((await firebase.db.collection('elders').doc(elderId).get()).data()?.pushTokens).toEqual([]);
  });

  it('is idempotent and works for an elder that never paired', async () => {
    const { caregiver, elderId } = await createScenario();
    const path = `/api/v1/elders/${elderId}/session`;
    expect((await request(app).delete(path).set(bearer(caregiver.token))).status).toBe(204);
    expect((await request(app).delete(path).set(bearer(caregiver.token))).status).toBe(204);
  });

  it('is for caregivers of that elder only', async () => {
    const { other, elderId, elderToken } = await createScenario();
    const path = `/api/v1/elders/${elderId}/session`;
    expectApiError(await request(app).delete(path).set(bearer(other.token)), 403, 'FORBIDDEN');
    expectApiError(await request(app).delete(path).set(bearer(elderToken)), 403, 'FORBIDDEN');
  });
});
