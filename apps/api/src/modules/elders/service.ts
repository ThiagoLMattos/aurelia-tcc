import type { CreateElderBody, Elder, ElderDetailResponse, PatchElderBody } from '@aurelia/shared';

import type { Clock } from '../../clock';
import { notFound } from '../../http/errors';
import type { ElderDoc } from '../../repos';
import type { DevicesRepo } from '../../repos/devices';
import type { EldersRepo } from '../../repos/elders';
import { toElderResponse } from './serialize';

interface Deps {
  elders: EldersRepo;
  devices: DevicesRepo;
  now: Clock;
}

export function createEldersService({ elders, devices, now }: Deps) {
  return {
    /** The creator becomes the first caregiver. */
    async create(caregiverUid: string, body: CreateElderBody): Promise<Elder> {
      const created = await elders.create(caregiverUid, body, now());
      if (!created) throw notFound('Perfil não encontrado.');
      return toElderResponse(created);
    },

    async detail(elder: ElderDoc): Promise<ElderDetailResponse> {
      const summaries = await devices.summaries(elder.id);
      return {
        ...toElderResponse(elder),
        devices: summaries.map((d) => ({ ...d, lastSeenAt: d.lastSeenAt?.toISOString() ?? null })),
      };
    },

    async patch(elderId: string, patch: PatchElderBody): Promise<Elder> {
      if (!(await elders.update(elderId, patch))) throw notFound('Idoso não encontrado.');
      const updated = await elders.get(elderId);
      if (!updated) throw notFound('Idoso não encontrado.');
      return toElderResponse(updated);
    },
  };
}

export type EldersService = ReturnType<typeof createEldersService>;
