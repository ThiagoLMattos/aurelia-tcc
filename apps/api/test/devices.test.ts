import { CreateDeviceResponseSchema, LocationResponseSchema } from '@aurelia/shared';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import {
  bearer,
  buildApp,
  buildStack,
  createScenario,
  expectApiError,
  fakePush,
  firebase,
  fixedClock,
  repos,
} from './helpers';

const clock = fixedClock('2026-03-11T15:00:00.000Z');
const app = buildApp({ now: clock, limits: { deviceLocationPerWindow: 1000 } });
const ZONE = { lat: -23.55, lng: -46.63, radiusM: 100 };
const HOME = { lat: ZONE.lat, lng: ZONE.lng };
const FAR = { lat: ZONE.lat + 0.01, lng: ZONE.lng }; // about 1.1 km north

const register = async (target = app, label = 'Pulseira') => {
  const scenario = await createScenario();
  await repos.elders.update(scenario.elderId, { safeZone: ZONE });
  const created = await request(target)
    .post(`/api/v1/elders/${scenario.elderId}/devices`)
    .set(bearer(scenario.caregiver.token))
    .send({ label });
  expect(created.status).toBe(201);
  const device = CreateDeviceResponseSchema.parse(created.body);
  return { ...scenario, ...device };
};

const report = (target: typeof app, device: { deviceId: string; secret: string }, body: object) =>
  request(target)
    .post('/api/v1/device/location')
    .set({ 'X-Device-Id': device.deviceId, 'X-Device-Secret': device.secret })
    .send(body);

describe('registering trackers', () => {
  it('returns the secret once and stores only its hash', async () => {
    const { elderId, deviceId, secret, caregiver } = await register();
    expect(secret.length).toBeGreaterThanOrEqual(43);

    const stored = (await firebase.db.doc(`elders/${elderId}/devices/${deviceId}`).get()).data() ?? {};
    expect(JSON.stringify(stored)).not.toContain(secret);
    expect(stored.secretHash).toMatch(/^[0-9a-f]{64}$/);
    expect((await firebase.db.doc(`deviceIndex/${deviceId}`).get()).data()).toEqual({ elderId });

    const detail = await request(app).get(`/api/v1/elders/${elderId}`).set(bearer(caregiver.token));
    expect(detail.body.devices).toEqual([{ id: deviceId, label: 'Pulseira', lastSeenAt: null, batteryPct: null }]);
    expect(JSON.stringify(detail.body)).not.toContain(secret);

    const timeline = await request(app).get(`/api/v1/elders/${elderId}/events?types=devicePaired`).set(bearer(caregiver.token));
    expect(timeline.body.items).toHaveLength(1);
    expect(timeline.body.items[0].payload).toEqual({ deviceId, label: 'Pulseira' });
  });

  it('is caregiver-only and limited to the caregiver’s own elders', async () => {
    const { elderId, elderToken: token, other, caregiver } = await createScenario();
    const path = `/api/v1/elders/${elderId}/devices`;
    expectApiError(await request(app).post(path).set(bearer(token)).send({ label: 'x' }), 403, 'FORBIDDEN');
    expectApiError(await request(app).post(path).set(bearer(other.token)).send({ label: 'x' }), 403, 'FORBIDDEN');
    expectApiError(await request(app).post(path).set(bearer(caregiver.token)).send({}), 400, 'VALIDATION_ERROR');
    expectApiError(await request(app).post(path).set(bearer(caregiver.token)).send({ label: 'x', extra: 1 }), 400, 'VALIDATION_ERROR');
  });

  it('removes a tracker and then rejects its credentials', async () => {
    const device = await register();
    const path = `/api/v1/elders/${device.elderId}/devices/${device.deviceId}`;
    expectApiError(await request(app).delete(path).set(bearer(device.elderToken)), 403, 'FORBIDDEN');
    expectApiError(await request(app).delete(path).set(bearer(device.other.token)), 403, 'FORBIDDEN');

    expect((await request(app).delete(path).set(bearer(device.caregiver.token))).status).toBe(204);
    expectApiError(await request(app).delete(path).set(bearer(device.caregiver.token)), 404, 'NOT_FOUND');
    expectApiError(await report(app, device, HOME), 401, 'UNAUTHENTICATED');
    expect((await firebase.db.doc(`deviceIndex/${device.deviceId}`).get()).exists).toBe(false);
  });

  it('cannot delete a device through another elder', async () => {
    const device = await register();
    const { caregiver, elderId } = await createScenario();
    expectApiError(
      await request(app).delete(`/api/v1/elders/${elderId}/devices/${device.deviceId}`).set(bearer(caregiver.token)),
      404,
      'NOT_FOUND',
    );
    expect(await repos.devices.get(device.elderId, device.deviceId)).not.toBeNull();
  });
});

