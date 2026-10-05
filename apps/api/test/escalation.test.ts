import { ESCALATE_AFTER_MIN, type CaregiverSettings } from '@aurelia/shared';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createTwilioSmsSender } from '../src/sms/sender';
import {
  bearer,
  buildStack,
  createCaregiver,
  createElderDoc,
  elderToken,
  expectApiError,
  fakePush,
  fakeSms,
  firebase,
  fixedClock,
  repos,
} from './helpers';

// Far from the other files' clocks, so their job runs never pick up these alerts.
const START = '2026-07-20T18:00:00.000Z';
const clock = fixedClock(START);
const push = fakePush();
const sms = fakeSms();
const { app, services } = buildStack({ now: clock, push, sms });

const minutesAfter = (minutes: number) => new Date(Date.parse(START) + minutes * 60_000);
let phoneCounter = 0;
const uniquePhone = () => `+55119${String(Date.now() % 1e7).padStart(7, '0')}${phoneCounter++ % 10}`.slice(0, 14);

async function household(settings: Partial<CaregiverSettings>[] = [{ escalation: 'meThenContacts' }]) {
  const caregivers = await Promise.all(
    settings.map((s, i) => createCaregiver({ name: i === 0 ? 'Ana' : 'Bruno', settings: s, pushTokens: [`ExponentPushToken[esc${i}-${Math.random().toString(36).slice(2)}]`] })),
  );
  const elderId = await createElderDoc(caregivers.map((c) => c.uid));
  const emergency = { name: 'Carla', phone: uniquePhone() };
  const regular = { name: 'Dr. Davi', phone: uniquePhone() };
  await repos.contacts.create(elderId, { ...emergency, relation: 'Filha', isEmergency: true, priority: 1 }, clock(), 5);
  await repos.contacts.create(elderId, { ...regular, relation: 'Médico', isEmergency: false, priority: 2 }, clock(), 5);
  const elder = (await repos.elders.get(elderId))!;
  return { caregivers, elderId, elder, emergency, regular };
}

const sosAt = async (elder: Awaited<ReturnType<typeof household>>['elder'], at = clock()) =>
  services.events.append(elder, { type: 'sos', payload: { lat: -23.55, lng: -46.63 } }, at);

const textsTo = (phone: string) => sms.sent.filter((text) => text.to === phone);

describe('POST /elders/:elderId/events/:eventId/acknowledge', () => {
  it('records the first caregiver who answered, and keeps it', async () => {
    const home = await household([{}, {}]);
    const sos = await sosAt(home.elder);
    const path = `/api/v1/elders/${home.elderId}/events/${sos.id}/acknowledge`;

    clock.set(minutesAfter(1));
    const first = await request(app).post(path).set(bearer(home.caregivers[0]!.token));
    expect(first.status).toBe(200);
    expect(first.body.payload).toMatchObject({ acknowledgedAt: minutesAfter(1).toISOString(), acknowledgedBy: 'Ana' });

    clock.set(minutesAfter(2));
    const second = await request(app).post(path).set(bearer(home.caregivers[1]!.token));
    expect(second.status).toBe(200);
    expect(second.body.payload).toMatchObject({ acknowledgedAt: minutesAfter(1).toISOString(), acknowledgedBy: 'Ana' });
    clock.set(START);
  });

  it('is caregiver-only and only for alerts', async () => {
    const home = await household();
    const outsider = await createCaregiver();
    const sos = await sosAt(home.elder);
    const game = await services.events.append(home.elder, { type: 'gamePlayed', payload: { game: 'sequence', longest: 3, durationSec: 60 } });
    const path = (id: string) => `/api/v1/elders/${home.elderId}/events/${id}/acknowledge`;

    expectApiError(await request(app).post(path(sos.id)).set(bearer(await elderToken(home.elderId))), 403, 'FORBIDDEN');
    expectApiError(await request(app).post(path(sos.id)).set(bearer(outsider.token)), 403, 'FORBIDDEN');
    expectApiError(await request(app).post(path(sos.id)), 401, 'UNAUTHENTICATED');
    expectApiError(await request(app).post(path(game.id)).set(bearer(home.caregivers[0]!.token)), 404, 'NOT_FOUND');
    expectApiError(await request(app).post(path('missing')).set(bearer(home.caregivers[0]!.token)), 404, 'NOT_FOUND');
  });
});

