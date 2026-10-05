import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it } from 'vitest';

import { requireElderAccess } from '../src/auth/requireElderAccess';
import { AppError } from '../src/http/errors';
import type { ElderDoc } from '../src/repos';

const elder = { id: 'e1', caregiverIds: ['cg1'] } as ElderDoc;
const middleware = requireElderAccess({ get: async (id) => (id === 'e1' ? elder : null) });

async function run(auth: Express.AuthContext | undefined, elderId: string) {
  const res = { locals: {} as Record<string, unknown> } as unknown as Response;
  let error: unknown;
  await middleware({ auth, params: { elderId } } as unknown as Request<{ elderId: string }>, res, ((e?: unknown) => {
    error = e;
  }) as NextFunction);
  return { error, locals: res.locals };
}

describe('requireElderAccess', () => {
  it('lets a listed caregiver through and exposes the elder once', async () => {
    const { error, locals } = await run({ uid: 'cg1', role: 'caregiver' }, 'e1');
    expect(error).toBeUndefined();
    expect(locals.elder).toBe(elder);
  });

  it('forbids a caregiver who is not in caregiverIds', async () => {
    const { error } = await run({ uid: 'cg2', role: 'caregiver' }, 'e1');
    expect(error).toMatchObject({ code: 'FORBIDDEN' });
  });

  it('lets an elder token with the matching elderId through', async () => {
    const { error, locals } = await run({ uid: 'elder_e1', role: 'elder', elderId: 'e1' }, 'e1');
    expect(error).toBeUndefined();
    expect(locals.elder).toBe(elder);
  });

  it('forbids an elder token for a different elder', async () => {
    const { error } = await run({ uid: 'elder_e2', role: 'elder', elderId: 'e2' }, 'e1');
    expect(error).toMatchObject({ code: 'FORBIDDEN' });
  });

  it('answers 404 when the elder does not exist', async () => {
    const { error } = await run({ uid: 'cg1', role: 'caregiver' }, 'missing');
    expect(error).toMatchObject({ code: 'NOT_FOUND' });
  });

  it('answers 401 without authentication', async () => {
    const { error } = await run(undefined, 'e1');
    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({ code: 'UNAUTHENTICATED' });
  });
});