describe('POST /device/location', () => {
  it('rejects missing, unknown and wrong credentials the same way', async () => {
    const device = await register();
    expectApiError(await request(app).post('/api/v1/device/location').send(HOME), 401, 'UNAUTHENTICATED');
    expectApiError(await report(app, { ...device, secret: 'wrong' }, HOME), 401, 'UNAUTHENTICATED');
    expectApiError(await report(app, { deviceId: 'nope', secret: device.secret }, HOME), 401, 'UNAUTHENTICATED');
    expect(await repos.devices.get(device.elderId, device.deviceId)).toMatchObject({ lastSeenAt: null });
  });

  it('validates the body', async () => {
    const device = await register();
    expectApiError(await report(app, device, { lat: 95, lng: 0 }), 400, 'VALIDATION_ERROR');
    expectApiError(await report(app, device, { ...HOME, extra: true }), 400, 'VALIDATION_ERROR');
  });

  it('allows one report per 10 seconds per device', async () => {
    const limited = buildApp({ now: clock });
    const device = await register(limited);
    expect((await report(limited, device, HOME)).status).toBe(200);
    expectApiError(await report(limited, device, HOME), 429, 'RATE_LIMITED');

    // Another device is not affected by the first one's limit.
    const second = await register(limited);
    expect((await report(limited, second, HOME)).status).toBe(200);
  });

  it('records battery, firmware and last contact', async () => {
    const device = await register();
    const response = await report(app, device, { ...HOME, batteryPct: 61, fwVersion: '1.2.3', accuracyM: 8 });
    expect(response.body).toEqual({ ok: true });
    expect(await repos.devices.get(device.elderId, device.deviceId)).toMatchObject({
      batteryPct: 61,
      firmwareVersion: '1.2.3',
      lastSeenAt: clock(),
    });
  });

  it('emits one exit and one return, each with a push, over a full walk', async () => {
    const push = fakePush();
    const { app: walkApp } = buildStack({ now: clock, push, limits: { deviceLocationPerWindow: 1000 } });
    const device = await register(walkApp);
    await firebase.db.doc(`users/${device.caregiver.uid}`).update({ pushTokens: ['ExponentPushToken[cg]'] });
    const events = async (type: string) =>
      (await request(walkApp).get(`/api/v1/elders/${device.elderId}/events?types=${type}`).set(bearer(device.caregiver.token))).body.items;

    // inside, outside, outside: the second outside reading confirms the exit.
    await report(walkApp, device, HOME);
    await report(walkApp, device, FAR);
    expect(await events('geofenceExit')).toHaveLength(0);
    await report(walkApp, device, FAR);
    const exits = await events('geofenceExit');
    expect(exits).toHaveLength(1);
    expect(exits[0].payload).toMatchObject({ ...FAR, resolvedAt: null });
    expect(exits[0].payload.distanceM).toBeGreaterThan(1000);
    expect(push.sent).toHaveLength(1);
    expect(push.sent[0]?.message).toMatchObject({
      channelId: 'alerts',
      priority: 'high',
      data: { type: 'geofenceExit', elderId: device.elderId, eventId: exits[0].id },
    });

    // still outside: nothing new.
    await report(walkApp, device, FAR);
    expect(await events('geofenceExit')).toHaveLength(1);
    expect(push.sent).toHaveLength(1);

    // inside, inside: the second confirms the return.
    await report(walkApp, device, HOME);
    expect(await events('geofenceReturn')).toHaveLength(0);
    await report(walkApp, device, HOME);
    const returns = await events('geofenceReturn');
    expect(returns).toHaveLength(1);
    expect(push.sent).toHaveLength(2);
    expect(push.sent[1]?.message.data).toMatchObject({ type: 'geofenceReturn', eventId: returns[0].id });

    const elder = await repos.elders.get(device.elderId);
    expect(elder?.locationState).toMatchObject({ status: 'inside', consecutiveInside: 2, consecutiveOutside: 0 });
  });

  it('keeps the position but raises no event when the elder has no safe zone', async () => {
    const device = await register();
    await repos.elders.update(device.elderId, { safeZone: null });
    await report(app, device, FAR);
    await report(app, device, FAR);
    const elder = await repos.elders.get(device.elderId);
    expect(elder?.locationState).toMatchObject({ status: 'unknown', lastLat: FAR.lat, lastLng: FAR.lng });
    const events = await repos.events.query(device.elderId, { limit: 10, types: ['geofenceExit'] });
    expect(events?.items).toEqual([]);
  });
});

