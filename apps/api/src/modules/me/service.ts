import type { MeResponse, PatchMeBody } from '@aurelia/shared';

import { notFound } from '../../http/errors';
import type { EldersRepo } from '../../repos/elders';
import type { UsersRepo } from '../../repos/users';
import { toElderResponse } from '../elders/serialize';

interface Deps {
  users: UsersRepo;
  elders: EldersRepo;
}

export function createMeService({ users, elders }: Deps) {
  async function getMe(auth: Express.AuthContext): Promise<MeResponse> {
    if (auth.role === 'elder') {
      const elder = await elders.get(auth.elderId!);
      if (!elder) throw notFound('Idoso não encontrado.');
      return { role: 'elder', elder: toElderResponse(elder) };
    }

    const user = await users.get(auth.uid);
    if (!user) throw notFound('Perfil não encontrado.');
    const eldersOfUser = await elders.getMany(user.elderIds);
    return {
      role: 'caregiver',
      caregiver: {
        id: user.id,
        name: user.name,
        email: user.email,
        settings: user.settings,
        createdAt: user.createdAt.toISOString(),
      },
      elders: eldersOfUser.filter((elder) => elder.caregiverIds.includes(user.id)).map(toElderResponse),
    };
  }

  return {
    getMe,

    async patchMe(auth: Express.AuthContext, patch: PatchMeBody): Promise<MeResponse> {
      const found = await users.update(auth.uid, patch);
      if (!found) throw notFound('Perfil não encontrado.');
      return getMe(auth);
    },

    /** Elder tokens live on the elder doc, caregiver tokens on users/{uid}. Idempotent. */
    async addPushToken(auth: Express.AuthContext, token: string): Promise<void> {
      const found =
        auth.role === 'elder' ? await elders.addPushToken(auth.elderId!, token) : await users.addPushToken(auth.uid, token);
      if (!found) throw notFound('Perfil não encontrado.');
    },

    async removePushToken(auth: Express.AuthContext, token: string): Promise<void> {
      const found =
        auth.role === 'elder'
          ? await elders.removePushToken(auth.elderId!, token)
          : await users.removePushToken(auth.uid, token);
      if (!found) throw notFound('Perfil não encontrado.');
    },
  };
}

export type MeService = ReturnType<typeof createMeService>;