describe('escalation to the emergency contacts', () => {
  it('texts the emergency contacts once when nobody answers an SOS in time', async () => {
    const home = await household([{ escalation: 'meOnly' }, { escalation: 'meThenContacts' }]);
    const sos = await sosAt(home.elder);

    await services.escalation.run(minutesAfter(ESCALATE_AFTER_MIN - 1));
    expect(textsTo(home.emergency.phone)).toHaveLength(0);

    await services.escalation.run(minutesAfter(ESCALATE_AFTER_MIN));
    const [text] = textsTo(home.emergency.phone);
    expect(text?.body).toContain('Dona Maria pediu ajuda (SOS) às 15:00');
    expect(text?.body).toContain('https://maps.google.com/?q=-23.55000,-46.63000');
    expect(textsTo(home.regular.phone)).toHaveLength(0);

    const alert = await repos.events.get(home.elderId, sos.id);
    expect(alert?.payload).toMatchObject({ escalatedAt: minutesAfter(ESCALATE_AFTER_MIN).toISOString() });
    const [record] = (await repos.events.query(home.elderId, { limit: 5, types: ['contactsAlerted'] }))!.items;
    expect(record?.payload).toEqual({ alertEventId: sos.id, alertType: 'sos', sent: ['Carla'], failed: [] });
    const pushed = push.sent.filter((p) => p.message.data.elderId === home.elderId && p.message.data.type === 'contactsAlerted');
    expect(pushed).toHaveLength(1);
    expect(pushed[0]?.message.title).toBe('Contatos de emergência avisados');

    await services.escalation.run(minutesAfter(ESCALATE_AFTER_MIN + 1));
    expect(textsTo(home.emergency.phone)).toHaveLength(1);
  });

  it('leaves alerts alone when they were answered, the caregivers chose "me only", or they are too old', async () => {
    const answered = await household();
    const sos = await sosAt(answered.elder);
    await services.alerts.acknowledge(answered.elder, sos.id, answered.caregivers[0]!.uid);

    const meOnly = await household([{ escalation: 'meOnly' }]);
    await sosAt(meOnly.elder);

    const old = await household();
    await sosAt(old.elder, minutesAfter(-120));

    await services.escalation.run(minutesAfter(ESCALATE_AFTER_MIN + 1));
    for (const home of [answered, meOnly, old]) expect(textsTo(home.emergency.phone)).toHaveLength(0);
  });

  it('escalates a safe-zone exit only while she is still outside and nobody resolved it', async () => {
    const exit = (elder: Awaited<ReturnType<typeof household>>['elder']) =>
      services.events.append(elder, {
        type: 'geofenceExit',
        payload: { lat: -23.56, lng: -46.64, distanceM: 420, resolvedAt: null, resolvedNote: null },
      });
    const setStatus = (elderId: string, status: 'inside' | 'outside') =>
      firebase.db.doc(`elders/${elderId}`).update({ 'locationState.status': status, 'locationState.lastLat': -23.57, 'locationState.lastLng': -46.65 });

    const outside = await household();
    await setStatus(outside.elderId, 'outside');
    await exit((await repos.elders.get(outside.elderId))!);

    const back = await household();
    await setStatus(back.elderId, 'inside');
    await exit((await repos.elders.get(back.elderId))!);

    const resolved = await household();
    await setStatus(resolved.elderId, 'outside');
    const resolvedExit = await exit((await repos.elders.get(resolved.elderId))!);
    await repos.events.resolveExit(resolved.elderId, resolvedExit.id, { at: clock(), note: null });

    await services.escalation.run(minutesAfter(ESCALATE_AFTER_MIN));
    const [text] = textsTo(outside.emergency.phone);
    expect(text?.body).toContain('saiu da área segura às 15:00');
    expect(text?.body).toContain('q=-23.57000,-46.65000'); // the latest position, not where she crossed
    expect(textsTo(back.emergency.phone)).toHaveLength(0);
    expect(textsTo(resolved.emergency.phone)).toHaveLength(0);
  });

  it('records the contacts the SMS could not reach and tells the caregivers', async () => {
    const home = await household();
    sms.failFor.add(home.emergency.phone);
    await sosAt(home.elder);

    await services.escalation.run(minutesAfter(ESCALATE_AFTER_MIN));
    const [record] = (await repos.events.query(home.elderId, { limit: 5, types: ['contactsAlerted'] }))!.items;
    expect(record?.payload).toMatchObject({ sent: [], failed: ['Carla'] });
    const pushed = push.sent.find((p) => p.message.data.elderId === home.elderId && p.message.data.type === 'contactsAlerted');
    expect(pushed?.message.title).toBe('Não foi possível avisar os contatos');
  });
});

describe('Twilio sender', () => {
  it('posts the text to the Messages API and throws when Twilio refuses it', async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    let reply = new Response('{}', { status: 201 });
    const fetchStub = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return reply;
    }) as unknown as typeof fetch;
    const sender = createTwilioSmsSender({ accountSid: 'AC123', authToken: 'secret', from: '+15550001111', fetch: fetchStub });

    await sender.send('+5511999990000', 'Olá');
    expect(calls[0]?.url).toBe('https://api.twilio.com/2010-04-01/Accounts/AC123/Messages.json');
    expect((calls[0]?.init.headers as Record<string, string>).authorization).toBe(`Basic ${Buffer.from('AC123:secret').toString('base64')}`);
    expect(Object.fromEntries(calls[0]?.init.body as URLSearchParams)).toEqual({ To: '+5511999990000', Body: 'Olá', From: '+15550001111' });

    reply = new Response(JSON.stringify({ code: 21608, message: 'unverified number' }), { status: 400 });
    await expect(sender.send('+5511999990000', 'Olá')).rejects.toThrow(/21608.*unverified number/);
  });

  it('sends from a Messaging Service when given one', async () => {
    let body: URLSearchParams | undefined;
    const fetchStub = (async (_url: string, init: RequestInit) => {
      body = init.body as URLSearchParams;
      return new Response('{}', { status: 201 });
    }) as unknown as typeof fetch;
    await createTwilioSmsSender({ accountSid: 'AC1', authToken: 't', from: 'MG42', fetch: fetchStub }).send('+5511999990000', 'x');
    expect(body?.get('MessagingServiceSid')).toBe('MG42');
    expect(body?.has('From')).toBe(false);
  });
});
