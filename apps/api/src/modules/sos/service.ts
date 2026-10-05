import type { Event, SosBody } from '@aurelia/shared';

import type { ElderDoc } from '../../repos';
import type { Notifier } from '../../push/notify';
import type { EventsService } from '../events/service';

interface Deps {
  events: EventsService;
  notifier: Notifier;
}

export function createSosService({ events, notifier }: Deps) {
  return {
    /** Records the SOS in the timeline, then alerts every caregiver. A failed push never fails the SOS. */
    async trigger(elder: ElderDoc, body: SosBody): Promise<Event> {
      const payload = { lat: body.lat ?? null, lng: body.lng ?? null };
      const event = await events.append(elder, { type: 'sos', payload });
      await notifier.sos(elder, event.id, payload);
      return event;
    },
  };
}

export type SosService = ReturnType<typeof createSosService>;
