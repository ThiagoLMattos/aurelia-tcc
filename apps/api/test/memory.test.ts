import { ASSISTANT_CONVERSATION_IDLE_MIN, ELDER_ABOUT_MAX_CHARS } from '@aurelia/shared';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import type { LlmProvider, LlmRequest } from '../src/modules/assistant/provider';
import { bearer, buildStack, createScenario, expectApiError, fakePush, fixedClock, repos } from './helpers';

// Wednesday 2026-05-20, noon in São Paulo. Far from the other files' clocks.
const START = '2026-05-20T15:00:00.000Z';
const clock = fixedClock(START);
const minutesAfter = (minutes: number) => new Date(Date.parse(START) + minutes * 60_000);

const calls: LlmRequest[] = [];
/** What the memory request answers next; `fail` makes it throw. */
let memoryAnswer: string | 'fail' = 'Contou que a neta Júlia vem no domingo e que sente falta do marido.';
const isMemoryRequest = (call: LlmRequest) => call.system.includes('a lembrar das conversas');
const llm: LlmProvider = {
  async generate(call) {
    calls.push(call);
    if (!isMemoryRequest(call)) return 'Que bom conversar com você!';
    if (memoryAnswer === 'fail') throw new Error('model unavailable');
    return memoryAnswer;
  },
};
const { app, services } = buildStack({ now: clock, push: fakePush(), llm, limits: { assistantPerHour: 1000 } });

const say = (elderId: string, token: string, message: string) =>
  request(app).post(`/api/v1/elders/${elderId}/assistant/messages`).set(bearer(token)).send({ message });
const conversationsOf = (elderId: string) => repos.memories.finishedConversations(elderId, minutesAfter(10_000));
const memoriesOf = (elderId: string) => repos.memories.listMemories(elderId, 50);

