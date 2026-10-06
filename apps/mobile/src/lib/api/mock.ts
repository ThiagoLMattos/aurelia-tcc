import {
  computeAgenda,
  computeWeeklyReport,
  addDays,
  CAREGIVER_INVITE_TTL_HOURS,
  DEFAULT_CAREGIVER_SETTINGS,
  ESCALATE_AFTER_MIN,
  ESCALATION_WINDOW_MIN,
  EventSchema,
  GameResultBodySchema,
  haversineMeters,
  INITIAL_LOCATION_STATE,
  instantOf,
  localDateOf,
  PAIRING_CODE_ALPHABET,
  PAIRING_CODE_LENGTH,
  PAIRING_CODE_TTL_MIN,
  weekStartOf,
  type AgendaItem,
  type Caregiver,
  type Contact,
  type Device,
  type Elder,
  type ErrorCode,
  type Event,
  type EventInput,
  type LocalDate,
  type Occurrence,
  type Routine,
} from '@aurelia/shared';

import type { AuthAdapter, AuthIdentity } from '@/lib/auth/adapter';

import { ApiError } from './client';
import type { Api, EventsParams } from './types';

/**
 * In-memory backend for `EXPO_PUBLIC_API_MODE=mock`: the same `Api` and `AuthAdapter` contracts as the
 * real thing, so the app runs with no server at all. Data lives only as long as the JS bundle does.
 * Sign in with the seeded caregiver `demo@aurelia.app` / `demo1234`, or sign up a new one.
 */

export const MOCK_DEMO_EMAIL = 'demo@aurelia.app';
export const MOCK_DEMO_PASSWORD = 'demo1234';
/** Pairs the elder phone with the seeded elder; unlike real codes it never expires or gets used up. */
export const MOCK_DEMO_PAIRING_CODE = 'DEMA23';

const TIMEZONE = 'America/Sao_Paulo';
const MOCK_TOKEN = 'mock-id-token';
const ELDER_TOKEN_PREFIX = 'mock-elder:';

interface MockCaregiver {
  record: Caregiver;
  password: string;
  elderIds: string[];
}

interface MockElder {
  elder: Elder;
  devices: Device[];
  routines: Routine[];
  occurrences: Occurrence[];
  contacts: Contact[];
  events: Event[];
  phonePaired: boolean;
}

function fail(code: ErrorCode, message: string): never {
  throw new ApiError(code, message);
}

let counter = 0;
const nextId = (prefix: string) => `${prefix}-${++counter}`;

function randomCode(): string {
  let code = '';
  for (let i = 0; i < PAIRING_CODE_LENGTH; i++) {
    code += PAIRING_CODE_ALPHABET[Math.floor(Math.random() * PAIRING_CODE_ALPHABET.length)];
  }
  return code;
}

function makeRoutine(partial: Pick<Routine, 'type' | 'name' | 'time'> & Partial<Routine>): Routine {
  const now = new Date().toISOString();
  return {
    id: nextId('routine'),
    description: '',
    weekdays: [0, 1, 2, 3, 4, 5, 6],
    medication: null,
    remindElder: true,
    alertIfMissed: false,
    active: true,
    createdAt: now,
    updatedAt: now,
    ...partial,
  };
}

function makeElder(id: string, input: Pick<Elder, 'name' | 'birthDate' | 'diagnosisStage'> & Partial<Elder>): Elder {
  return {
    id,
    timezone: TIMEZONE,
    missedTaskTimeoutMin: 30,
    safeZone: null,
    locationState: INITIAL_LOCATION_STATE,
    phonePaired: false,
    createdAt: new Date().toISOString(),
    ...input,
  };
}

/**
 * What the real system gets from the tracker and the scheduler. The mock has neither, so a demo
 * triggers the same state changes by hand (dev builds in mock mode only, see the Início screen).
 */
export interface MockControls {
  simulateExit(): void;
  simulateReturn(): void;
  simulateMissed(): void;
  simulateSos(): void;
  /** Ages every unanswered alert by ESCALATE_AFTER_MIN, so the next read escalates it without waiting. */
  skipToEscalation(): void;
}

export interface MockBackend {
  api: Api;
  auth: AuthAdapter;
  controls: MockControls;
}

