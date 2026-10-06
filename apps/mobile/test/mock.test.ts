import { localDateOf } from '@aurelia/shared';
import { describe, expect, it } from 'vitest';

import {
  createMockBackend,
  MOCK_DEMO_EMAIL,
  MOCK_DEMO_PAIRING_CODE,
  MOCK_DEMO_PASSWORD,
} from '@/lib/api/mock';
import type { AuthIdentity } from '@/lib/auth/adapter';

function observe(backend: ReturnType<typeof createMockBackend>) {
  const seen: (AuthIdentity | null)[] = [];
  backend.auth.subscribe((identity) => seen.push(identity));
  return seen;
}

describe('mock backend: sessions', () => {
  it('starts signed out and reports sign-in and sign-out to subscribers', async () => {
    const backend = createMockBackend();
    const seen = observe(backend);
    expect(seen).toEqual([null]);

    await backend.auth.signInWithPassword(MOCK_DEMO_EMAIL, MOCK_DEMO_PASSWORD);
    expect(seen.at(-1)).toMatchObject({ role: 'caregiver', elderId: null });
    expect(await backend.auth.getIdToken()).toBeTruthy();

    await backend.auth.signOut();
    expect(seen.at(-1)).toBeNull();
    expect(await backend.auth.getIdToken()).toBeNull();
    await expect(backend.api.getMe()).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
  });

  it('rejects a wrong password with the Firebase error code', async () => {
    const backend = createMockBackend();
    await expect(backend.auth.signInWithPassword(MOCK_DEMO_EMAIL, 'nope')).rejects.toMatchObject({ code: 'auth/invalid-credential' });
  });

  it('signs a new caregiver up, and refuses a repeated e-mail', async () => {
    const { api, auth } = createMockBackend();
    await api.signup({ name: 'Rita', email: 'rita@example.com', password: 'abcdefgh' });
    await expect(api.signup({ name: 'Rita', email: 'RITA@example.com', password: 'abcdefgh' })).rejects.toMatchObject({ code: 'CONFLICT' });

    await auth.signInWithPassword('rita@example.com', 'abcdefgh');
    const me = await api.getMe();
    expect(me).toMatchObject({ role: 'caregiver', caregiver: { name: 'Rita' }, elders: [] });
  });
});

describe('mock backend: password and account', () => {
  it('accepts a reset request for any well-formed e-mail and checks the password again', async () => {
    const backend = createMockBackend();
    await backend.auth.sendPasswordReset('ninguem@exemplo.com');
    await expect(backend.auth.sendPasswordReset('não é e-mail')).rejects.toMatchObject({ code: 'auth/invalid-email' });

    await backend.auth.signInWithPassword(MOCK_DEMO_EMAIL, MOCK_DEMO_PASSWORD);
    await backend.auth.confirmPassword(MOCK_DEMO_PASSWORD);
    await expect(backend.auth.confirmPassword('errada')).rejects.toMatchObject({ code: 'auth/invalid-credential' });
  });

  it('deletes the caregiver and the elder only they follow', async () => {
    const backend = createMockBackend();
    await backend.auth.signInWithPassword(MOCK_DEMO_EMAIL, MOCK_DEMO_PASSWORD);
    await backend.api.deleteAccount();
    await backend.auth.signOut();

    await expect(backend.auth.signInWithPassword(MOCK_DEMO_EMAIL, MOCK_DEMO_PASSWORD)).rejects.toMatchObject({ code: 'auth/invalid-credential' });
    await expect(backend.api.pair({ code: MOCK_DEMO_PAIRING_CODE })).rejects.toBeTruthy();
  });
});

