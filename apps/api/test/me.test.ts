import { MeResponseSchema } from '@aurelia/shared';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import {
  DEFAULT_SETTINGS_PATCH,
  bearer,
  buildApp,
  createCaregiver,
  createElderDoc,
  elderToken,
  expectApiError,
  firebase,
  repos,
} from './helpers';

const app = buildApp();
const TOKEN_A = 'ExponentPushToken[aaaaaaaaaaaaaaaaaaaaaa]';
const TOKEN_B = 'ExponentPushToken[bbbbbbbbbbbbbbbbbbbbbb]';

describe('GET /api/v1/me', () => {
  it('returns the caregiver profile, settings and only the elders they can access', async () => {
    const caregiver = await createCaregiver({ name: 'Bia' });
    const mine = await createElderDoc([caregiver.uid], { name: 'Vovó Lia' });
    const notMine = await createElderDoc(['someone-else'], { name: 'Estranha' });
    await firebase.db.collection('users').doc(caregiver.uid).update({ elderIds: [mine, notMine] });

    const response = await request(app).get('/api/v1/me').set(bearer(caregiver.token));
    expect(response.status).toBe(200);
    const me = MeResponseSchema.parse(response.body);
    if (me.role !== 'caregiver') throw new Error('expected caregiver');
    expect(me.caregiver).toMatchObject({ id: caregiver.uid, name: 'Bia', email: caregiver.email });
    expect(me.elders.map((elder) => elder.name)).toEqual(['Vovó Lia']);
    expect(me.elders[0]?.locationState.status).toBe('unknown');
  });

  it('returns the elder for an elder token', async () => {
    const caregiver = await createCaregiver();
    const elderId = await createElderDoc([caregiver.uid], { name: 'Seu Zé' });

    const response = await request(app).get('/api/v1/me').set(bearer(await elderToken(elderId)));
    expect(response.status).toBe(200);
    const me = MeResponseSchema.parse(response.body);
    expect(me).toMatchObject({ role: 'elder', elder: { id: elderId, name: 'Seu Zé' } });
  });

  it('answers 404 when the elder behind the token no longer exists', async () => {
    expectApiError(await request(app).get('/api/v1/me').set(bearer(await elderToken('ghost'))), 404, 'NOT_FOUND');
  });
});

describe('PATCH /api/v1/me', () => {
  it('updates name and merges settings without touching the others', async () => {
    const caregiver = await createCaregiver();
    const response = await request(app)
      .patch('/api/v1/me')
      .set(bearer(caregiver.token))
      .send({ name: 'Nome Novo', settings: DEFAULT_SETTINGS_PATCH });
    expect(response.status).toBe(200);
    expect(MeResponseSchema.parse(response.body)).toMatchObject({
      caregiver: {
        name: 'Nome Novo',
        settings: {
          notifyMissedTask: false,
          notifyConfirmations: true,
          notifyAssistantInsights: true,
          escalation: 'meThenContacts',
        },
      },
    });
  });

  it('rejects an empty body and unknown keys', async () => {
    const caregiver = await createCaregiver();
    const patch = (body: object) => request(app).patch('/api/v1/me').set(bearer(caregiver.token)).send(body);
    expectApiError(await patch({}), 400, 'VALIDATION_ERROR');
    expectApiError(await patch({ role: 'elder' }), 400, 'VALIDATION_ERROR');
    expectApiError(await patch({ settings: { pushTokens: [] } }), 400, 'VALIDATION_ERROR');
  });

  it('is forbidden for elders', async () => {
    const elderId = await createElderDoc([]);
    const response = await request(app).patch('/api/v1/me').set(bearer(await elderToken(elderId))).send({ name: 'x' });
    expectApiError(response, 403, 'FORBIDDEN');
  });
});

describe('push tokens', () => {
  it('registers and unregisters caregiver tokens idempotently', async () => {
    const caregiver = await createCaregiver();
    const post = (token: string) =>
      request(app).post('/api/v1/me/push-tokens').set(bearer(caregiver.token)).send({ token });
    const del = (token: string) =>
      request(app).delete(`/api/v1/me/push-tokens/${encodeURIComponent(token)}`).set(bearer(caregiver.token));

    expect((await post(TOKEN_A)).status).toBe(204);
    expect((await post(TOKEN_A)).status).toBe(204);
    expect((await post(TOKEN_B)).status).toBe(204);
    expect((await repos.users.get(caregiver.uid))?.pushTokens.sort()).toEqual([TOKEN_A, TOKEN_B]);

    expect((await del(TOKEN_A)).status).toBe(204);
    expect((await del(TOKEN_A)).status).toBe(204);
    expect((await repos.users.get(caregiver.uid))?.pushTokens).toEqual([TOKEN_B]);
  });

  it('stores elder tokens on the elder document, not on any user', async () => {
    const caregiver = await createCaregiver();
    const elderId = await createElderDoc([caregiver.uid]);
    const token = await elderToken(elderId);

    const response = await request(app).post('/api/v1/me/push-tokens').set(bearer(token)).send({ token: TOKEN_A });
    expect(response.status).toBe(204);
    expect((await repos.elders.get(elderId))?.pushTokens).toEqual([TOKEN_A]);
    expect((await repos.users.get(caregiver.uid))?.pushTokens).toEqual([]);

    await request(app).delete(`/api/v1/me/push-tokens/${encodeURIComponent(TOKEN_A)}`).set(bearer(token));
    expect((await repos.elders.get(elderId))?.pushTokens).toEqual([]);
  });

  it('rejects something that is not an Expo push token', async () => {
    const caregiver = await createCaregiver();
    const response = await request(app)
      .post('/api/v1/me/push-tokens')
      .set(bearer(caregiver.token))
      .send({ token: 'abc' });
    expectApiError(response, 400, 'VALIDATION_ERROR');
  });
});