export function createMockBackend(): MockBackend {
  const caregivers = new Map<string, MockCaregiver>();
  const elders = new Map<string, MockElder>();
  const codes = new Map<string, { elderId: string; expiresAt: number }>();
  const invites = new Map<string, { elderId: string; expiresAt: number }>();
  const listeners = new Set<(identity: AuthIdentity | null) => void>();
  let identity: AuthIdentity | null = null;

  function addElder(elder: Elder): MockElder {
    const entry: MockElder = { elder, devices: [], routines: [], occurrences: [], contacts: [], events: [], phonePaired: false };
    elders.set(elder.id, entry);
    return entry;
  }

  function addCaregiver(name: string, email: string, password: string): MockCaregiver {
    const uid = nextId('caregiver');
    const entry: MockCaregiver = {
      record: { id: uid, name, email, settings: { ...DEFAULT_CAREGIVER_SETTINGS }, createdAt: new Date().toISOString() },
      password,
      elderIds: [],
    };
    caregivers.set(uid, entry);
    return entry;
  }

  // ── Seed: one caregiver with one elder, so a demo login has something to show ──────────────
  const demo = addCaregiver('Cuidador Demo', MOCK_DEMO_EMAIL, MOCK_DEMO_PASSWORD);
  const maria = addElder(
    makeElder('elder-demo', {
      name: 'Maria Gorete',
      birthDate: '1947-03-15',
      diagnosisStage: 'early',
      safeZone: { lat: -22.9068, lng: -43.1729, radiusM: 150 },
    }),
  );
  demo.elderIds.push(maria.elder.id);
  codes.set(MOCK_DEMO_PAIRING_CODE, { elderId: maria.elder.id, expiresAt: Infinity });
  maria.routines.push(
    makeRoutine({
      type: 'medication',
      name: 'Medicação da manhã',
      time: '08:00',
      description: 'Donepezil',
      medication: { dosage: '10mg', form: 'Comprimido' },
      alertIfMissed: true,
    }),
    makeRoutine({ type: 'meal', name: 'Café da manhã', time: '08:30' }),
    makeRoutine({ type: 'activity', name: 'Caminhada leve', time: '10:00', description: '15 minutos no jardim', weekdays: [1, 3, 5] }),
    makeRoutine({ type: 'meal', name: 'Almoço', time: '12:30' }),
    makeRoutine({
      type: 'medication',
      name: 'Medicação da noite',
      time: '20:00',
      medication: { dosage: '5mg', form: 'Comprimido' },
      alertIfMissed: true,
    }),
  );
  maria.contacts.push(
    { id: nextId('contact'), name: 'Ana Gorete', phone: '+5511999990001', relation: 'Filha', isEmergency: true, priority: 1, createdAt: new Date().toISOString() },
    { id: nextId('contact'), name: 'Dr. Paulo', phone: '+5511999990002', relation: 'Médico', isEmergency: false, priority: 2, createdAt: new Date().toISOString() },
  );

  // A few games over the last days, so the history and the report have something to show.
  const seedDay = localDateOf(new Date(), TIMEZONE);
  for (const [daysAgo, time, payload] of [
    [-5, '10:20', { game: 'memory', pairs: 3, moves: 5, durationSec: 95 }],
    [-3, '10:15', { game: 'sequence', longest: 4, durationSec: 85 }],
    [-2, '10:25', { game: 'memory', pairs: 6, moves: 9, durationSec: 210 }],
    [-2, '10:40', { game: 'tictactoe', level: 'easy', outcome: 'win', durationSec: 60 }],
    [-1, '16:00', { game: 'crossword', theme: 'Frutas', words: 5, totalWords: 5, hints: 2, durationSec: 380 }],
    [-1, '10:10', { game: 'sequence', longest: 5, durationSec: 110 }],
  ] as const) {
    appendEvent(maria, { type: 'gamePlayed', payload, at: instantOf(addDays(seedDay, daysAgo), time, TIMEZONE) });
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────────────────────
  function emit() {
    for (const listener of listeners) listener(identity);
  }

  function requireIdentity(): AuthIdentity {
    return identity ?? fail('UNAUTHENTICATED', 'Sessão expirada. Entre novamente.');
  }

  function requireCaregiver(): MockCaregiver {
    const current = requireIdentity();
    const entry = current.role === 'caregiver' ? caregivers.get(current.user.uid) : undefined;
    return entry ?? fail('FORBIDDEN', 'Apenas cuidadores podem fazer isso.');
  }

  /** The elder the signed-in caregiver may access, or the elder phone's own elder. */
  function elderFor(elderId: string, options: { caregiverOnly?: boolean } = {}): MockElder {
    const current = requireIdentity();
    const entry = elders.get(elderId);
    if (!entry) fail('NOT_FOUND', 'Idoso não encontrado.');
    if (current.role === 'caregiver') {
      if (!caregivers.get(current.user.uid)?.elderIds.includes(elderId)) fail('FORBIDDEN', 'Você não tem acesso a este idoso.');
    } else if (current.elderId !== elderId || options.caregiverOnly) {
      fail('FORBIDDEN', 'Você não tem permissão para fazer isso.');
    }
    return entry;
  }

  /** Parsed like the API reads it back, so payload defaults (an alert's `acknowledgedAt`, …) are filled in. */
  function appendEvent(entry: MockElder, event: Omit<EventInput, 'id' | 'at' | 'date'> & { at?: Date }): Event {
    const { at: given, ...rest } = event;
    const at = given ?? new Date();
    const stored = EventSchema.parse({ ...rest, id: nextId('event'), at: at.toISOString(), date: localDateOf(at, entry.elder.timezone) });
    entry.events.push(stored);
    return stored;
  }

  /**
   * What the API's escalation job does, run whenever the timeline is read: an SOS or safe-zone exit
   * nobody answered in ESCALATE_AFTER_MIN is "texted" to the emergency contacts (nothing is sent).
   */
  function escalateDue(entry: MockElder) {
    const now = Date.now();
    const optedIn = [...caregivers.values()].some(
      (c) => c.elderIds.includes(entry.elder.id) && c.record.settings.escalation === 'meThenContacts',
    );
    const emergency = entry.contacts.filter((c) => c.isEmergency);
    if (!optedIn || emergency.length === 0) return;
    const latestExit = entry.events.findLast((e) => e.type === 'geofenceExit');
    entry.events.forEach((event, index) => {
      if (event.type !== 'sos' && event.type !== 'geofenceExit') return;
      const age = now - Date.parse(event.at);
      if (age < ESCALATE_AFTER_MIN * 60_000 || age > ESCALATION_WINDOW_MIN * 60_000) return;
      if (event.payload.acknowledgedAt || event.payload.escalatedAt) return;
      if (event.type === 'geofenceExit') {
        if (event.payload.resolvedAt || event.id !== latestExit?.id || entry.elder.locationState.status !== 'outside') return;
      }
      entry.events[index] = { ...event, payload: { ...event.payload, escalatedAt: new Date().toISOString() } } as Event;
      appendEvent(entry, {
        type: 'contactsAlerted',
        payload: { alertEventId: event.id, alertType: event.type, sent: emergency.map((c) => c.name), failed: [] },
      });
    });
  }

  function agendaFor(entry: MockElder, date: LocalDate): AgendaItem[] {
    return computeAgenda({
      routines: entry.routines,
      occurrences: entry.occurrences,
      date,
      now: new Date(),
      timezone: entry.elder.timezone,
      missedTaskTimeoutMin: entry.elder.missedTaskTimeoutMin,
    });
  }

  const today = (entry: MockElder) => localDateOf(new Date(), entry.elder.timezone);

  // ── Auth ────────────────────────────────────────────────────────────────────────────────────
  const auth: AuthAdapter = {
    subscribe(listener) {
      listeners.add(listener);
      listener(identity);
      return () => {
        listeners.delete(listener);
      };
    },
    async signInWithPassword(email, password) {
      const found = [...caregivers.values()].find((c) => c.record.email.toLowerCase() === email.trim().toLowerCase());
      if (!found || found.password !== password) throw Object.assign(new Error('invalid credential'), { code: 'auth/invalid-credential' });
      identity = { user: { uid: found.record.id, email: found.record.email, name: found.record.name }, role: 'caregiver', elderId: null };
      emit();
    },
    async signInWithCustomToken(token) {
      const elderId = token.startsWith(ELDER_TOKEN_PREFIX) ? token.slice(ELDER_TOKEN_PREFIX.length) : null;
      const entry = elderId ? elders.get(elderId) : undefined;
      if (!entry) throw Object.assign(new Error('invalid token'), { code: 'auth/invalid-custom-token' });
      entry.phonePaired = true;
      entry.elder = { ...entry.elder, phonePaired: true };
      identity = { user: { uid: `elder_${entry.elder.id}`, email: null, name: entry.elder.name }, role: 'elder', elderId: entry.elder.id };
      emit();
    },
    async signOut() {
      identity = null;
      emit();
    },
    async sendPasswordReset(email) {
      if (!/^\S+@\S+\.\S+$/.test(email.trim())) throw Object.assign(new Error('invalid email'), { code: 'auth/invalid-email' });
    },
    async confirmPassword(password) {
      const current = identity?.role === 'caregiver' ? caregivers.get(identity.user.uid) : undefined;
      if (!current || current.password !== password) throw Object.assign(new Error('invalid credential'), { code: 'auth/invalid-credential' });
    },
    async getIdToken() {
      return identity ? MOCK_TOKEN : null;
    },
  };

  // ── API ─────────────────────────────────────────────────────────────────────────────────────
  const api: Api = {
    async signup(body) {
      if ([...caregivers.values()].some((c) => c.record.email.toLowerCase() === body.email.toLowerCase())) {
        fail('CONFLICT', 'Já existe uma conta com este e-mail.');
      }
      return { id: addCaregiver(body.name, body.email, body.password).record.id };
    },
    async pair(body) {
      const found = codes.get(body.code);
      if (!found || found.expiresAt < Date.now()) fail('NOT_FOUND', 'Código inválido ou expirado.');
      if (body.code !== MOCK_DEMO_PAIRING_CODE) codes.delete(body.code);
      const entry = elders.get(found.elderId) ?? fail('NOT_FOUND', 'Código inválido ou expirado.');
      return { customToken: `${ELDER_TOKEN_PREFIX}${entry.elder.id}`, elder: { id: entry.elder.id, name: entry.elder.name } };
    },

    async getMe() {
      const current = requireIdentity();
      if (current.role === 'elder') {
        const entry = elders.get(current.elderId ?? '') ?? fail('NOT_FOUND', 'Idoso não encontrado.');
        return { role: 'elder', elder: entry.elder };
      }
      const caregiver = requireCaregiver();
      return {
        role: 'caregiver',
        caregiver: caregiver.record,
        elders: caregiver.elderIds.map((id) => (elders.get(id) as MockElder).elder),
      };
    },
    async patchMe(body) {
      const caregiver = requireCaregiver();
      caregiver.record = {
        ...caregiver.record,
        ...(body.name === undefined ? {} : { name: body.name }),
        settings: { ...caregiver.record.settings, ...body.settings },
      };
      return api.getMe();
    },
    async deleteAccount() {
      const current = requireCaregiver();
      caregivers.delete(current.record.id);
      for (const elderId of current.elderIds) {
        if (![...caregivers.values()].some((c) => c.elderIds.includes(elderId))) elders.delete(elderId);
      }
    },
    async registerPushToken() {
      requireIdentity();
    },
    async unregisterPushToken() {
      requireIdentity();
    },

    async createElder(body) {
      const caregiver = requireCaregiver();
      const entry = addElder(makeElder(nextId('elder'), body));
      caregiver.elderIds.push(entry.elder.id);
      return entry.elder;
    },
    async getElder(elderId) {
      const { elder, devices } = elderFor(elderId);
      return {
        ...elder,
        devices: devices.map(({ id, label, lastSeenAt, batteryPct }) => ({ id, label, lastSeenAt, batteryPct })),
      };
    },
    async patchElder(elderId, body) {
      const entry = elderFor(elderId, { caregiverOnly: true });
      entry.elder = { ...entry.elder, ...body };
      return entry.elder;
    },
    async issuePairingCode(elderId) {
      elderFor(elderId, { caregiverOnly: true });
      const code = randomCode();
      const expiresAt = Date.now() + PAIRING_CODE_TTL_MIN * 60_000;
      codes.set(code, { elderId, expiresAt });
      return { code, expiresAt: new Date(expiresAt).toISOString() };
    },
    async unpairElderPhone(elderId) {
      const entry = elderFor(elderId, { caregiverOnly: true });
      entry.elder = { ...entry.elder, phonePaired: false };
    },

    async joinElder(body) {
      const caregiver = requireCaregiver();
      const found = invites.get(body.code);
      if (!found || found.expiresAt < Date.now()) fail('NOT_FOUND', 'Convite inválido ou expirado. Peça um novo a quem convidou você.');
      invites.delete(body.code);
      const entry = elders.get(found.elderId) ?? fail('NOT_FOUND', 'Convite inválido ou expirado. Peça um novo a quem convidou você.');
      if (!caregiver.elderIds.includes(found.elderId)) caregiver.elderIds.push(found.elderId);
      return entry.elder;
    },
    async issueCaregiverInvite(elderId, renew = false) {
      elderFor(elderId, { caregiverOnly: true });
      for (const [code, invite] of invites) {
        if (invite.elderId !== elderId) continue;
        if (!renew && invite.expiresAt > Date.now()) return { code, expiresAt: new Date(invite.expiresAt).toISOString() };
        invites.delete(code);
      }
      const code = randomCode();
      const expiresAt = Date.now() + CAREGIVER_INVITE_TTL_HOURS * 3_600_000;
      invites.set(code, { elderId, expiresAt });
      return { code, expiresAt: new Date(expiresAt).toISOString() };
    },
    async listCaregivers(elderId) {
      elderFor(elderId, { caregiverOnly: true });
      return {
        items: [...caregivers.values()]
          .filter((c) => c.elderIds.includes(elderId))
          .map(({ record }) => ({ id: record.id, name: record.name, email: record.email })),
      };
    },
    async removeCaregiver(elderId, caregiverId) {
      const entry = elderFor(elderId, { caregiverOnly: true });
      const following = [...caregivers.values()].filter((c) => c.elderIds.includes(elderId));
      const target = following.find((c) => c.record.id === caregiverId) ?? fail('NOT_FOUND', 'Cuidador não encontrado.');
      if (following.length === 1) {
        fail('CONFLICT', `Não é possível sair: você é o único cuidador de ${entry.elder.name}. Para encerrar, exclua sua conta.`);
      }
      target.elderIds = target.elderIds.filter((id) => id !== elderId);
    },

    async listRoutines(elderId) {
      return { items: elderFor(elderId).routines.filter((r) => r.active) };
    },
    async createRoutine(elderId, body) {
      const entry = elderFor(elderId, { caregiverOnly: true });
      const routine = makeRoutine({ ...body, medication: body.medication ?? null });
      entry.routines.push(routine);
      return routine;
    },
    async patchRoutine(elderId, routineId, body) {
      const entry = elderFor(elderId, { caregiverOnly: true });
      const index = entry.routines.findIndex((r) => r.id === routineId);
      const current = entry.routines[index] ?? fail('NOT_FOUND', 'Rotina não encontrada.');
      const updated: Routine = {
        ...current,
        ...body,
        medication: body.medication ?? (body.type && body.type !== 'medication' ? null : current.medication),
        updatedAt: new Date().toISOString(),
      };
      entry.routines[index] = updated;
      return updated;
    },
    async deleteRoutine(elderId, routineId) {
      const entry = elderFor(elderId, { caregiverOnly: true });
      entry.routines = entry.routines.map((r) => (r.id === routineId ? { ...r, active: false } : r));
    },

    async getAgenda(elderId, date) {
      const entry = elderFor(elderId);
      const day = date ?? today(entry);
      return { date: day, items: agendaFor(entry, day) };
    },
    async markDone(elderId, date, routineId) {
      const entry = elderFor(elderId);
      const item = agendaFor(entry, date).find((i) => i.routineId === routineId) ?? fail('NOT_FOUND', 'Tarefa não encontrada.');
      const doneBy = identity?.role === 'elder' ? 'elder' : 'caregiver';
      const occurrence: Occurrence = {
        routineId,
        date,
        scheduledTime: item.time,
        status: 'done',
        doneAt: new Date().toISOString(),
        doneBy,
        markedMissedAt: null,
      };
      entry.occurrences = [...entry.occurrences.filter((o) => !(o.date === date && o.routineId === routineId)), occurrence];
      appendEvent(entry, {
        type: 'taskDone',
        payload: { routineId, routineName: item.name, date, scheduledTime: item.time, doneBy, undoneAt: null },
      });
      return { ...item, status: 'done', doneAt: occurrence.doneAt, doneBy };
    },
    async undoDone(elderId, date, routineId) {
      const entry = elderFor(elderId, { caregiverOnly: true });
      entry.occurrences = entry.occurrences.filter((o) => !(o.date === date && o.routineId === routineId));
    },

    async listContacts(elderId) {
      return { items: [...elderFor(elderId).contacts].sort((a, b) => a.priority - b.priority) };
    },
    async createContact(elderId, body) {
      const entry = elderFor(elderId);
      const contact: Contact = { id: nextId('contact'), createdAt: new Date().toISOString(), ...body };
      entry.contacts.push(contact);
      return contact;
    },
    async patchContact(elderId, contactId, body) {
      const entry = elderFor(elderId);
      const index = entry.contacts.findIndex((c) => c.id === contactId);
      const updated = { ...(entry.contacts[index] ?? fail('NOT_FOUND', 'Contato não encontrado.')), ...body };
      entry.contacts[index] = updated;
      return updated;
    },
    async deleteContact(elderId, contactId) {
      const entry = elderFor(elderId);
      entry.contacts = entry.contacts.filter((c) => c.id !== contactId);
    },

    async listEvents(elderId, params: EventsParams = {}) {
      const entry = elderFor(elderId, { caregiverOnly: true });
      escalateDue(entry);
      const limit = params.limit ?? 50;
      const filtered = entry.events
        .filter((e) => !params.types || params.types.includes(e.type))
        .filter((e) => !params.from || e.date >= params.from)
        .filter((e) => !params.to || e.date <= params.to)
        .sort((a, b) => b.at.localeCompare(a.at));
      const start = params.cursor ? Number(params.cursor) : 0;
      const items = filtered.slice(start, start + limit);
      return { items, nextCursor: start + limit < filtered.length ? String(start + limit) : null };
    },
    async getWeeklyReport(elderId, weekStart) {
      const entry = elderFor(elderId, { caregiverOnly: true });
      return computeWeeklyReport({
        weekStart: weekStartOf(weekStart ?? today(entry)),
        routines: entry.routines,
        occurrences: entry.occurrences,
        events: entry.events,
        now: new Date(),
        timezone: entry.elder.timezone,
      });
    },
    async sendSos(elderId, body = {}) {
      const entry = elderFor(elderId);
      if (identity?.role !== 'elder') fail('FORBIDDEN', 'Apenas o idoso pode acionar o SOS.');
      const event = appendEvent(entry, { type: 'sos', payload: { lat: body.lat ?? null, lng: body.lng ?? null } });
      return { eventId: event.id };
    },
    async sendGameResult(elderId, body) {
      const entry = elderFor(elderId);
      if (identity?.role !== 'elder') fail('FORBIDDEN', 'Apenas o idoso registra os jogos.');
      const parsed = GameResultBodySchema.safeParse(body);
      if (!parsed.success) fail('VALIDATION_ERROR', 'Dados inválidos.');
      const event = appendEvent(entry, { type: 'gamePlayed', payload: parsed.data });
      return { eventId: event.id };
    },
    async resolveGeofence(elderId, body = {}) {
      const entry = elderFor(elderId, { caregiverOnly: true });
      const index = entry.events.findLastIndex((e) => e.type === 'geofenceExit' && (!body.eventId || e.id === body.eventId));
      const exit = entry.events[index];
      if (!exit || exit.type !== 'geofenceExit') fail('NOT_FOUND', 'Nenhuma saída da zona segura para resolver.');
      if (exit.payload.resolvedAt) fail('CONFLICT', 'Esta saída já foi resolvida.');
      const resolved: Event = { ...exit, payload: { ...exit.payload, resolvedAt: new Date().toISOString(), resolvedNote: body.note ?? null } };
      entry.events[index] = resolved;
      return resolved;
    },
    async acknowledgeAlert(elderId, eventId) {
      const entry = elderFor(elderId, { caregiverOnly: true });
      const index = entry.events.findIndex((e) => e.id === eventId);
      const event = entry.events[index];
      if (!event || (event.type !== 'sos' && event.type !== 'geofenceExit')) fail('NOT_FOUND', 'Alerta não encontrado.');
      if (event.payload.acknowledgedAt) return event;
      const me = identity?.role === 'caregiver' ? caregivers.get(identity.user.uid)?.record.name : undefined;
      const acknowledged = {
        ...event,
        payload: { ...event.payload, acknowledgedAt: new Date().toISOString(), acknowledgedBy: me ?? 'Cuidador' },
      } as Event;
      entry.events[index] = acknowledged;
      return acknowledged;
    },

    async createDevice(elderId, body) {
      const entry = elderFor(elderId, { caregiverOnly: true });
      const device: Device = {
        id: nextId('device'),
        label: body.label,
        createdAt: new Date().toISOString(),
        lastSeenAt: null,
        batteryPct: null,
        firmwareVersion: null,
      };
      entry.devices.push(device);
      appendEvent(entry, { type: 'devicePaired', payload: { deviceId: device.id, label: device.label } });
      return { deviceId: device.id, secret: 'mock-device-secret' };
    },
    async deleteDevice(elderId, deviceId) {
      const entry = elderFor(elderId, { caregiverOnly: true });
      if (!entry.devices.some((d) => d.id === deviceId)) fail('NOT_FOUND', 'Rastreador não encontrado.');
      entry.devices = entry.devices.filter((d) => d.id !== deviceId);
    },
    async getLocation(elderId) {
      const { elder } = elderFor(elderId, { caregiverOnly: true });
      const state = elder.locationState;
      return {
        status: state.status,
        since: state.since,
        lat: state.lastLat,
        lng: state.lastLng,
        at: state.lastAt,
        safeZone: elder.safeZone,
        deviceLastSeenAt: null,
      };
    },

    async sendAssistantMessage(elderId) {
      elderFor(elderId);
      return { reply: 'Estou em modo de demonstração, sem conexão com o servidor. Em breve poderei ajudar de verdade!' };
    },
  };

  // ── Controls (demo only) ────────────────────────────────────────────────────────────────────
  function demoElder(): MockElder {
    const current = requireCaregiver();
    const elderId = current.elderIds[0] ?? fail('NOT_FOUND', 'Cadastre o idoso primeiro.');
    return elders.get(elderId) as MockElder;
  }

  const controls: MockControls = {
    simulateExit() {
      const entry = demoElder();
      const zone = entry.elder.safeZone ?? fail('CONFLICT', 'Defina a zona segura antes de simular uma saída.');
      // About 1.5 radii straight north of the centre: well outside radius + hysteresis.
      const lat = zone.lat + (zone.radiusM * 1.5) / 111_320;
      const now = new Date();
      entry.elder = {
        ...entry.elder,
        locationState: { status: 'outside', since: now.toISOString(), lastLat: lat, lastLng: zone.lng, lastAt: now.toISOString(), consecutiveOutside: 2, consecutiveInside: 0 },
      };
      appendEvent(entry, {
        type: 'geofenceExit',
        payload: { lat, lng: zone.lng, distanceM: haversineMeters({ lat, lng: zone.lng }, zone), resolvedAt: null, resolvedNote: null },
      });
    },
    simulateReturn() {
      const entry = demoElder();
      const zone = entry.elder.safeZone ?? fail('CONFLICT', 'Defina a zona segura antes de simular um retorno.');
      const now = new Date();
      entry.elder = {
        ...entry.elder,
        locationState: { status: 'inside', since: now.toISOString(), lastLat: zone.lat, lastLng: zone.lng, lastAt: now.toISOString(), consecutiveOutside: 0, consecutiveInside: 2 },
      };
      appendEvent(entry, { type: 'geofenceReturn', payload: { lat: zone.lat, lng: zone.lng } });
    },
    simulateSos() {
      const entry = demoElder();
      const zone = entry.elder.safeZone;
      appendEvent(entry, { type: 'sos', payload: { lat: zone?.lat ?? null, lng: zone?.lng ?? null } });
    },
    skipToEscalation() {
      const entry = demoElder();
      const shift = ESCALATE_AFTER_MIN * 60_000;
      entry.events = entry.events.map((event) =>
        (event.type === 'sos' || event.type === 'geofenceExit') && !event.payload.acknowledgedAt && !event.payload.escalatedAt
          ? { ...event, at: new Date(Date.parse(event.at) - shift).toISOString() }
          : event,
      );
    },
    simulateMissed() {
      const entry = demoElder();
      const date = today(entry);
      const target =
        agendaFor(entry, date).find((item) => item.status === 'pending') ??
        agendaFor(entry, date).find((item) => item.status === 'now' || item.status === 'upcoming') ??
        fail('NOT_FOUND', 'Não há tarefas abertas hoje.');
      const now = new Date();
      entry.occurrences.push({
        routineId: target.routineId,
        date,
        scheduledTime: target.time,
        status: 'missed',
        doneAt: null,
        doneBy: null,
        markedMissedAt: now.toISOString(),
      });
      appendEvent(entry, {
        type: 'taskMissed',
        payload: { routineId: target.routineId, routineName: target.name, date, scheduledTime: target.time },
      });
    },
  };

  return { api, auth, controls };
}
