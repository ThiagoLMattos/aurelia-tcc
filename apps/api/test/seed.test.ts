import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { DEMO_EMAIL, seedDemo, wipeDemo } from '../scripts/seed-demo';
import { createLogger } from '../src/logger';
import { bearer, buildApp, config, createScenario, exchangeCustomToken, firebase, fixedClock, repos } from './helpers';

// A Wednesday at noon in São Paulo, so the seeded week has a known shape.
const NOW = '2026-03-11T15:00:00.000Z';
const seed = () => seedDemo({ firebase, logger: createLogger(config), password: 'demo-password-123', now: fixedClock(NOW) });

async function timeline(elderId: string) {
  const snap = await firebase.db.collection('elders').doc(elderId).collection('events').orderBy('at').get();
  return snap.docs.map((doc) => doc.data() as { type: string; payload: Record<string, unknown> });
}

describe('demo seed', () => {
  it('builds a believable week for one caregiver and one elder', async () => {
    const result = await seed();
    expect(result).toMatchObject({ email: DEMO_EMAIL, password: 'demo-password-123', elderName: 'Maria Aparecida' });
    expect(result.counts).toMatchObject({ routines: 7, contacts: 2 });
    expect(result.counts.occurrences).toBeGreaterThan(25);

    const types = (await timeline(result.elderId)).map((event) => event.type);
    const count = (type: string) => types.filter((t) => t === type).length;
    expect(count('devicePaired')).toBe(1);
    expect(count('sos')).toBe(1);
    expect(count('geofenceExit')).toBe(1);
    expect(count('geofenceReturn')).toBe(1);
    expect(count('taskMissed')).toBeGreaterThanOrEqual(2);
    expect(count('taskDone')).toBeGreaterThan(20);
    expect(count('gamePlayed')).toBe(8);

    const exit = (await timeline(result.elderId)).find((event) => event.type === 'geofenceExit');
    expect(exit?.payload.resolvedAt).toBeTruthy();

    const elder = await repos.elders.get(result.elderId);
    expect(elder).toMatchObject({ name: 'Maria Aparecida', phonePairedAt: null });
    expect(elder?.locationState.status).toBe('inside');
    expect(elder?.safeZone).toMatchObject({ radiusM: 100 });
  });

  it('prints a login, a pairing code and a tracker secret that all work', async () => {
    const result = await seed();
    const app = buildApp({ now: fixedClock(NOW) });

    const paired = await request(app).post('/api/v1/auth/pair').send({ code: result.pairingCode });
    expect(paired.status).toBe(200);
    expect(paired.body.elder).toEqual({ id: result.elderId, name: 'Maria Aparecida' });

    const token = await exchangeCustomToken(paired.body.customToken);
    const agenda = await request(app).get('/api/v1/elders/' + result.elderId + '/agenda').set(bearer(token));
    expect(agenda.status).toBe(200);
    expect(agenda.body.items.length).toBeGreaterThanOrEqual(6);

    const report = await request(app)
      .post('/api/v1/device/location')
      .set({ 'X-Device-Id': result.deviceId, 'X-Device-Secret': result.deviceSecret })
      .send({ lat: -22.9056, lng: -47.0608 });
    expect(report.status).toBe(200);
  });

  it('is idempotent and leaves nobody else’s data alone', async () => {
    const bystander = await createScenario();
    const first = await seed();
    const second = await seed();

    expect(second.caregiverId).not.toBe(first.caregiverId);
    expect((await firebase.db.collection('elders').doc(first.elderId).get()).exists).toBe(false);
    for (const collection of ['deviceIndex', 'pairingCodes']) {
      expect((await firebase.db.collection(collection).get()).size, collection).toBe(1);
    }
    // The bystander's elder and its (empty) timeline survive both runs untouched.
    expect(await repos.elders.get(bystander.elderId)).not.toBeNull();
    expect(await timeline(bystander.elderId)).toEqual([]);
    expect((await firebase.db.collection('elders').get()).size).toBe(3);
  });

  it('wipes cleanly when there is nothing to wipe', async () => {
    await wipeDemo(firebase);
    await wipeDemo(firebase);
  });
});
