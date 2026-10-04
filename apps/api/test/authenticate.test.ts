import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { bearer, buildApp, createCaregiver, expectApiError, firebase, tokenFor } from './helpers';

const app = buildApp();

describe('authentication', () => {
  it('rejects a request without a token (401)', async () => {
    expectApiError(await request(app).get('/api/v1/me'), 401, 'UNAUTHENTICATED');
  });

  it('rejects a malformed Authorization header (401)', async () => {
    const response = await request(app).get('/api/v1/me').set('Authorization', 'Token abc');
    expectApiError(response, 401, 'UNAUTHENTICATED');
  });

  it('rejects a garbage token (401)', async () => {
    expectApiError(await request(app).get('/api/v1/me').set(bearer('not.a.jwt')), 401, 'UNAUTHENTICATED');
  });

  it('rejects a revoked token (401)', async () => {
    const caregiver = await createCaregiver();
    expect((await request(app).get('/api/v1/me').set(bearer(caregiver.token))).status).toBe(200);

    // Token validity is tracked in whole seconds, so revoke strictly after it was issued.
    await new Promise((resolve) => setTimeout(resolve, 1100));
    await firebase.auth.revokeRefreshTokens(caregiver.uid);

    expectApiError(await request(app).get('/api/v1/me').set(bearer(caregiver.token)), 401, 'UNAUTHENTICATED');
  });

  it('rejects a valid token without a role claim (403) instead of defaulting a role', async () => {
    const { uid } = await firebase.auth.createUser({ email: 'norole@example.com', password: 'senha-segura-123' });
    const token = await tokenFor(uid);
    expectApiError(await request(app).get('/api/v1/me').set(bearer(token)), 403, 'FORBIDDEN');
  });

  it('rejects an unknown role (403)', async () => {
    const token = await tokenFor('someone', { role: 'admin' });
    expectApiError(await request(app).get('/api/v1/me').set(bearer(token)), 403, 'FORBIDDEN');
  });

  it('rejects an elder token without elderId (403)', async () => {
    const token = await tokenFor('elder_x', { role: 'elder' });
    expectApiError(await request(app).get('/api/v1/me').set(bearer(token)), 403, 'FORBIDDEN');
  });
});
