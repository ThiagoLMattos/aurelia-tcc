import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { bearer, buildApp, createScenario, expectApiError, fixedClock, repos } from './helpers';

const app = buildApp({ now: fixedClock() });

type Actor = 'caregiver' | 'other' | 'elder' | 'otherElder' | 'anonymous';

interface Row {
  route: string;
  method: 'get' | 'post' | 'patch' | 'delete';
  path: (elderId: string, routineId: string) => string;
  body?: object;
  /** Roles of the elder's own account that may call it; the owning caregiver is `caregiver`. */
  allowed: ReadonlyArray<'caregiver' | 'elder'>;
}

const both = ['caregiver', 'elder'] as const;
const caregiverOnly = ['caregiver'] as const;
const elderOnly = ['elder'] as const;

// One row per route of spec §5 under /elders/:elderId. DELETE …/session is covered in pairing.test.ts
// because a successful call signs the elder out of every later row.
const rows: Row[] = [
  { route: 'GET /elders/:id', method: 'get', path: (e) => `/elders/${e}`, allowed: both },
  { route: 'PATCH /elders/:id', method: 'patch', path: (e) => `/elders/${e}`, body: { name: 'Novo' }, allowed: caregiverOnly },
  { route: 'POST pairing-codes', method: 'post', path: (e) => `/elders/${e}/pairing-codes`, allowed: caregiverOnly },
  { route: 'GET routines', method: 'get', path: (e) => `/elders/${e}/routines`, allowed: both },
  {
    route: 'POST routines',
    method: 'post',
    path: (e) => `/elders/${e}/routines`,
    body: { type: 'meal', name: 'Almoço', time: '12:00', weekdays: [1] },
    allowed: caregiverOnly,
  },
  { route: 'PATCH routines/:id', method: 'patch', path: (e, r) => `/elders/${e}/routines/${r}`, body: { name: 'x' }, allowed: caregiverOnly },
  { route: 'DELETE routines/:id', method: 'delete', path: (e, r) => `/elders/${e}/routines/${r}`, allowed: caregiverOnly },
  { route: 'GET agenda', method: 'get', path: (e) => `/elders/${e}/agenda`, allowed: both },
  { route: 'POST agenda done', method: 'post', path: (e, r) => `/elders/${e}/agenda/2026-03-11/${r}/done`, allowed: both },
  { route: 'DELETE agenda done', method: 'delete', path: (e, r) => `/elders/${e}/agenda/2026-03-11/${r}/done`, allowed: caregiverOnly },
  { route: 'GET contacts', method: 'get', path: (e) => `/elders/${e}/contacts`, allowed: both },
  {
    route: 'POST contacts',
    method: 'post',
    path: (e) => `/elders/${e}/contacts`,
    body: { name: 'Ana', phone: '+5511999999999', relation: 'Filha' },
    allowed: both,
  },
  { route: 'PATCH contacts/:id', method: 'patch', path: (e) => `/elders/${e}/contacts/c1`, body: { name: 'x' }, allowed: both },
  { route: 'DELETE contacts/:id', method: 'delete', path: (e) => `/elders/${e}/contacts/c1`, allowed: both },
  { route: 'GET events', method: 'get', path: (e) => `/elders/${e}/events`, allowed: caregiverOnly },
  { route: 'GET reports/weekly', method: 'get', path: (e) => `/elders/${e}/reports/weekly`, allowed: caregiverOnly },
  { route: 'POST sos', method: 'post', path: (e) => `/elders/${e}/sos`, body: {}, allowed: elderOnly },
];

describe('access matrix for /elders/:elderId/**', () => {
  it.each(rows)('$route', async (row) => {
    const s = await createScenario();
    const routineId = (
      await repos.routines.create(
        s.elderId,
        { type: 'meal', name: 'Almoço', description: '', time: '12:00', weekdays: [0, 1, 2, 3, 4, 5, 6], remindElder: true, alertIfMissed: false, active: true },
        new Date(),
      )
    ).id;

    const tokens: Record<Actor, string | null> = {
      caregiver: s.caregiver.token,
      other: s.other.token,
      elder: s.elderToken,
      otherElder: s.otherElderToken,
      anonymous: null,
    };
    const call = (actor: Actor) => {
      const token = tokens[actor];
      const req = request(app)[row.method](`/api/v1${row.path(s.elderId, routineId)}`);
      if (token) req.set(bearer(token));
      return row.body ? req.send(row.body) : req;
    };

    // Denied for everyone outside the elder's circle, whatever the route.
    expectApiError(await call('anonymous'), 401, 'UNAUTHENTICATED');
    expectApiError(await call('other'), 403, 'FORBIDDEN');
    expectApiError(await call('otherElder'), 403, 'FORBIDDEN');

    // Inside the circle, the role decides.
    for (const actor of ['caregiver', 'elder'] as const) {
      const response = await call(actor);
      if (row.allowed.includes(actor)) {
        expect([401, 403], `${actor} should be allowed`).not.toContain(response.status);
      } else {
        expectApiError(response, 403, 'FORBIDDEN');
      }
    }
  });

  it('answers 404 for a caregiver asking about an elder that does not exist', async () => {
    const { caregiver } = await createScenario();
    expectApiError(await request(app).get('/api/v1/elders/nobody/routines').set(bearer(caregiver.token)), 404, 'NOT_FOUND');
  });
});