describe('GET /elders/:elderId/location', () => {
  it('returns state, position, safe zone and the last tracker contact', async () => {
    const device = await register();
    await report(app, device, HOME);
    const response = await request(app).get(`/api/v1/elders/${device.elderId}/location`).set(bearer(device.caregiver.token));
    expect(response.status).toBe(200);
    expect(LocationResponseSchema.parse(response.body)).toMatchObject({
      status: 'unknown',
      lat: HOME.lat,
      lng: HOME.lng,
      safeZone: ZONE,
      deviceLastSeenAt: clock().toISOString(),
    });
  });

  it('is caregiver-only', async () => {
    const { elderId, elderToken: token, other } = await createScenario();
    const path = `/api/v1/elders/${elderId}/location`;
    expectApiError(await request(app).get(path).set(bearer(token)), 403, 'FORBIDDEN');
    expectApiError(await request(app).get(path).set(bearer(other.token)), 403, 'FORBIDDEN');
  });
});

describe('POST /elders/:elderId/geofence/resolve', () => {
  async function withExit() {
    const device = await register();
    for (const point of [FAR, FAR]) await report(app, device, point);
    return device;
  }
  const resolve = (elderId: string, token: string, body: object = {}) =>
    request(app).post(`/api/v1/elders/${elderId}/geofence/resolve`).set(bearer(token)).send(body);

  it('annotates the latest open exit without touching the device state', async () => {
    const device = await withExit();
    const response = await resolve(device.elderId, device.caregiver.token, { note: 'Falei com ela, está na vizinha.' });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      type: 'geofenceExit',
      payload: { resolvedAt: clock().toISOString(), resolvedNote: 'Falei com ela, está na vizinha.' },
    });
    expect((await repos.elders.get(device.elderId))?.locationState.status).toBe('outside');

    expectApiError(await resolve(device.elderId, device.caregiver.token), 404, 'NOT_FOUND');
    expectApiError(await resolve(device.elderId, device.caregiver.token, { eventId: response.body.id }), 409, 'CONFLICT');
  });

  it('can target an exit by id, and only an exit of this elder', async () => {
    const device = await withExit();
    const exit = (await repos.events.query(device.elderId, { limit: 1, types: ['geofenceExit'] }))!.items[0]!;
    const { caregiver, elderId } = await createScenario();
    expectApiError(await resolve(elderId, caregiver.token, { eventId: exit.id }), 404, 'NOT_FOUND');
    expect((await resolve(device.elderId, device.caregiver.token, { eventId: exit.id })).status).toBe(200);
  });

  it('is caregiver-only', async () => {
    const device = await withExit();
    expectApiError(await resolve(device.elderId, device.elderToken), 403, 'FORBIDDEN');
    expectApiError(await resolve(device.elderId, device.other.token), 403, 'FORBIDDEN');
  });
});

