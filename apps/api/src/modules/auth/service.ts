import type { SignupBody, SignupResponse } from '@aurelia/shared';
import type { Auth } from 'firebase-admin/auth';
import type { Logger } from 'pino';

import { conflict } from '../../http/errors';
import type { UsersRepo } from '../../repos/users';

interface Deps {
  auth: Auth;
  users: Pick<UsersRepo, 'create'>;
  logger: Logger;
}

const hasCode = (error: unknown, code: string) =>
  typeof error === 'object' && error !== null && (error as { code?: unknown }).code === code;

export function createAuthService({ auth, users, logger }: Deps) {
  return {
    /**
     * Creates the Auth user, sets the caregiver claim and writes users/{uid}. If anything after
     * createUser fails, the Auth user is deleted so no orphan account blocks a retry.
     */
    async signup(body: SignupBody): Promise<SignupResponse> {
      let uid: string;
      try {
        ({ uid } = await auth.createUser({ email: body.email, password: body.password, displayName: body.name }));
      } catch (error) {
        if (hasCode(error, 'auth/email-already-exists')) throw conflict('Este e-mail já está cadastrado.');
        throw error;
      }

      try {
        await auth.setCustomUserClaims(uid, { role: 'caregiver' });
        await users.create({ id: uid, name: body.name, email: body.email });
      } catch (error) {
        await auth.deleteUser(uid).catch((cleanupError: unknown) => {
          logger.error({ err: cleanupError, uid }, 'failed to delete orphan auth user after signup failure');
        });
        throw error;
      }
      return { id: uid };
    },
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
