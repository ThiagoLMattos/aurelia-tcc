import { SignupResponseSchema } from '@aurelia/shared';
import { DEFAULT_CAREGIVER_SETTINGS } from '@aurelia/shared';
import type { Auth } from 'firebase-admin/auth';
import { pino } from 'pino';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { createAuthService } from '../src/modules/auth/service';
import { buildApp, expectApiError, firebase, repos } from './helpers';

const app = buildApp();
const valid = { name: '  Ana Souza ', email: 'ana@example.com', password: 'senha-segura-123' };

describe('POST /api/v1/auth/signup', () => {
  it('creates the auth user with the caregiver claim and the users document', async () => {
    const response = await request(app).post('/api/v1/auth/signup').send(valid);
    expect(response.status).toBe(201);
    const { id } = SignupResponseSchema.parse(response.body);

    const user = await firebase.auth.getUser(id);
    expect(user.email).toBe('ana@example.com');
    expect(user.customClaims).toEqual({ role: 'caregiver' });

    const doc = await repos.users.get(id);
    expect(doc).toMatchObject({ name: 'Ana Souza', email: 'ana@example.com', pushTokens: [], elderIds: [] });
    expect(doc?.settings).toEqual(DEFAULT_CAREGIVER_SETTINGS);
  });

  it('answers 409 CONFLICT for a duplicate e-mail', async () => {
    const body = { ...valid, email: 'dup@example.com' };
    expect((await request(app).post('/api/v1/auth/signup').send(body)).status).toBe(201);
    expectApiError(await request(app).post('/api/v1/auth/signup').send(body), 409, 'CONFLICT');
  });

  it('rejects unknown keys, so a client can never send a role', async () => {
    const response = await request(app)
      .post('/api/v1/auth/signup')
      .send({ ...valid, email: 'role@example.com', role: 'elder' });
    expectApiError(response, 400, 'VALIDATION_ERROR');
    await expect(firebase.auth.getUserByEmail('role@example.com')).rejects.toMatchObject({ code: 'auth/user-not-found' });
  });

  it.each([
    ['missing name', { email: 'a@example.com', password: 'senha-segura-123' }],
    ['bad e-mail', { ...valid, email: 'not-an-email' }],
    ['short password', { ...valid, email: 'short@example.com', password: '123' }],
  ])('rejects %s', async (_label, body) => {
    expectApiError(await request(app).post('/api/v1/auth/signup').send(body), 400, 'VALIDATION_ERROR');
  });

  it('is rate limited per IP', async () => {
    const limited = buildApp({ signupPerHour: 2 });
    const send = () => request(limited).post('/api/v1/auth/signup').send({ ...valid, email: 'rl@example.com' });
    await send();
    await send();
    expectApiError(await send(), 429, 'RATE_LIMITED');
  });
});

describe('signup rollback', () => {
  it('deletes the auth user when the Firestore write fails', async () => {
    const deleteUser = vi.fn((uid: string) => firebase.auth.deleteUser(uid));
    const auth = {
      createUser: (props: Parameters<Auth['createUser']>[0]) => firebase.auth.createUser(props),
      setCustomUserClaims: (uid: string, claims: object) => firebase.auth.setCustomUserClaims(uid, claims),
      deleteUser,
    } as unknown as Auth;
    const failingUsers = { create: vi.fn().mockRejectedValue(new Error('firestore down')) };
    const service = createAuthService({ auth, users: failingUsers, logger: pino({ level: 'silent' }) });

    await expect(service.signup({ ...valid, email: 'orphan@example.com' })).rejects.toThrow('firestore down');

    expect(deleteUser).toHaveBeenCalledTimes(1);
    await expect(firebase.auth.getUserByEmail('orphan@example.com')).rejects.toMatchObject({
      code: 'auth/user-not-found',
    });
  });
});