describe('tracker offline check', () => {
  it('reports a silent tracker once per silence and again after it came back', async () => {
    const time = fixedClock('2026-03-11T15:00:00.000Z');
    const push = fakePush();
    const { app: stackApp, services } = buildStack({ now: time, push, limits: { deviceLocationPerWindow: 1000 } });
    const device = await register(stackApp);
    await firebase.db.doc(`users/${device.caregiver.uid}`).update({ pushTokens: ['ExponentPushToken[cg]'] });
    const mine = () => push.sent.filter((s) => s.message.data.elderId === device.elderId);
    const offlineEvents = async () =>
      (await repos.events.query(device.elderId, { limit: 10, types: ['deviceOffline'] }))!.items;

    await report(stackApp, device, HOME);
    time.set('2026-03-11T15:10:00.000Z');
    expect(await services.jobs.checkDevicesOffline(time())).toBe(0);

    time.set('2026-03-11T15:20:00.000Z');
    expect(await services.jobs.checkDevicesOffline(time())).toBeGreaterThanOrEqual(1);
    expect(await offlineEvents()).toHaveLength(1);
    expect(mine()).toHaveLength(1);
    expect(mine()[0]?.message.data).toMatchObject({ type: 'deviceOffline' });

    time.set('2026-03-11T15:50:00.000Z');
    await services.jobs.checkDevicesOffline(time());
    expect(await offlineEvents()).toHaveLength(1);
    expect(mine()).toHaveLength(1);

    // It reports in again, then falls silent again: a new event.
    await report(stackApp, device, HOME);
    time.set('2026-03-11T16:10:00.000Z');
    await services.jobs.checkDevicesOffline(time());
    expect(await offlineEvents()).toHaveLength(2);
    expect(mine()).toHaveLength(2);
  });

  it('counts a tracker that never reported from its registration time', async () => {
    const time = fixedClock('2026-03-11T15:00:00.000Z');
    const { app: stackApp, services } = buildStack({ now: time, push: fakePush() });
    const device = await register(stackApp);
    time.set('2026-03-11T15:16:00.000Z');
    await services.jobs.checkDevicesOffline(time());
    const [event] = (await repos.events.query(device.elderId, { limit: 10, types: ['deviceOffline'] }))!.items;
    expect(event?.payload).toMatchObject({ deviceId: device.deviceId, lastSeenAt: null });
  });
});

describe('POST /internal/jobs/run', () => {
  const path = '/api/v1/internal/jobs/run';
  it('needs the jobs token', async () => {
    expectApiError(await request(app).post(path), 401, 'UNAUTHENTICATED');
    expectApiError(await request(app).post(path).set('X-Jobs-Token', 'nope'), 401, 'UNAUTHENTICATED');
  });

  it('runs the jobs and summarises them', async () => {
    const response = await request(app).post(path).set('X-Jobs-Token', 'test-jobs-token-0123456789');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ missedTasks: expect.any(Number), devicesOffline: expect.any(Number) });
  });

  it('is not mounted without a token configured', async () => {
    const { createApp } = await import('../src/app');
    const { config, firebase: fb } = await import('./helpers');
    const { createLogger } = await import('../src/logger');
    const bare = createApp({ config: { ...config, JOBS_TOKEN: undefined }, firebase: fb, logger: createLogger(config) });
    expectApiError(await request(bare).post(path).set('X-Jobs-Token', 'test-jobs-token-0123456789'), 404, 'NOT_FOUND');
  });
});