describe('mock backend: caregivers', () => {
  it('lets an invited caregiver join, be listed, and be removed, but never the last one', async () => {
    const { api, auth } = createMockBackend();
    await auth.signInWithPassword(MOCK_DEMO_EMAIL, MOCK_DEMO_PASSWORD);
    const me = await api.getMe();
    const elderId = me.role === 'caregiver' ? (me.elders[0]?.id ?? '') : '';
    const { code } = await api.issueCaregiverInvite(elderId);
    await auth.signOut();

    await api.signup({ name: 'Bruno', email: 'bruno@example.com', password: 'abcdefgh' });
    await auth.signInWithPassword('bruno@example.com', 'abcdefgh');
    await expect(api.joinElder({ code: 'ZZZZZZ' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect((await api.joinElder({ code })).id).toBe(elderId);
    await expect(api.joinElder({ code })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    const { items } = await api.listCaregivers(elderId);
    expect(items.map((c) => c.name)).toEqual(['Cuidador Demo', 'Bruno']);

    const bruno = items[1]?.id ?? '';
    const demo = items[0]?.id ?? '';
    await api.removeCaregiver(elderId, demo);
    await expect(api.removeCaregiver(elderId, bruno)).rejects.toMatchObject({ code: 'CONFLICT' });
    expect((await api.listCaregivers(elderId)).items.map((c) => c.name)).toEqual(['Bruno']);
  });
});

describe('mock backend: Aurélia memory', () => {
  it('shows the demo elder’s memories to the caregiver and forgets one on request', async () => {
    const { api, auth } = createMockBackend();
    await auth.signInWithPassword(MOCK_DEMO_EMAIL, MOCK_DEMO_PASSWORD);
    const me = await api.getMe();
    const elderId = me.role === 'caregiver' ? (me.elders[0]?.id ?? '') : '';
    const { items } = await api.listMemories(elderId);
    expect(items.length).toBeGreaterThan(0);
    await api.forgetMemory(elderId, items[0]?.id ?? '');
    expect((await api.listMemories(elderId)).items).toHaveLength(items.length - 1);
    await expect(api.forgetMemory(elderId, 'missing')).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect((await api.patchElder(elderId, { about: 'Gosta de samba.' })).about).toBe('Gosta de samba.');
  });
});

describe('mock backend: onboarding and pairing', () => {
  it('lets a caregiver with no elder create one and then see it in /me', async () => {
    const { api, auth } = createMockBackend();
    await api.signup({ name: 'Rita', email: 'rita@example.com', password: 'abcdefgh' });
    await auth.signInWithPassword('rita@example.com', 'abcdefgh');

    const elder = await api.createElder({
      name: 'Dona Lia',
      birthDate: '1940-02-01',
      diagnosisStage: 'early',
      timezone: 'America/Sao_Paulo',
      missedTaskTimeoutMin: 30,
      safeZone: null,
    });
    const me = await api.getMe();
    expect(me.role === 'caregiver' && me.elders.map((e) => e.id)).toEqual([elder.id]);
  });

  it('pairs an elder phone with a code, once, and keeps it to its own elder', async () => {
    const { api, auth } = createMockBackend();
    await auth.signInWithPassword(MOCK_DEMO_EMAIL, MOCK_DEMO_PASSWORD);
    const me = await api.getMe();
    const elderId = me.role === 'caregiver' ? (me.elders[0]?.id ?? '') : '';
    const { code } = await api.issuePairingCode(elderId);
    await auth.signOut();

    const paired = await api.pair({ code });
    expect(paired.elder.id).toBe(elderId);
    await expect(api.pair({ code })).rejects.toMatchObject({ code: 'NOT_FOUND' });

    await auth.signInWithCustomToken(paired.customToken);
    expect(await api.getMe()).toMatchObject({ role: 'elder', elder: { id: elderId, phonePaired: true } });
    await expect(api.getElder('another-elder')).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(api.issuePairingCode(elderId)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('keeps the demo pairing code usable and rejects junk tokens', async () => {
    const { api, auth } = createMockBackend();
    await api.pair({ code: MOCK_DEMO_PAIRING_CODE });
    await expect(api.pair({ code: MOCK_DEMO_PAIRING_CODE })).resolves.toBeTruthy();
    await expect(auth.signInWithCustomToken('garbage')).rejects.toMatchObject({ code: 'auth/invalid-custom-token' });
  });
});

describe('mock backend: elder actions', () => {
  async function asElder() {
    const backend = createMockBackend();
    const { customToken, elder } = await backend.api.pair({ code: MOCK_DEMO_PAIRING_CODE });
    await backend.auth.signInWithCustomToken(customToken);
    return { ...backend, elderId: elder.id };
  }

  it('lets the elder confirm a task today and records who did it', async () => {
    const { api, elderId } = await asElder();
    const { date, items } = await api.getAgenda(elderId);
    expect(date).toBe(localDateOf(new Date(), 'America/Sao_Paulo'));
    const first = items[0];
    expect(first).toBeDefined();

    const done = await api.markDone(elderId, date, first?.routineId ?? '');
    expect(done).toMatchObject({ status: 'done', doneBy: 'elder' });
    expect((await api.getAgenda(elderId)).items.find((i) => i.routineId === first?.routineId)?.status).toBe('done');
  });

  it('only lets the elder raise an SOS, and keeps the history for caregivers', async () => {
    const elder = await asElder();
    const { eventId } = await elder.api.sendSos(elder.elderId, { lat: -22.9, lng: -43.1 });
    expect(eventId).toBeTruthy();
    await expect(elder.api.listEvents(elder.elderId)).rejects.toMatchObject({ code: 'FORBIDDEN' });

    await elder.auth.signOut();
    await elder.auth.signInWithPassword(MOCK_DEMO_EMAIL, MOCK_DEMO_PASSWORD);
    const page = await elder.api.listEvents(elder.elderId, { types: ['sos'] });
    expect(page.items.map((e) => e.id)).toEqual([eventId]);
    await expect(elder.api.sendSos(elder.elderId)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

describe('mock backend: trackers and demo controls', () => {
  async function demo() {
    const backend = createMockBackend();
    await backend.auth.signInWithPassword(MOCK_DEMO_EMAIL, MOCK_DEMO_PASSWORD);
    const me = await backend.api.getMe();
    const elderId = me.role === 'caregiver' ? (me.elders[0]?.id ?? '') : '';
    return { ...backend, elderId };
  }

  it('registers and removes a tracker, and logs it as an event', async () => {
    const { api, elderId } = await demo();
    const { deviceId, secret } = await api.createDevice(elderId, { label: 'Chaveiro' });
    expect(secret).toBeTruthy();
    expect((await api.getElder(elderId)).devices).toMatchObject([{ id: deviceId, label: 'Chaveiro' }]);
    expect((await api.listEvents(elderId, { types: ['devicePaired'] })).items).toHaveLength(1);

    await api.deleteDevice(elderId, deviceId);
    expect((await api.getElder(elderId)).devices).toEqual([]);
    await expect(api.deleteDevice(elderId, deviceId)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('simulates an exit that can be resolved once, then a return', async () => {
    const { api, controls, elderId } = await demo();
    controls.simulateExit();
    expect((await api.getLocation(elderId)).status).toBe('outside');

    const resolved = await api.resolveGeofence(elderId, { note: 'ok' });
    expect(resolved).toMatchObject({ type: 'geofenceExit', payload: { resolvedNote: 'ok' } });
    await expect(api.resolveGeofence(elderId)).rejects.toMatchObject({ code: 'CONFLICT' });

    controls.simulateReturn();
    expect((await api.getLocation(elderId)).status).toBe('inside');
  });

  it('texts the emergency contacts about an SOS nobody answered, once the caregiver chose it', async () => {
    const { api, controls, elderId } = await demo();
    const alerted = async () => (await api.listEvents(elderId, { types: ['contactsAlerted'] })).items;
    controls.simulateSos();
    controls.skipToEscalation();
    expect(await alerted()).toHaveLength(0); // still "me only"

    await api.patchMe({ settings: { escalation: 'meThenContacts' } });
    const [first] = await alerted();
    expect(first).toMatchObject({ payload: { alertType: 'sos', sent: ['Ana Gorete'], failed: [] } });
    const [sos] = (await api.listEvents(elderId, { types: ['sos'] })).items;
    expect(sos?.payload).toMatchObject({ escalatedAt: expect.any(String) });
    expect(await alerted()).toHaveLength(1); // once

    controls.simulateSos();
    expect(await alerted()).toHaveLength(1); // a fresh SOS waits ESCALATE_AFTER_MIN
    controls.skipToEscalation();
    expect(await alerted()).toHaveLength(2);
  });

  it('never escalates an SOS a caregiver answered', async () => {
    const { api, controls, elderId } = await demo();
    await api.patchMe({ settings: { escalation: 'meThenContacts' } });
    controls.simulateSos();
    const [sos] = (await api.listEvents(elderId, { types: ['sos'] })).items;
    const answered = await api.acknowledgeAlert(elderId, sos!.id);
    expect(answered.payload).toMatchObject({ acknowledgedBy: 'Cuidador Demo', acknowledgedAt: expect.any(String) });

    controls.skipToEscalation();
    expect((await api.listEvents(elderId, { types: ['contactsAlerted'] })).items).toHaveLength(0);
    await api.createDevice(elderId, { label: 'x' });
    const [paired] = (await api.listEvents(elderId, { types: ['devicePaired'] })).items;
    await expect(api.acknowledgeAlert(elderId, paired!.id)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('simulates a missed task', async () => {
    const { api, controls, elderId } = await demo();
    controls.simulateMissed();
    const agenda = await api.getAgenda(elderId);
    expect(agenda.items.some((item) => item.status === 'missed')).toBe(true);
  });
});
