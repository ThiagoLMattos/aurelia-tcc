import { ApiErrorBodySchema, type CaregiverSettings, type ErrorCode } from '@aurelia/shared';
import { Timestamp } from 'firebase-admin/firestore';
import type { Express } from 'express';
import type { Writable } from 'node:stream';
import type { Response } from 'supertest';
import { expect } from 'vitest';

import { createApp } from '../src/app';
import type { Clock } from '../src/clock';
import { loadConfig } from '../src/config';
import { initFirebase } from '../src/firebase';
import { createLogger } from '../src/logger';
import { createRepos } from '../src/repos';
import type { LlmProvider } from '../src/modules/assistant/provider';
import type { PushMessage, PushSender } from '../src/push/sender';
import type { SmsSender } from '../src/sms/sender';
import { createServices } from '../src/services';

export const config = loadConfig(process.env);
export const firebase = initFirebase(config);
export const repos = createRepos(firebase.db);

/** A clock the test moves by hand. 2026-03-11 is a Wednesday; 15:00Z is noon in São Paulo. */
export interface TestClock extends Clock {
  set(value: string | Date): void;
}

export function fixedClock(iso = '2026-03-11T15:00:00.000Z'): TestClock {
  let current = new Date(iso);
  const clock = (() => new Date(current)) as TestClock;
  clock.set = (value) => {
    current = new Date(value);
  };
  return clock;
}

/** A PushSender that records what it was asked to send; `invalid` tokens are reported back as unregistered. */
export interface FakePush extends PushSender {
  sent: { tokens: string[]; message: PushMessage }[];
  invalid: Set<string>;
  failWith?: Error;
}

export function fakePush(): FakePush {
  const push: FakePush = {
    sent: [],
    invalid: new Set(),
    async send(tokens, message) {
      if (push.failWith) throw push.failWith;
      push.sent.push({ tokens: [...tokens], message });
      return { invalidTokens: tokens.filter((token) => push.invalid.has(token)) };
    },
  };
  return push;
}

/** An SmsSender that records the texts; numbers in `failFor` are refused like a provider error. */
export interface FakeSms extends SmsSender {
  sent: { to: string; body: string }[];
  failFor: Set<string>;
}

export function fakeSms(): FakeSms {
  const sms: FakeSms = {
    sent: [],
    failFor: new Set(),
    async send(to, body) {
      if (sms.failFor.has(to)) throw new Error(`provider refused ${to}`);
      sms.sent.push({ to, body });
    },
  };
  return sms;
}

interface BuildOptions {
  push?: PushSender;
  llm?: LlmProvider;
  assistantTimeoutMs?: number;
  limits?: NonNullable<Parameters<typeof createApp>[0]['limits']>;
  services?: ReturnType<typeof createServices>;
  logStream?: Writable;
  signupPerHour?: number;
  pairPer15Min?: number;
  now?: Clock;
}

const loggerFor = (options: BuildOptions) =>
  options.logStream ? createLogger({ LOG_LEVEL: 'info' }, options.logStream) : createLogger(config);

export function buildApp(options: BuildOptions = {}): Express {
  const limits = {
    ...options.limits,
    ...(options.signupPerHour ? { signupPerHour: options.signupPerHour } : {}),
    ...(options.pairPer15Min ? { pairPer15Min: options.pairPer15Min } : {}),
  };
  return createApp({
    config,
    firebase,
    logger: loggerFor(options),
    ...(options.now ? { now: options.now } : {}),
    ...(options.push ? { push: options.push } : {}),
    ...(options.llm ? { llm: options.llm } : {}),
    ...(options.assistantTimeoutMs ? { assistantTimeoutMs: options.assistantTimeoutMs } : {}),
    ...(options.services ? { services: options.services } : {}),
    ...(Object.keys(limits).length > 0 ? { limits } : {}),
  });
}

/** The same service graph the app uses, for seeding data and calling jobs directly. */
export const buildServices = (now?: Clock, extra: { push?: PushSender; sms?: SmsSender; llm?: LlmProvider } = {}) =>
  createServices({ firebase, logger: createLogger(config), ...(now ? { now } : {}), ...extra });

