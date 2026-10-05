import type { AssistantReply } from '@aurelia/shared';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { groqCompletionParams, type LlmProvider, type LlmRequest } from '../src/modules/assistant/provider';
import { bearer, buildApp, createScenario, elderToken as elderTokenFor, expectApiError, fixedClock, repos } from './helpers';

// Wednesday 2026-03-11, noon in São Paulo.
const clock = fixedClock('2026-03-11T15:00:00.000Z');
const earlier = new Date('2026-03-01T00:00:00Z');

function spy(reply = 'Tudo bem!') {
  const calls: LlmRequest[] = [];
  const llm: LlmProvider = {
    async generate(request) {
      calls.push(request);
      return reply;
    },
  };
  return { llm, calls };
}

const routine = (name: string, time: string, overrides: Record<string, unknown> = {}) =>
  ({
    type: 'meal',
    name,
    description: '',
    time,
    weekdays: [3],
    remindElder: true,
    alertIfMissed: true,
    active: true,
    ...overrides,
  }) as Parameters<typeof repos.routines.create>[1];

async function seeded() {
  const scenario = await createScenario();
  await repos.routines.create(scenario.elderId, routine('Remédio da manhã', '08:00'), earlier);
  await repos.routines.create(scenario.elderId, routine('Jantar', '19:00'), earlier);
  await request(buildApp({ now: clock }))
    .post(`/api/v1/elders/${scenario.elderId}/contacts`)
    .set(bearer(scenario.caregiver.token))
    .send({ name: 'Filha Ana', phone: '11987654321', relation: 'filha', isEmergency: true });
  return scenario;
}

const ask = (app: ReturnType<typeof buildApp>, elderId: string, token: string, body: object) =>
  request(app).post(`/api/v1/elders/${elderId}/assistant/messages`).set(bearer(token)).send(body);

