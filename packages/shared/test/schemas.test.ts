import { describe, expect, it } from 'vitest';

import {
  AgendaItemSchema,
  AssistantMessageBodySchema,
  CreateContactBodySchema,
  CreateElderBodySchema,
  CreateRoutineBodySchema,
  DeviceLocationBodySchema,
  EventsQuerySchema,
  EventSchema,
  LocalDateSchema,
  LocalTimeSchema,
  MeResponseSchema,
  PairBodySchema,
  PatchElderBodySchema,
  PatchRoutineBodySchema,
  PushDataSchema,
  PushTokenBodySchema,
  SignupBodySchema,
} from '../src';

const valid = { type: 'meal', name: 'Almoço', time: '12:00', weekdays: [1, 2, 3] };
const med = { dosage: '10 mg', form: 'comprimido' };

describe('CreateRoutineBody', () => {
  it('accepts a valid meal and applies defaults', () => {
    expect(CreateRoutineBodySchema.parse(valid)).toMatchObject({ description: '', remindElder: true, alertIfMissed: false, active: true });
  });
  it('requires medication iff type is medication', () => {
    expect(CreateRoutineBodySchema.safeParse({ ...valid, type: 'medication' }).success).toBe(false);
    expect(CreateRoutineBodySchema.safeParse({ ...valid, type: 'medication', medication: med }).success).toBe(true);
    expect(CreateRoutineBodySchema.safeParse({ ...valid, medication: med }).success).toBe(false);
  });
  it('rejects extra keys', () => {
    expect(CreateRoutineBodySchema.safeParse({ ...valid, role: 'admin' }).success).toBe(false);
  });
  it('rejects empty or repeated weekdays and out-of-range days', () => {
    expect(CreateRoutineBodySchema.safeParse({ ...valid, weekdays: [] }).success).toBe(false);
    expect(CreateRoutineBodySchema.safeParse({ ...valid, weekdays: [1, 1] }).success).toBe(false);
    expect(CreateRoutineBodySchema.safeParse({ ...valid, weekdays: [7] }).success).toBe(false);
  });
  it('rejects non zero-padded times', () => {
    expect(CreateRoutineBodySchema.safeParse({ ...valid, time: '8:00' }).success).toBe(false);
    expect(CreateRoutineBodySchema.safeParse({ ...valid, time: '24:00' }).success).toBe(false);
    expect(LocalTimeSchema.safeParse('08:00').success).toBe(true);
  });
});

describe('PatchRoutineBody', () => {
  it('needs at least one field and keeps medication consistent', () => {
    expect(PatchRoutineBodySchema.safeParse({}).success).toBe(false);
    expect(PatchRoutineBodySchema.safeParse({ name: 'x' }).success).toBe(true);
    expect(PatchRoutineBodySchema.safeParse({ type: 'medication' }).success).toBe(false);
    expect(PatchRoutineBodySchema.safeParse({ type: 'meal', medication: med }).success).toBe(false);
    expect(PatchRoutineBodySchema.safeParse({ medication: med }).success).toBe(true);
    expect(PatchRoutineBodySchema.safeParse({ active: false, extra: 1 }).success).toBe(false);
  });
});

describe('primitives', () => {
  it('LocalDate rejects impossible dates', () => {
    expect(LocalDateSchema.safeParse('2024-02-29').success).toBe(true);
    expect(LocalDateSchema.safeParse('2023-02-29').success).toBe(false);
    expect(LocalDateSchema.safeParse('2024-1-1').success).toBe(false);
  });
});