/** App and services sharing one graph, so a test can drive HTTP and call jobs directly. */
export function buildStack(options: BuildOptions & { now: Clock; push: PushSender; sms?: SmsSender }) {
  const services = buildServices(options.now, {
    push: options.push,
    ...(options.sms ? { sms: options.sms } : {}),
    ...(options.llm ? { llm: options.llm } : {}),
  });
  return { services, app: buildApp({ ...options, services }) };
}

let counter = 0;
const unique = (prefix: string) => `${prefix}${Date.now().toString(36)}${(counter++).toString(36)}`;

/** Exchanges a custom token for a real ID token through the Auth emulator REST API. */
export async function exchangeCustomToken(customToken: string): Promise<string> {
  const response = await fetch(
    `http://${config.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=fake-api-key`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    },
  );
  const body = (await response.json()) as { idToken?: string };
  if (!body.idToken) throw new Error(`Emulator did not return an ID token: ${JSON.stringify(body)}`);
  return body.idToken;
}

export async function tokenFor(uid: string, claims?: Record<string, unknown>): Promise<string> {
  return exchangeCustomToken(await firebase.auth.createCustomToken(uid, claims));
}

export async function createCaregiver(
  overrides: { name?: string; elderIds?: string[]; pushTokens?: string[]; settings?: Partial<CaregiverSettings> } = {},
) {
  const email = `${unique('cg')}@example.com`;
  const name = overrides.name ?? 'Cuidadora Teste';
  const { uid } = await firebase.auth.createUser({ email, password: 'senha-segura-123', displayName: name });
  await firebase.auth.setCustomUserClaims(uid, { role: 'caregiver' });
  await repos.users.create({ id: uid, name, email });
  const extra: Record<string, unknown> = {};
  if (overrides.elderIds) extra.elderIds = overrides.elderIds;
  if (overrides.pushTokens) extra.pushTokens = overrides.pushTokens;
  for (const [key, value] of Object.entries(overrides.settings ?? {})) extra[`settings.${key}`] = value;
  if (Object.keys(extra).length > 0) await firebase.db.collection('users').doc(uid).update(extra);
  return { uid, email, name, token: await tokenFor(uid) };
}

export async function createElderDoc(
  caregiverIds: string[],
  overrides: {
    name?: string;
    timezone?: string;
    missedTaskTimeoutMin?: 15 | 30 | 60;
    safeZone?: { lat: number; lng: number; radiusM: number } | null;
  } = {},
) {
  const id = unique('elder');
  await firebase.db
    .collection('elders')
    .doc(id)
    .set({
      name: overrides.name ?? 'Dona Maria',
      birthDate: '1945-03-10',
      diagnosisStage: 'early',
      timezone: overrides.timezone ?? 'America/Sao_Paulo',
      createdAt: Timestamp.now(),
      createdBy: caregiverIds[0] ?? 'unknown',
      missedTaskTimeoutMin: overrides.missedTaskTimeoutMin ?? 30,
      caregiverIds,
      safeZone: overrides.safeZone ?? null,
      pushTokens: [],
    });
  return id;
}

/** A caregiver with an elder, a second caregiver and elder who must have no access, and tokens for all. */
export async function createScenario() {
  const caregiver = await createCaregiver();
  const elderId = await createElderDoc([caregiver.uid]);
  const other = await createCaregiver({ name: 'Outra Cuidadora' });
  const otherElderId = await createElderDoc([other.uid], { name: 'Seu João' });
  return {
    caregiver,
    other,
    elderId,
    otherElderId,
    elderToken: await elderToken(elderId),
    otherElderToken: await elderToken(otherElderId),
  };
}

export const elderToken = (elderId: string) => tokenFor(`elder_${elderId}`, { role: 'elder', elderId });

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

/** Asserts the response is an error in the shared ApiErrorBody shape with the given status/code. */
export function expectApiError(response: Response, status: number, code: ErrorCode) {
  expect(response.status).toBe(status);
  const parsed = ApiErrorBodySchema.safeParse(response.body);
  expect(parsed.success, JSON.stringify(response.body)).toBe(true);
  expect(response.body.error.code).toBe(code);
}

export const DEFAULT_SETTINGS_PATCH: Partial<CaregiverSettings> = { notifyMissedTask: false, escalation: 'meThenContacts' };