describe('POST /elders/:elderId/assistant/messages', () => {
  it('answers a caregiver with a prompt grounded in the week, history included', async () => {
    const { llm, calls } = spy('Ela tomou, sim.');
    const app = buildApp({ now: clock, llm });
    const { elderId, caregiver } = await seeded();
    await request(app)
      .post(`/api/v1/elders/${elderId}/sos`)
      .set(bearer(await elderTokenFor(elderId)))
      .send({});

    const history = [
      { role: 'user', content: 'Oi' },
      { role: 'assistant', content: 'Olá!' },
    ];
    const response = await ask(app, elderId, caregiver.token, { message: 'Dona Maria tomou o remédio da manhã?', history });

    expect(response.status).toBe(200);
    expect(response.body as AssistantReply).toEqual({ reply: 'Ela tomou, sim.' });
    const call = calls[0]!;
    expect(call.messages).toEqual([...history, { role: 'user', content: 'Dona Maria tomou o remédio da manhã?' }]);
    expect(call.system).toContain('Remédio da manhã');
    expect(call.system).toContain('Dona Maria');
    expect(call.system).toContain('2026-03-11');
    expect(call.system).toContain('"last7Days"');
    expect(call.system).toContain('"type":"sos"');
  });

  it('gives the elder a warm, simple prompt with today’s agenda and the next item, but no weekly events', async () => {
    const { llm, calls } = spy();
    const app = buildApp({ now: clock, llm });
    const { elderId, elderToken } = await seeded();
    await request(app).post(`/api/v1/elders/${elderId}/sos`).set(bearer(elderToken)).send({});

    expect((await ask(app, elderId, elderToken, { message: 'Que horas é o jantar?' })).status).toBe(200);
    const { system } = calls[0]!;
    expect(system).toContain('Jantar');
    expect(system).toContain('Próximo item: Jantar às 19:00');
    expect(system).toContain('SOS');
    expect(system).not.toContain('last7Days');
    expect(system).not.toContain('"type":"sos"');
  });

  it('never sends contact phone numbers or caregiver emails to the model', async () => {
    const { llm, calls } = spy();
    const app = buildApp({ now: clock, llm });
    const { elderId, elderToken, caregiver } = await seeded();
    await ask(app, elderId, caregiver.token, { message: 'Quem são os contatos?' });
    await ask(app, elderId, elderToken, { message: 'Quem são os contatos?' });
    expect(calls).toHaveLength(2);
    for (const { system } of calls) {
      expect(system).not.toContain('11987654321');
      expect(system).not.toContain('+5511');
      expect(system).not.toContain(caregiver.email);
      expect(system).not.toContain('Filha Ana');
    }
  });

  it('keeps one elder’s assistant away from other elders and from outsiders', async () => {
    const { llm, calls } = spy();
    const app = buildApp({ now: clock, llm });
    const { elderId, otherElderId, elderToken, otherElderToken, other } = await createScenario();
    const path = (id: string) => `/api/v1/elders/${id}/assistant/messages`;
    expectApiError(await request(app).post(path(elderId)).set(bearer(otherElderToken)).send({ message: 'oi' }), 403, 'FORBIDDEN');
    expectApiError(await request(app).post(path(elderId)).set(bearer(other.token)).send({ message: 'oi' }), 403, 'FORBIDDEN');
    expectApiError(await request(app).post(path(otherElderId)).set(bearer(elderToken)).send({ message: 'oi' }), 403, 'FORBIDDEN');
    expectApiError(await request(app).post(path(elderId)).send({ message: 'oi' }), 401, 'UNAUTHENTICATED');
    expect(calls).toHaveLength(0);
  });

  it('validates the message and the history', async () => {
    const app = buildApp({ now: clock, llm: spy().llm });
    const { elderId, caregiver } = await createScenario();
    const bad = (body: object) => ask(app, elderId, caregiver.token, body);
    expectApiError(await bad({}), 400, 'VALIDATION_ERROR');
    expectApiError(await bad({ message: '  ' }), 400, 'VALIDATION_ERROR');
    expectApiError(await bad({ message: 'x'.repeat(2001) }), 400, 'VALIDATION_ERROR');
    expectApiError(
      await bad({ message: 'oi', history: Array.from({ length: 21 }, () => ({ role: 'user', content: 'a' })) }),
      400,
      'VALIDATION_ERROR',
    );
    expectApiError(await bad({ message: 'oi', history: [{ role: 'system', content: 'a' }] }), 400, 'VALIDATION_ERROR');
  });

  it('allows 30 messages an hour per elder and rejects the 31st', async () => {
    const app = buildApp({ now: clock, llm: spy().llm });
    const { elderId, caregiver, elderToken } = await createScenario();
    for (let i = 0; i < 29; i += 1) {
      expect((await ask(app, elderId, caregiver.token, { message: `p${i}` })).status).toBe(200);
    }
    // The elder's phone shares the elder's budget.
    expect((await ask(app, elderId, elderToken, { message: 'trinta' })).status).toBe(200);
    expectApiError(await ask(app, elderId, caregiver.token, { message: 'trinta e um' }), 429, 'RATE_LIMITED');

    // Another elder has their own budget.
    const second = await createScenario();
    expect((await ask(app, second.elderId, second.caregiver.token, { message: 'oi' })).status).toBe(200);
  });

  it('answers 503 in Portuguese when the model fails, times out or returns nothing', async () => {
    const { elderId, caregiver } = await createScenario();
    const failing: LlmProvider = { generate: async () => Promise.reject(new Error('groq: 500 secret-details')) };
    const hanging: LlmProvider = { generate: () => new Promise<string>(() => undefined) };
    const empty: LlmProvider = { generate: async () => '  ' };

    for (const [llm, timeout] of [[failing, undefined], [hanging, 50], [empty, undefined]] as const) {
      const app = buildApp({ now: clock, llm, ...(timeout ? { assistantTimeoutMs: timeout } : {}) });
      const response = await ask(app, elderId, caregiver.token, { message: 'oi' });
      expectApiError(response, 503, 'SERVICE_UNAVAILABLE');
      expect(response.body.error.message).toContain('assistente');
      expect(JSON.stringify(response.body)).not.toContain('secret-details');
    }
  });
});

describe('Groq request', () => {
  const history = [{ role: 'user' as const, content: 'Como foi a semana?' }];

  it('asks a gpt-oss model to think briefly, keeps the thinking out of the reply and leaves room for the answer', () => {
    expect(groqCompletionParams('openai/gpt-oss-120b', 'sistema', history)).toEqual({
      model: 'openai/gpt-oss-120b',
      temperature: 0.4,
      messages: [{ role: 'system', content: 'sistema' }, ...history],
      max_completion_tokens: 2_000,
      reasoning_effort: 'low',
      include_reasoning: false,
    });
  });

  it('sends no reasoning options to other models', () => {
    const params = groqCompletionParams('qwen/qwen3.8-27b', 'sistema', history);
    expect(params).toMatchObject({ max_completion_tokens: 600 });
    expect(params).not.toHaveProperty('reasoning_effort');
    expect(params).not.toHaveProperty('include_reasoning');
  });
});
