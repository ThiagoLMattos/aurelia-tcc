import { HealthResponseSchema } from '@aurelia/shared';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { bearer, buildApp, buildServices, createCaregiver, expectApiError } from './helpers';

const app = buildApp();

describe('GET /api/v1/health', () => {
  it('is public and returns ok', async () => {
    const response = await request(app).get('/api/v1/health');
    expect(response.status).toBe(200);
    expect(HealthResponseSchema.parse(response.body)).toEqual({ status: 'ok' });
  });

  it('sets security headers and hides the framework', async () => {
    const response = await request(app).get('/api/v1/health');
    expect(response.headers['x-powered-by']).toBeUndefined();
    expect(response.headers['x-content-type-options']).toBe('nosniff');
  });
});

describe('unknown routes and malformed input', () => {
  it('answers 404 in the error shape', async () => {
    expectApiError(await request(app).get('/api/v1/nope'), 404, 'NOT_FOUND');
  });

  it('answers 400 for invalid JSON', async () => {
    const response = await request(app).post('/api/v1/auth/signup').set('content-type', 'application/json').send('{oops');
    expectApiError(response, 400, 'VALIDATION_ERROR');
  });

  it('rejects bodies over 100kb', async () => {
    const response = await request(app).post('/api/v1/auth/signup').send({ name: 'x'.repeat(120_000) });
    expectApiError(response, 400, 'VALIDATION_ERROR');
  });
});

describe('unexpected failures', () => {
  it('answers 500 INTERNAL without leaking the cause or a stack trace', async () => {
    const caregiver = await createCaregiver();
    const services = buildServices();
    services.me.getMe = async () => {
      throw new Error('boom at /srv/app/secret-path.ts with password hunter2');
    };
    const response = await request(buildApp({ services })).get('/api/v1/me').set(bearer(caregiver.token));
    expectApiError(response, 500, 'INTERNAL');
    const text = JSON.stringify(response.body);
    for (const leaked of ['boom', 'secret-path', 'hunter2', 'stack', ' at ']) expect(text).not.toContain(leaked);
  });
});
