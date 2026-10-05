import request from 'supertest';
import { describe, expect, it } from 'vitest';

import {
  bearer,
  buildStack,
  createCaregiver,
  createElderDoc,
  elderToken,
  fakePush,
  fixedClock,
  repos,
} from './helpers';

const clock = fixedClock('2026-03-11T15:00:00.000Z');
const earlier = new Date('2026-03-01T00:00:00Z');

async function household(
  settings: { notifyMissedTask?: boolean; notifyConfirmations?: boolean }[],
  tokens: string[][] = settings.map((_, i) => [`ExponentPushToken[cg${i}-${Math.random().toString(36).slice(2)}]`]),
) {
  const caregivers = await Promise.all(settings.map((s, i) => createCaregiver({ settings: s, pushTokens: tokens[i] ?? [] })));
  const elderId = await createElderDoc(caregivers.map((c) => c.uid));
  return { caregivers, elderId, tokens, elderToken: await elderToken(elderId) };
}

const routine = (overrides: Record<string, unknown> = {}) =>
  ({
    type: 'medication',
    name: 'Losartana',
    description: '',
    medication: { dosage: '50 mg', form: 'pill' },
    time: '08:00',
    weekdays: [3],
    remindElder: true,
    alertIfMissed: true,
    active: true,
    ...overrides,
  }) as Parameters<typeof repos.routines.create>[1];

describe('SOS push', () => {
  it('alerts every caregiver of that elder once, with the shared push data', async () => {
    const push = fakePush();
    const { app } = buildStack({ now: clock, push });
    const home = await household([{}, {}]);
    await household([{}]); // another family: must not be notified

    const response = await request(app)
      .post(`/api/v1/elders/${home.elderId}/sos`)
      .set(bearer(home.elderToken))
      .send({ lat: -23.5, lng: -46.6 });

    expect(response.status).toBe(201);
    expect(push.sent).toHaveLength(1);
    const [sent] = push.sent;
    expect([...(sent?.tokens ?? [])].sort()).toEqual(home.tokens.flat().sort());
    expect(sent?.message).toMatchObject({
      channelId: 'alerts',
      priority: 'high',
      data: { type: 'sos', elderId: home.elderId, eventId: response.body.eventId },
    });
    expect(sent?.message.title).toContain('Dona Maria');
  });

  it('still succeeds when the push service fails', async () => {
    const push = fakePush();
    push.failWith = new Error('expo is down');
    const { app } = buildStack({ now: clock, push });
    const home = await household([{}]);

    const response = await request(app).post(`/api/v1/elders/${home.elderId}/sos`).set(bearer(home.elderToken)).send({});
    expect(response.status).toBe(201);
  });

  it('forgets tokens that come back as unregistered', async () => {
    const push = fakePush();
    const { app } = buildStack({ now: clock, push });
    const home = await household([{}], [['ExponentPushToken[dead]', 'ExponentPushToken[alive]']]);
    push.invalid.add('ExponentPushToken[dead]');

    await request(app).post(`/api/v1/elders/${home.elderId}/sos`).set(bearer(home.elderToken)).send({});

    const user = await repos.users.get(home.caregivers[0]!.uid);
    expect(user?.pushTokens).toEqual(['ExponentPushToken[alive]']);
  });
});

describe('task push', () => {
  it('tells caregivers who opted in when the elder confirms, and nobody when a caregiver does', async () => {
    const push = fakePush();
    const { app } = buildStack({ now: clock, push });
    const home = await household([{ notifyConfirmations: true }, { notifyConfirmations: false }]);
    const created = await repos.routines.create(home.elderId, routine({ time: '11:00' }), earlier);
    const path = `/api/v1/elders/${home.elderId}/agenda/2026-03-11/${created.id}/done`;

    expect((await request(app).post(path).set(bearer(home.elderToken))).status).toBe(200);
    expect(push.sent).toHaveLength(1);
    expect(push.sent[0]?.tokens).toEqual(home.tokens[0]);
    expect(push.sent[0]?.message.data).toMatchObject({ type: 'taskDone', elderId: home.elderId });

    const other = await repos.routines.create(home.elderId, routine({ name: 'Vitamina', time: '09:00' }), earlier);
    const byCaregiver = await request(app)
      .post(`/api/v1/elders/${home.elderId}/agenda/2026-03-11/${other.id}/done`)
      .set(bearer(home.caregivers[0]!.token));
    expect(byCaregiver.status).toBe(200);
    expect(push.sent).toHaveLength(1);
  });

  it('tells only caregivers with notifyMissedTask on when a task is missed', async () => {
    const push = fakePush();
    const { services } = buildStack({ now: clock, push });
    const home = await household([{ notifyMissedTask: true }, { notifyMissedTask: false }]);
    await repos.routines.create(home.elderId, routine({ time: '08:00' }), earlier);

    await services.missedTasks.run();
    const mine = push.sent.filter((s) => s.message.data.elderId === home.elderId);
    expect(mine).toHaveLength(1);
    expect(mine[0]?.tokens).toEqual(home.tokens[0]);
    expect(mine[0]?.message.data.type).toBe('taskMissed');
    expect(mine[0]?.message.body).toContain('Losartana');

    // A second run finds nothing new, so nothing more is sent.
    await services.missedTasks.run();
    expect(push.sent.filter((s) => s.message.data.elderId === home.elderId)).toHaveLength(1);
  });

  it('does not notify when the missed-task push fails', async () => {
    const push = fakePush();
    push.failWith = new Error('down');
    const { services } = buildStack({ now: clock, push });
    const home = await household([{ notifyMissedTask: true }]);
    await repos.routines.create(home.elderId, routine(), earlier);
    const created = await services.missedTasks.run();
    expect(created.some((m) => m.elder.id === home.elderId)).toBe(true);
  });
});
