import { describe, expect, it } from 'vitest';

import { ApiError } from '@/lib/api/client';
import { friendlyError } from '@/lib/errors';

describe('friendlyError', () => {
  it('shows the API message for errors the user can act on', () => {
    expect(friendlyError(new ApiError('NOT_FOUND', 'Código inválido ou expirado.', 404))).toBe('Código inválido ou expirado.');
    expect(friendlyError(new ApiError('CONFLICT', 'Já existe uma conta com este e-mail.', 409))).toBe('Já existe uma conta com este e-mail.');
  });

  it('uses its own wording for connectivity, server and rate-limit problems', () => {
    expect(friendlyError(new ApiError('NETWORK', 'Failed to fetch'))).toMatch(/conexão/);
    expect(friendlyError(new ApiError('TIMEOUT', 'timeout'))).toMatch(/demorou/);
    expect(friendlyError(new ApiError('INTERNAL', 'stack trace here', 500))).not.toMatch(/stack/);
    expect(friendlyError(new ApiError('SERVICE_UNAVAILABLE', 'x', 503))).toMatch(/indisponível/);
    expect(friendlyError(new ApiError('RATE_LIMITED', 'Too many', 429))).toMatch(/Muitas tentativas/);
  });

  it('translates Firebase Auth errors', () => {
    expect(friendlyError({ code: 'auth/invalid-credential' })).toBe('E-mail ou senha incorretos.');
    expect(friendlyError({ code: 'auth/network-request-failed' })).toMatch(/conexão/);
    expect(friendlyError({ code: 'auth/something-new' })).toMatch(/Não foi possível entrar/);
  });

  it('never leaks the text of an unknown error', () => {
    expect(friendlyError(new Error('permission-denied on elders/abc'))).not.toMatch(/elders/);
    expect(friendlyError('boom')).toMatch(/Tente novamente/);
  });
});
