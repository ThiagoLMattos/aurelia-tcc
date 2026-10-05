import type { Event, SosBody } from '@aurelia/shared';

import type { ElderDoc } from '../../repos';
import type { EventsService } from '../events/service';

interface Deps {
  events: EventsService;
}

export function createSosService({ events }: Deps) {
  return {
    /**
     * Records the SOS in the timeline and returns the stored event. This is the single place the
     * push to caregivers will be attached to.
     */
    async trigger(elder: ElderDoc, body: SosBody): Promise<Event> {
      return events.append(elder, {
        type: 'sos',
        payload: { lat: body.lat ?? null, lng: body.lng ?? null },
      });
    },
  };
}

export type SosService = ReturnType<typeof createSosService>;
