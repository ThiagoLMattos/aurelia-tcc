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

interface BuildOptions {
  logStream?: Writable;
  signupPerHour?: number;
  pairPer15Min?: number;
  now?: Clock;
}

const loggerFor = (options: BuildOptions) =>
  options.logStream ? createLogger({ LOG_LEVEL: 'info' }, options.logStream) : createLogger(config);

export function buildApp(options: BuildOptions = {}): Express {
  const limits = {
    ...(options.signupPerHour ? { signupPerHour: options.signupPerHour } : {}),
    ...(options.pairPer15Min ? { pairPer15Min: options.pairPer15Min } : {}),
  };
  return createApp({
    config,
    firebase,
    logger: loggerFor(options),
    ...(options.now ? { now: options.now } : {}),
    ...(Object.keys(limits).length > 0 ? { limits } : {}),
  });
}

/** The same service graph the app uses, for seeding data and calling jobs directly. */
export const buildServices = (now?: Clock) => createServices({ firebase, logger: createLogger(config), ...(now ? { now } : {}) });

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

export async function createCaregiver(overrides: { name?: string; elderIds?: string[] } = {}) {
  const email = `${unique('cg')}@example.com`;
  const name = overrides.name ?? 'Cuidadora Teste';
  const { uid } = await firebase.auth.createUser({ email, password: 'senha-segura-123', displayName: name });
  await firebase.auth.setCustomUserClaims(uid, { role: 'caregiver' });
  await repos.users.create({ id: uid, name, email });
  if (overrides.elderIds) await firebase.db.collection('users').doc(uid).update({ elderIds: overrides.elderIds });
  return { uid, email, name, token: await tokenFor(uid) };
}

export async function createElderDoc(
  caregiverIds: string[],
  overrides: { name?: string; timezone?: string; missedTaskTimeoutMin?: 15 | 30 | 60 } = {},
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
      safeZone: null,
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