describe('Aurélia’s memory of the elder’s conversations', () => {
  it('keeps the elder’s conversation (not the caregiver’s) and starts a new one after a pause', async () => {
    const { elderId, elderToken, caregiver } = await createScenario();
    clock.set(START);
    expect((await say(elderId, elderToken, 'Minha neta vem domingo')).status).toBe(200);
    clock.set(minutesAfter(3));
    await say(elderId, elderToken, 'Ela se chama Júlia');
    await say(elderId, caregiver.token, 'Como ela está?');

    let conversations = await conversationsOf(elderId);
    expect(conversations).toHaveLength(1);
    expect(conversations[0]?.turns.map((turn) => turn.content)).toEqual([
      'Minha neta vem domingo',
      'Que bom conversar com você!',
      'Ela se chama Júlia',
      'Que bom conversar com você!',
    ]);

    clock.set(minutesAfter(3 + ASSISTANT_CONVERSATION_IDLE_MIN + 1));
    await say(elderId, elderToken, 'Bom dia');
    conversations = await conversationsOf(elderId);
    expect(conversations).toHaveLength(2);
    clock.set(START);
  });

  it('turns a finished conversation into a memory, deletes it, and leaves a live one alone', async () => {
    const { elderId, elderToken } = await createScenario();
    clock.set(START);
    await say(elderId, elderToken, 'Minha neta Júlia vem domingo');
    memoryAnswer = 'Contou que a neta Júlia vem no domingo e que sente falta do marido.';

    await services.conversationMemory.run(minutesAfter(ASSISTANT_CONVERSATION_IDLE_MIN - 1));
    expect(await memoriesOf(elderId)).toHaveLength(0);

    await services.conversationMemory.run(minutesAfter(ASSISTANT_CONVERSATION_IDLE_MIN + 1));
    const [memory] = await memoriesOf(elderId);
    expect(memory).toMatchObject({ date: '2026-05-20', summary: 'Contou que a neta Júlia vem no domingo e que sente falta do marido.' });
    expect(await conversationsOf(elderId)).toHaveLength(0);
    const request = calls.filter(isMemoryRequest).at(-1);
    expect(request?.messages[0]?.content).toContain('Dona Maria: Minha neta Júlia vem domingo');
    expect(request?.messages[0]?.content).toContain('Aurélia: Que bom conversar com você!');
  });

  it('keeps nothing from a conversation with nothing to remember', async () => {
    const { elderId, elderToken } = await createScenario();
    clock.set(START);
    await say(elderId, elderToken, 'Oi');
    memoryAnswer = 'NADA.';
    await services.conversationMemory.run(minutesAfter(ASSISTANT_CONVERSATION_IDLE_MIN + 1));
    expect(await memoriesOf(elderId)).toHaveLength(0);
    expect(await conversationsOf(elderId)).toHaveLength(0);
  });

  it('retries a failed summary, and drops the conversation after five failures', async () => {
    const { elderId, elderToken } = await createScenario();
    clock.set(START);
    await say(elderId, elderToken, 'Hoje fiz bolo de fubá');
    memoryAnswer = 'fail';
    const later = minutesAfter(ASSISTANT_CONVERSATION_IDLE_MIN + 1);
    for (let i = 1; i <= 4; i++) {
      await services.conversationMemory.run(later);
      expect((await conversationsOf(elderId))[0]?.attempts).toBe(i);
    }
    await services.conversationMemory.run(later);
    expect(await conversationsOf(elderId)).toHaveLength(0);
    expect(await memoriesOf(elderId)).toHaveLength(0);
  });

  it('gives Aurélia "Sobre" and the memories in the next conversation, for the elder and the caregiver', async () => {
    const { elderId, elderToken, caregiver } = await createScenario();
    clock.set(START);
    const about = 'Foi professora. Gosta de samba e da gata Mimi. Chame de Dona Maria.';
    const patched = await request(app).patch(`/api/v1/elders/${elderId}`).set(bearer(caregiver.token)).send({ about });
    expect(patched.status).toBe(200);
    expect(patched.body.about).toBe(about);

    await say(elderId, elderToken, 'Minha neta Júlia vem domingo');
    memoryAnswer = 'Contou que a neta Júlia vem no domingo.';
    await services.conversationMemory.run(minutesAfter(ASSISTANT_CONVERSATION_IDLE_MIN + 1));

    clock.set(minutesAfter(60));
    await say(elderId, elderToken, 'Oi, Aurélia');
    const elderPrompt = calls.at(-1)!.system;
    expect(elderPrompt).toContain(`Sobre Dona Maria, escrito pela família: ${about}`);
    expect(elderPrompt).toContain('- 20/05: Contou que a neta Júlia vem no domingo.');
    expect(elderPrompt).toContain('Nunca corrija nem discuta');

    await say(elderId, caregiver.token, 'Como ela tem se sentido?');
    expect(calls.at(-1)!.system).toContain('Contou que a neta Júlia vem no domingo.');
    clock.set(START);
  });

  it('keeps only the newest memories', async () => {
    const { elderId } = await createScenario();
    for (const [i, summary] of ['primeira', 'segunda', 'terceira'].entries()) {
      await repos.memories.keepSummary(
        elderId,
        { id: `missing-${i}`, startedAt: minutesAfter(i), lastAt: minutesAfter(i), turns: [], attempts: 0 },
        { date: '2026-05-20', summary },
      );
    }
    expect(await repos.memories.trimMemories(elderId, 2)).toBe(1);
    expect((await memoriesOf(elderId)).map((memory) => memory.summary)).toEqual(['terceira', 'segunda']);
  });

  it('lets the caregivers see and remove memories, and keeps "Sobre" short', async () => {
    const { elderId, elderToken, caregiver, other } = await createScenario();
    clock.set(START);
    await say(elderId, elderToken, 'Fui ao mercado com a Ana');
    memoryAnswer = 'Foi ao mercado com a filha Ana.';
    await services.conversationMemory.run(minutesAfter(ASSISTANT_CONVERSATION_IDLE_MIN + 1));

    const path = `/api/v1/elders/${elderId}/assistant/memories`;
    const list = await request(app).get(path).set(bearer(caregiver.token));
    expect(list.status).toBe(200);
    expect(list.body.items).toEqual([expect.objectContaining({ date: '2026-05-20', summary: 'Foi ao mercado com a filha Ana.' })]);
    expectApiError(await request(app).get(path).set(bearer(elderToken)), 403, 'FORBIDDEN');
    expectApiError(await request(app).get(path).set(bearer(other.token)), 403, 'FORBIDDEN');

    const id = list.body.items[0].id as string;
    expectApiError(await request(app).delete(`${path}/${id}`).set(bearer(elderToken)), 403, 'FORBIDDEN');
    expect((await request(app).delete(`${path}/${id}`).set(bearer(caregiver.token))).status).toBe(204);
    expectApiError(await request(app).delete(`${path}/${id}`).set(bearer(caregiver.token)), 404, 'NOT_FOUND');
    expect(await memoriesOf(elderId)).toHaveLength(0);

    const tooLong = await request(app)
      .patch(`/api/v1/elders/${elderId}`)
      .set(bearer(caregiver.token))
      .send({ about: 'x'.repeat(ELDER_ABOUT_MAX_CHARS + 1) });
    expectApiError(tooLong, 400, 'VALIDATION_ERROR');
  });
});
