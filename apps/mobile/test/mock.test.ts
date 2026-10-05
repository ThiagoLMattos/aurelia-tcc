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
