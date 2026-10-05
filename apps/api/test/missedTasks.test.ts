import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { bearer, buildApp, buildServices, createElderDoc, createScenario, fixedClock, repos } from './helpers';

// Wednesday 2026-03-11, noon in São Paulo.
const clock = fixedClock('2026-03-11T15:00:00.000Z');
const app = buildApp({ now: clock });
const services = buildServices(clock);

const earlier = new Date('2026-03-01T00:00:00Z');
const routineBody = (overrides: Record<string, unknown> = {}) =>
  ({
    type: 'meal',
    name: 'Café',
    description: '',
    time: '08:00',
    weekdays: [3],
    remindElder: true,
    alertIfMissed: true,
    active: true,
    ...overrides,
  }) as Parameters<typeof repos.routines.create>[1];

const missedOn = (elderId: string) => repos.occurrences.between(elderId, '2026-03-01', '2026-03-31');
const taskMissedEvents = async (elderId: string) =>
  (await repos.events.query(elderId, { limit: 100, types: ['taskMissed'] }))!.items;

describe('runMissedTasks', () => {
  it('marks overdue alertIfMissed tasks once and leaves the rest alone', async () => {
    const { elderId } = await createScenario();
    const overdue = await repos.routines.create(elderId, routineBody({ name: 'Remédio', time: '08:00' }), earlier);
    await repos.routines.create(elderId, routineBody({ name: 'Ainda no prazo', time: '11:45' }), earlier);
    await repos.routines.create(elderId, routineBody({ name: 'Sem alerta', alertIfMissed: false }), earlier);
    await repos.routines.create(elderId, routineBody({ name: 'Inativa', active: false }), earlier);
    await repos.routines.create(elderId, routineBody({ name: 'Outro dia', weekdays: [4] }), earlier);
    const confirmed = await repos.routines.create(elderId, routineBody({ name: 'Já feita', time: '07:00' }), earlier);
    await repos.occurrences.createDone(
      elderId,
      { routineId: confirmed.id, date: '2026-03-11', scheduledTime: '07:00', doneAt: new Date('2026-03-11T11:00:00Z'), doneBy: 'caregiver' },
      services.events.record({ timezone: 'America/Sao_Paulo' }, { type: 'taskDone', payload: { routineId: confirmed.id, routineName: 'Já feita', date: '2026-03-11', scheduledTime: '07:00', doneBy: 'caregiver', undoneAt: null } }, clock()),
    );

    const first = (await services.missedTasks.run()).filter((m) => m.elder.id === elderId);
    expect(first).toHaveLength(1);
    expect(first[0]).toMatchObject({
      routineName: 'Remédio',
      occurrence: { routineId: overdue.id, date: '2026-03-11', status: 'missed', markedMissedAt: clock().toISOString() },
    });

    const second = (await services.missedTasks.run()).filter((m) => m.elder.id === elderId);
    expect(second).toEqual([]);

    const occurrences = await missedOn(elderId);
    expect(occurrences.filter((o) => o.status === 'missed').map((o) => o.routineId)).toEqual([overdue.id]);
    const events = await taskMissedEvents(elderId);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ payload: { routineName: 'Remédio', routineId: overdue.id, date: '2026-03-11' } });
  });

  it('is safe when two runs overlap', async () => {
    const { elderId } = await createScenario();
    await repos.routines.create(elderId, routineBody({ name: 'A', time: '07:00' }), earlier);
    await repos.routines.create(elderId, routineBody({ name: 'B', time: '08:00' }), earlier);

    const [a, b] = await Promise.all([services.missedTasks.run(), services.missedTasks.run()]);
    const total = [...a, ...b].filter((m) => m.elder.id === elderId);
    expect(total).toHaveLength(2);
    expect(await taskMissedEvents(elderId)).toHaveLength(2);
    expect((await missedOn(elderId)).filter((o) => o.status === 'missed')).toHaveLength(2);
  });

  it('shows up as missed in the agenda afterwards', async () => {
    const { elderId, caregiver } = await createScenario();
    await repos.routines.create(elderId, routineBody({ name: 'Remédio', time: '08:00' }), earlier);
    await services.missedTasks.run();
    const agenda = await request(app).get(`/api/v1/elders/${elderId}/agenda`).set(bearer(caregiver.token));
    expect(agenda.body.items[0]).toMatchObject({ name: 'Remédio', status: 'missed' });
  });

  it('respects each elder’s own timeout', async () => {
    const strict = await createElderDoc(['c'], { missedTaskTimeoutMin: 15 });
    const lenient = await createElderDoc(['c'], { missedTaskTimeoutMin: 60 });
    // Due at 11:30; at noon that is 30 minutes ago: past 15, not yet past 60.
    for (const id of [strict, lenient]) await repos.routines.create(id, routineBody({ time: '11:30' }), earlier);

    const created = await services.missedTasks.run();
    expect(created.filter((m) => m.elder.id === strict)).toHaveLength(1);
    expect(created.filter((m) => m.elder.id === lenient)).toHaveLength(0);
  });

  it('catches a task due just before midnight on the next run after midnight', async () => {
    const { elderId } = await createScenario();
    await repos.routines.create(elderId, routineBody({ name: 'Boa noite', time: '23:50', weekdays: [2] }), earlier);
    // Wednesday 00:30 in São Paulo; the task was due Tuesday 23:50 (+30 = 00:20).
    const late = buildServices(fixedClock('2026-03-11T03:30:00.000Z'));
    const created = (await late.missedTasks.run()).filter((m) => m.elder.id === elderId);
    expect(created).toHaveLength(1);
    expect(created[0]?.occurrence).toMatchObject({ date: '2026-03-10', status: 'missed' });
  });

  it('does not flag a routine that was created after its time', async () => {
    const { elderId } = await createScenario();
    // Created "now" (noon) for 08:00 today: it was never due while it existed.
    await repos.routines.create(elderId, routineBody({ time: '08:00' }), clock());
    expect((await services.missedTasks.run()).filter((m) => m.elder.id === elderId)).toEqual([]);
  });
});
