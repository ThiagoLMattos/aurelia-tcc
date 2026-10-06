import {
  CAREGIVER_INVITE_TTL_HOURS,
  type Elder,
  type ElderCaregiversResponse,
  type PairingCodeResponse,
} from '@aurelia/shared';

import type { Clock } from '../../clock';
import { AppError, conflict, notFound } from '../../http/errors';
import type { ElderDoc } from '../../repos';
import type { EldersRepo } from '../../repos/elders';
import type { PairingCodesRepo } from '../../repos/pairingCodes';
import type { UsersRepo } from '../../repos/users';
import { toElderResponse } from '../elders/serialize';
import { generatePairingCode } from '../pairing/code';

interface Deps {
  elders: EldersRepo;
  users: UsersRepo;
  codes: PairingCodesRepo;
  now: Clock;
}

const MAX_CODE_ATTEMPTS = 5;

/** The same for a missing, expired and used invite, so a guess learns nothing. */
const invalidInvite = () => new AppError('NOT_FOUND', 'Convite inválido ou expirado. Peça um novo a quem convidou você.');

/** Several caregivers per elder: invites, the list of who follows the elder, and leaving / removing. */
export function createCaregiversService({ elders, users, codes, now }: Deps) {
  return {
    /**
     * A code another caregiver types to follow this elder. Returns the invite still waiting to be used,
     * unless `renew` asks for a new one (which cancels it). `created` says which happened.
     */
    async issueInvite(elder: ElderDoc, caregiverUid: string, renew = false): Promise<PairingCodeResponse & { created: boolean }> {
      const current = now();
      if (!renew) {
        const active = await codes.findActive(elder.id, 'caregiverInvite', current);
        if (active) return { code: active.code, expiresAt: active.expiresAt.toISOString(), created: false };
      }
      const expiresAt = new Date(current.getTime() + CAREGIVER_INVITE_TTL_HOURS * 60 * 60_000);
      for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
        const code = generatePairingCode();
        if (await codes.issue(elder.id, code, caregiverUid, current, expiresAt, 'caregiverInvite')) {
          return { code, expiresAt: expiresAt.toISOString(), created: true };
        }
      }
      throw new Error('could not generate a free invite code');
    },

    /** POST /me/elders: redeems an invite and adds the caregiver to that elder. */
    async join(caregiverUid: string, code: string): Promise<Elder> {
      const elderId = await codes.redeem(code, now(), 'caregiverInvite');
      if (!elderId) throw invalidInvite();
      if (!(await elders.addCaregiver(elderId, caregiverUid))) {
        await codes.release(code);
        throw invalidInvite();
      }
      const elder = await elders.get(elderId);
      if (!elder) throw invalidInvite();
      return toElderResponse(elder);
    },

    async list(elder: ElderDoc): Promise<ElderCaregiversResponse> {
      const people = await users.getMany(elder.caregiverIds);
      return { items: people.map((user) => ({ id: user.id, name: user.name, email: user.email })) };
    },

    /** Any caregiver of the elder can remove another one, or themselves (leaving). The last one stays. */
    async remove(elder: ElderDoc, caregiverId: string): Promise<void> {
      const result = await elders.removeCaregiver(elder.id, caregiverId);
      if (result === 'notFound') throw notFound('Cuidador não encontrado.');
      if (result === 'last') {
        throw conflict(`Não é possível sair: você é o único cuidador de ${elder.name}. Para encerrar, exclua sua conta.`);
      }
    },
  };
}

export type CaregiversService = ReturnType<typeof createCaregiversService>;