describe('elder / auth / me bodies', () => {
  it('CreateElderBody applies defaults and validates timezone', () => {
    const body = CreateElderBodySchema.parse({ name: 'Maria', birthDate: '1940-05-01', diagnosisStage: 'early' });
    expect(body).toMatchObject({ timezone: 'America/Sao_Paulo', missedTaskTimeoutMin: 30, safeZone: null });
    expect(CreateElderBodySchema.safeParse({ name: 'M', birthDate: '1940-05-01', diagnosisStage: 'early', timezone: 'Nope/Zone' }).success).toBe(false);
    expect(CreateElderBodySchema.safeParse({ name: 'M', birthDate: '1940-05-01', diagnosisStage: 'early', missedTaskTimeoutMin: 20 }).success).toBe(false);
  });
  it('PatchElderBody is strict, non-empty and accepts safeZone: null', () => {
    expect(PatchElderBodySchema.safeParse({}).success).toBe(false);
    expect(PatchElderBodySchema.safeParse({ safeZone: null }).success).toBe(true);
    expect(PatchElderBodySchema.safeParse({ safeZone: { lat: 1, lng: 2, radiusM: 10 } }).success).toBe(false);
    expect(PatchElderBodySchema.safeParse({ caregiverIds: ['x'] }).success).toBe(false);
  });
  it('SignupBody / PairBody', () => {
    expect(SignupBodySchema.safeParse({ name: 'A', email: 'a@b.co', password: '12345678' }).success).toBe(true);
    expect(SignupBodySchema.safeParse({ name: 'A', email: 'a@b.co', password: '123' }).success).toBe(false);
    expect(SignupBodySchema.safeParse({ name: 'A', email: 'a@b.co', password: '12345678', role: 'elder' }).success).toBe(false);
    expect(PairBodySchema.safeParse({ code: 'AB2C3D' }).success).toBe(true);
    expect(PairBodySchema.safeParse({ code: '12345' }).success).toBe(false);
  });
  it('PushTokenBody', () => {
    expect(PushTokenBodySchema.safeParse({ token: 'ExponentPushToken[abc]' }).success).toBe(true);
    expect(PushTokenBodySchema.safeParse({ token: 'abc' }).success).toBe(false);
  });
  it('CreateContactBody rejects phones that cannot be E.164', () => {
    expect(CreateContactBodySchema.safeParse({ name: 'Ana', phone: '+5511999999999', relation: 'Filha' }).success).toBe(true);
    expect(CreateContactBodySchema.safeParse({ name: 'Ana', phone: '12345', relation: 'Filha' }).success).toBe(false);
  });
  it('DeviceLocationBody is strict', () => {
    expect(DeviceLocationBodySchema.safeParse({ lat: 1, lng: 2, batteryPct: 80 }).success).toBe(true);
    expect(DeviceLocationBodySchema.safeParse({ lat: 91, lng: 2 }).success).toBe(false);
    expect(DeviceLocationBodySchema.safeParse({ lat: 1, lng: 2, foo: 1 }).success).toBe(false);
  });
  it('AssistantMessageBody defaults history', () => {
    expect(AssistantMessageBodySchema.parse({ message: 'oi' }).history).toEqual([]);
    expect(AssistantMessageBodySchema.safeParse({ message: '  ' }).success).toBe(false);
  });
});

describe('queries and unions', () => {
  it('EventsQuery parses types list and coerces limit', () => {
    const q = EventsQuerySchema.parse({ types: 'sos,geofenceExit', limit: '10', from: '2024-01-01' });
    expect(q).toMatchObject({ types: ['sos', 'geofenceExit'], limit: 10 });
    expect(EventsQuerySchema.parse({}).limit).toBe(50);
    expect(EventsQuerySchema.safeParse({ types: 'nope' }).success).toBe(false);
    expect(EventsQuerySchema.safeParse({ limit: '1000' }).success).toBe(false);
  });
  it('Event is a discriminated union with typed payloads', () => {
    const base = { id: 'e1', at: '2024-01-03T12:00:00.000Z', date: '2024-01-03' };
    expect(EventSchema.safeParse({ ...base, type: 'sos', payload: { lat: null, lng: null } }).success).toBe(true);
    expect(EventSchema.safeParse({ ...base, type: 'sos', payload: { routineId: 'x' } }).success).toBe(false);
    expect(EventSchema.safeParse({ ...base, type: 'bogus', payload: {} }).success).toBe(false);
  });
  it('MeResponse discriminates on role', () => {
    expect(MeResponseSchema.safeParse({ role: 'nobody' }).success).toBe(false);
  });
  it('PushData discriminates on type', () => {
    expect(PushDataSchema.safeParse({ type: 'sos', elderId: 'e' }).success).toBe(true);
    expect(PushDataSchema.safeParse({ type: 'sos' }).success).toBe(false);
  });
  it('AgendaItem round-trips', () => {
    const item = { routineId: 'r', date: '2024-01-03', time: '08:00', type: 'meal', name: 'x', description: '', medication: null, status: 'now', doneAt: null, doneBy: null };
    expect(AgendaItemSchema.parse(item)).toEqual(item);
  });
});

