import { describe, expect, it } from 'vitest';

import type { LlmProvider, LlmRequest } from '../src/modules/assistant/provider';
import { buildServices, createCaregiver, createElderDoc, fakePush, fixedClock, repos } from './helpers';

// Wednesday 2026-09-16 in São Paulo: 19:00 and 20:30 local. Far from the other files' clocks.
const BEFORE = new Date('2026-09-16T22:00:00.000Z');
const EVENING = new Date('2026-09-16T23:30:00.000Z');
const clock = fixedClock(EVENING.toISOString());

const calls: LlmRequest[] = [];
/** Elder names whose next summary fails once. */
const failOnceFor = new Set<string>();
const llm: LlmProvider = {
  async generate(request) {
    calls.push(request);
    const failing = [...failOnceFor].find((name) => request.system.includes(name));
    if (failing) {
      failOnceFor.delete(failing);
      throw new Error('model unavailable');
    }
    return '  Dona Maria tomou o remédio e caminhou à tarde.  ';
  },
};
const push = fakePush();
const services = buildServices(clock, { push, llm });

let n = 0;
async function elderWith({ routine = true, insights = true }: { routine?: boolean; insights?: boolean } = {}) {
  const token = `ExponentPushToken[summary${n++}]`;
  const caregiver = await createCaregiver({ pushTokens: [token], settings: { notifyAssistantInsights: insights } });
  const name = `Idosa ${n} ${Math.random().toString(36).slice(2, 7)}`;
  const elderId = await createElderDoc([caregiver.uid], { name });
  if (routine) {
    await repos.routines.create(
      elderId,
      { type: 'medication', name: 'Remédio', description: '', time: '08:00', weekdays: [3], medication: { dosage: '1', form: 'comprimido' }, remindElder: true, alertIfMissed: true, active: true },
      new Date('2026-09-01T00:00:00Z'),
    );
  }
  return { elderId, name, token };
}

const callsFor = (name: string) => calls.filter((call) => call.system.includes(name));
const summariesOf = async (elderId: string) => (await repos.events.query(elderId, { limit: 10, types: ['dailySummary'] }))!.items;

describe('daily summary job', () => {
  it('writes one summary per elder per day, from 20:00, and pushes it', async () => {
    const home = await elderWith();

    await services.dailySummary.run(BEFORE);
    expect(callsFor(home.name)).toHaveLength(0);

    await services.dailySummary.run(EVENING);
    await services.dailySummary.run(new Date(EVENING.getTime() + 5 * 60_000));
    expect(callsFor(home.name)).toHaveLength(1);

    const [summary] = await summariesOf(home.elderId);
    expect(summary).toMatchObject({ type: 'dailySummary', date: '2026-09-16', payload: { text: 'Dona Maria tomou o remédio e caminhou à tarde.' } });
    const pushed = push.sent.find((p) => p.tokens.includes(home.token));
    expect(pushed?.message).toMatchObject({
      title: `O dia de ${home.name}`,
      body: 'Dona Maria tomou o remédio e caminhou à tarde.',
      data: { type: 'dailySummary', elderId: home.elderId, eventId: summary?.id },
    });
  });

  it('skips days with nothing to tell and caregivers who turned insights off', async () => {
    const quiet = await elderWith({ routine: false });
    const off = await elderWith({ insights: false });
    await services.dailySummary.run(EVENING);
    expect(callsFor(off.name)).toHaveLength(0);
    expect(await summariesOf(quiet.elderId)).toHaveLength(0);
    expect(await summariesOf(off.elderId)).toHaveLength(0);
  });

  it('tries again on the next run when the model fails', async () => {
    const home = await elderWith();
    failOnceFor.add(home.name);
    await services.dailySummary.run(EVENING);
    expect(callsFor(home.name)).toHaveLength(1);
    expect(await summariesOf(home.elderId)).toHaveLength(0);

    await services.dailySummary.run(EVENING);
    expect(await summariesOf(home.elderId)).toHaveLength(1);
  });
});
