import { ElderDetailResponseSchema, ElderSchema } from '@aurelia/shared';
import { Timestamp } from 'firebase-admin/firestore';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { bearer, buildApp, createCaregiver, createScenario, expectApiError, firebase, fixedClock, repos } from './helpers';

const now = fixedClock();
const app = buildApp({ now });

const validElder = { name: 'Dona Maria', birthDate: '1945-03-10', diagnosisStage: 'early' as const };

describe('POST /elders', () => {
  it('creates the elder with defaults and links it to the creator in the same write', async () => {
    const caregiver = await createCaregiver();
    const response = await request(app).post('/api/v1/elders').set(bearer(caregiver.token)).send(validElder);

    expect(response.status).toBe(201);
    const elder = ElderSchema.parse(response.body);
    expect(elder).toMatchObject({
      name: 'Dona Maria',
      timezone: 'America/Sao_Paulo',
      missedTaskTimeoutMin: 30,
      safeZone: null,
      phonePaired: false,
      createdAt: now().toISOString(),
      locationState: { status: 'unknown', consecutiveInside: 0, consecutiveOutside: 0 },
    });

    const doc = await repos.elders.get(elder.id);
    expect(doc?.caregiverIds).toEqual([caregiver.uid]);
    expect(doc?.createdBy).toBe(caregiver.uid);
    expect((await repos.users.get(caregiver.uid))?.elderIds).toEqual([elder.id]);
  });

  it('shows up in GET /me', async () => {
    const caregiver = await createCaregiver();
    const created = await request(app).post('/api/v1/elders').set(bearer(caregiver.token)).send(validElder);
    const me = await request(app).get('/api/v1/me').set(bearer(caregiver.token));
    expect(me.body.elders.map((e: { id: string }) => e.id)).toEqual([created.body.id]);
  });

  it('rejects fields the caller must not set', async () => {
    const caregiver = await createCaregiver();
    const response = await request(app)
      .post('/api/v1/elders')
      .set(bearer(caregiver.token))
      .send({ ...validElder, caregiverIds: ['someone-else'] });
    expectApiError(response, 400, 'VALIDATION_ERROR');
  });

  it('rejects an invalid timezone and an elder token', async () => {
    const caregiver = await createCaregiver();
    expectApiError(
      await request(app).post('/api/v1/elders').set(bearer(caregiver.token)).send({ ...validElder, timezone: 'Mars/Base' }),
      400,
      'VALIDATION_ERROR',
    );
    const { elderToken } = await createScenario();
    expectApiError(await request(app).post('/api/v1/elders').set(bearer(elderToken)).send(validElder), 403, 'FORBIDDEN');
  });

  it('writes nothing when the caregiver has no profile document', async () => {
    const { uid } = await firebase.auth.createUser({ email: 'noprofile@example.com', password: 'senha-segura-123' });
    await firebase.auth.setCustomUserClaims(uid, { role: 'caregiver' });
    const { tokenFor } = await import('./helpers');
    const response = await request(app)
      .post('/api/v1/elders')
      .set(bearer(await tokenFor(uid)))
      .send(validElder);
    expectApiError(response, 404, 'NOT_FOUND');
    expect((await repos.elders.listAll()).filter((e) => e.createdBy === uid)).toEqual([]);
  });
});

describe('GET /elders/:elderId', () => {
  it('returns the profile with its device summaries', async () => {
    const { caregiver, elderId, elderToken } = await createScenario();
    await firebase.db
      .collection('elders')
      .doc(elderId)
      .collection('devices')
      .doc('dev1')
      .set({ label: 'Pulseira', secretHash: 'x', createdAt: Timestamp.now(), lastSeenAt: Timestamp.fromDate(new Date('2026-03-11T14:00:00Z')), batteryPct: 80 });

    for (const token of [caregiver.token, elderToken]) {
      const response = await request(app).get(`/api/v1/elders/${elderId}`).set(bearer(token));
      expect(response.status).toBe(200);
      const detail = ElderDetailResponseSchema.parse(response.body);
      expect(detail.id).toBe(elderId);
      expect(detail.devices).toEqual([
        { id: 'dev1', label: 'Pulseira', lastSeenAt: '2026-03-11T14:00:00.000Z', batteryPct: 80 },
      ]);
    }
  });

  it('answers 404 for an unknown elder and 400 for an id Firestore would refuse', async () => {
    const { caregiver } = await createScenario();
    expectApiError(await request(app).get('/api/v1/elders/nope').set(bearer(caregiver.token)), 404, 'NOT_FOUND');
    expectApiError(await request(app).get('/api/v1/elders/__reserved__').set(bearer(caregiver.token)), 400, 'VALIDATION_ERROR');
  });
});

describe('PATCH /elders/:elderId', () => {
  it('changes only the fields sent and can clear the safe zone', async () => {
    const { caregiver, elderId } = await createScenario();
    const path = `/api/v1/elders/${elderId}`;

    const renamed = await request(app).patch(path).set(bearer(caregiver.token)).send({ name: 'Maria Silva' });
    expect(renamed.status).toBe(200);
    expect(renamed.body).toMatchObject({ name: 'Maria Silva', birthDate: '1945-03-10', missedTaskTimeoutMin: 30 });

    const zone = { lat: -23.55, lng: -46.63, radiusM: 200 };
    const withZone = await request(app)
      .patch(path)
      .set(bearer(caregiver.token))
      .send({ safeZone: zone, missedTaskTimeoutMin: 60, diagnosisStage: 'moderate' });
    expect(withZone.body).toMatchObject({ safeZone: zone, missedTaskTimeoutMin: 60, diagnosisStage: 'moderate', name: 'Maria Silva' });

    const cleared = await request(app).patch(path).set(bearer(caregiver.token)).send({ safeZone: null });
    expect(cleared.body.safeZone).toBeNull();
  });

  it('rejects unknown, forbidden and empty bodies', async () => {
    const { caregiver, elderId } = await createScenario();
    const path = `/api/v1/elders/${elderId}`;
    for (const body of [{ caregiverIds: ['x'] }, { locationState: {} }, {}, { missedTaskTimeoutMin: 20 }]) {
      expectApiError(await request(app).patch(path).set(bearer(caregiver.token)).send(body), 400, 'VALIDATION_ERROR');
    }
    expect((await repos.elders.get(elderId))?.caregiverIds).toEqual([caregiver.uid]);
  });
});