describe('WP3 contract details', () => {
  it('PairingCode: upper-cases and rejects look-alike characters', async () => {
    const { PairBodySchema } = await import('../src');
    expect(PairBodySchema.parse({ code: ' ab2c3d ' }).code).toBe('AB2C3D');
    for (const bad of ['AB2C30', 'AB2C3O', 'AB2C31', 'AB2C3I', 'AB2C3L', 'AB2C3', 'AB2C3DE']) {
      expect(PairBodySchema.safeParse({ code: bad }).success, bad).toBe(false);
    }
  });

  it('Phone input is normalised to E.164', async () => {
    const { CreateContactBodySchema } = await import('../src');
    const parse = (phone: string) =>
      CreateContactBodySchema.safeParse({ name: 'Ana', phone, relation: 'Filha' });
    for (const typed of ['(11) 99999-9999', '11999999999', '5511999999999', '+55 11 99999-9999', '0055 11 99999-9999']) {
      const result = parse(typed);
      expect(result.success, typed).toBe(true);
      if (result.success) expect(result.data.phone).toBe('+5511999999999');
    }
    expect(parse('1234').success).toBe(false);
    expect(parse('abc').success).toBe(false);
  });

  it('Ids that Firestore would refuse are rejected', async () => {
    const { IdSchema } = await import('../src');
    for (const bad of ['', '.', '..', '__reserved__', 'a/b']) expect(IdSchema.safeParse(bad).success, bad).toBe(false);
    expect(IdSchema.safeParse('elder_abc-1').success).toBe(true);
  });

  it('SosBody needs both coordinates or none', async () => {
    const { SosBodySchema } = await import('../src');
    expect(SosBodySchema.safeParse({}).success).toBe(true);
    expect(SosBodySchema.safeParse({ lat: -23.5, lng: -46.6 }).success).toBe(true);
    expect(SosBodySchema.safeParse({ lat: -23.5 }).success).toBe(false);
  });
});

describe('games', () => {
  it('GameResultBody takes the fields of its own game and comes out as the stored payload', async () => {
    const { GameResultBodySchema } = await import('../src');
    expect(GameResultBodySchema.parse({ game: 'memory', pairs: 6, moves: 9, durationSec: 120 })).toEqual({
      game: 'memory',
      pairs: 6,
      moves: 9,
      durationSec: 120,
    });
    expect(GameResultBodySchema.parse({ game: 'sequence', longest: 0, durationSec: 15 })).toEqual({
      game: 'sequence',
      longest: 0,
      durationSec: 15,
    });
    expect(GameResultBodySchema.safeParse({ game: 'memory', pairs: 6, durationSec: 120 }).success).toBe(false);
    expect(GameResultBodySchema.safeParse({ game: 'memory', pairs: 6, moves: 5, durationSec: 120 }).success).toBe(false);
    expect(GameResultBodySchema.safeParse({ game: 'sequence', longest: 3, moves: 4, durationSec: 30 }).success).toBe(false);
    expect(GameResultBodySchema.safeParse({ game: 'sequence', longest: 3, durationSec: 0 }).success).toBe(false);
    expect(GameResultBodySchema.safeParse({ game: 'chess', durationSec: 30 }).success).toBe(false);
  });

  it('memoryAccuracyPct is the share of turns that found a pair', async () => {
    const { memoryAccuracyPct } = await import('../src');
    expect(memoryAccuracyPct({ pairs: 6, moves: 6 })).toBe(100);
    expect(memoryAccuracyPct({ pairs: 6, moves: 9 })).toBe(67);
  });
});
