import { ApiErrorBodySchema, type CaregiverSettings, type ErrorCode } from '@aurelia/shared';
import { Timestamp } from 'firebase-admin/firestore';
import type { Express } from 'express';
import type { Writable } from 'node:stream';
import type { Response } from 'supertest';
import { expect } from 'vitest';

import { createApp } from '../src/app';
import { loadConfig } from '../src/config';
import { initFirebase } from '../src/firebase';
import { createLogger } from '../src/logger';
import { createRepos } from '../src/repos';

export const config = loadConfig(process.env);
export const firebase = initFirebase(config);
export const repos = createRepos(firebase.db);

export function buildApp(options: { logStream?: Writable; signupPerHour?: number } = {}): Express {
  const logger = options.logStream
    ? createLogger({ LOG_LEVEL: 'info' }, options.logStream)
    : createLogger(config);
  return createApp({
    config,
    firebase,
    logger,
    ...(options.signupPerHour ? { limits: { signupPerHour: options.signupPerHour } } : {}),
  });
}

let counter = 0;
const unique = (prefix: string) => `${prefix}${Date.now().toString(36)}${(counter++).toString(36)}`;

/** Exchanges a custom token for a real ID token through the Auth emulator REST API. */
export async function tokenFor(uid: string, claims?: Record<string, unknown>): Promise<string> {
  const customToken = await firebase.auth.createCustomToken(uid, claims);
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

export async function createCaregiver(overrides: { name?: string; elderIds?: string[] } = {}) {
  const email = `${unique('cg')}@example.com`;
  const name = overrides.name ?? 'Cuidadora Teste';
  const { uid } = await firebase.auth.createUser({ email, password: 'senha-segura-123', displayName: name });
  await firebase.auth.setCustomUserClaims(uid, { role: 'caregiver' });
  await repos.users.create({ id: uid, name, email });
  if (overrides.elderIds) await firebase.db.collection('users').doc(uid).update({ elderIds: overrides.elderIds });
  return { uid, email, name, token: await tokenFor(uid) };
}

export async function createElderDoc(caregiverIds: string[], overrides: { name?: string } = {}) {
  const id = unique('elder');
  await firebase.db
    .collection('elders')
    .doc(id)
    .set({
      name: overrides.name ?? 'Dona Maria',
      birthDate: '1945-03-10',
      diagnosisStage: 'early',
      timezone: 'America/Sao_Paulo',
      createdAt: Timestamp.now(),
      createdBy: caregiverIds[0] ?? 'unknown',
      missedTaskTimeoutMin: 30,
      caregiverIds,
      safeZone: null,
      pushTokens: [],
    });
  return id;
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
