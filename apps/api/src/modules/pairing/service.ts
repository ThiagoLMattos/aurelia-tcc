import {
  PAIRING_CODE_TTL_MIN,
  type PairResponse,
  type PairingCodeResponse,
} from '@aurelia/shared';
import type { Auth } from 'firebase-admin/auth';
import type { Logger } from 'pino';

import type { Clock } from '../../clock';
import { AppError } from '../../http/errors';
import type { ElderDoc } from '../../repos';
import type { EldersRepo } from '../../repos/elders';
import type { PairingCodesRepo } from '../../repos/pairingCodes';
import { generatePairingCode } from './code';

interface Deps {
  auth: Auth;
  elders: EldersRepo;
  codes: PairingCodesRepo;
  now: Clock;
  logger: Logger;
}

/** Deliberately the same for a missing, expired and used code, so a guess learns nothing. */
const invalidCode = () => new AppError('NOT_FOUND', 'Código inválido ou expirado. Peça um novo ao cuidador.');

const MAX_CODE_ATTEMPTS = 5;

export const elderUid = (elderId: string) => `elder_${elderId}`;

const hasCode = (error: unknown, code: string) =>
  typeof error === 'object' && error !== null && (error as { code?: unknown }).code === code;

export function createPairingService({ auth, elders, codes, now, logger }: Deps) {
  return {
    /** A new code replaces the elder's earlier unused ones. */
    async issueCode(elder: ElderDoc, caregiverUid: string): Promise<PairingCodeResponse> {
      const current = now();
      const expiresAt = new Date(current.getTime() + PAIRING_CODE_TTL_MIN * 60_000);
      for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
        const code = generatePairingCode();
        if (await codes.issue(elder.id, code, caregiverUid, current, expiresAt)) {
          return { code, expiresAt: expiresAt.toISOString() };
        }
      }
      throw new Error('could not generate a free pairing code');
    },

    /**
     * Redeems a code and returns a custom token for the elder's account `elder_<elderId>`.
     * Pairing again revokes the previous session, so a lost phone is signed out.
     */
    async pair(code: string): Promise<PairResponse> {
      const current = now();
      const elderId = await codes.redeem(code, current);
      if (!elderId) throw invalidCode();
      const elder = await elders.get(elderId);
      if (!elder) throw invalidCode();

      try {
        const uid = elderUid(elder.id);
        try {
          await auth.getUser(uid);
          await auth.revokeRefreshTokens(uid);
        } catch (error) {
          if (!hasCode(error, 'auth/user-not-found')) throw error;
          await auth.createUser({ uid, displayName: elder.name });
        }
        const claims = { role: 'elder', elderId: elder.id };
        await auth.setCustomUserClaims(uid, claims);
        const customToken = await auth.createCustomToken(uid, claims);
        await elders.markPaired(elder.id, current);
        return { customToken, elder: { id: elder.id, name: elder.name } };
      } catch (error) {
        // The elder never got a token, so give the code back instead of burning it.
        await codes.release(code).catch((releaseError: unknown) => {
          logger.error({ err: releaseError }, 'failed to release pairing code after pairing failure');
        });
        throw error;
      }
    },

    /** Unpairs the elder phone: signs it out and forgets its push tokens. Idempotent. */
    async revokeSession(elder: ElderDoc): Promise<void> {
      try {
        await auth.revokeRefreshTokens(elderUid(elder.id));
      } catch (error) {
        if (!hasCode(error, 'auth/user-not-found')) throw error;
      }
      await elders.clearPhone(elder.id);
    },
  };
}

export type PairingService = ReturnType<typeof createPairingService>;
