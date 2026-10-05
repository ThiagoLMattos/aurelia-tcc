import type { Event } from '@aurelia/shared';

import type { Clock } from '../../clock';
import { notFound } from '../../http/errors';
import type { ElderDoc } from '../../repos';
import type { EventsRepo } from '../../repos/events';
import type { UsersRepo } from '../../repos/users';

interface Deps {
  events: EventsRepo;
  users: UsersRepo;
  now: Clock;
}

export function createAlertsService({ events, users, now }: Deps) {
  return {
    /**
     * A caregiver says they are handling an SOS or safe-zone exit: the other caregivers see who, and
     * the emergency contacts are not texted for it. Acknowledging twice is harmless.
     */
    async acknowledge(elder: ElderDoc, eventId: string, caregiverId: string): Promise<Event> {
      const caregiver = await users.get(caregiverId);
      const event = await events.acknowledge(elder.id, eventId, { at: now(), name: caregiver?.name ?? 'Cuidador' });
      if (!event) throw notFound('Alerta não encontrado.');
      return event;
    },
  };
}

export type AlertsService = ReturnType<typeof createAlertsService>;
