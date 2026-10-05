import {
  nextLocationState,
  type DeviceLocationBody,
  type Event,
  type LocationResponse,
  type LocationState,
  type ResolveGeofenceBody,
} from '@aurelia/shared';

import type { Clock } from '../../clock';
import { conflict, notFound } from '../../http/errors';
import type { ElderDoc } from '../../repos';
import type { DeviceDoc, DevicesRepo } from '../../repos/devices';
import type { EventsRepo } from '../../repos/events';
import type { LocationRepo } from '../../repos/location';
import type { Notifier } from '../../push/notify';
import { toElderResponse } from '../elders/serialize';
import type { EventsService } from '../events/service';

interface Deps {
  location: LocationRepo;
  devices: DevicesRepo;
  eventsRepo: EventsRepo;
  events: EventsService;
  notifier: Notifier;
  now: Clock;
}

export function createLocationService({ location, devices, eventsRepo, events, notifier, now }: Deps) {
  return {
    /**
     * One report from a tracker. The state machine runs in a transaction on the elder, so concurrent
     * reports cannot both emit the same transition; the push goes out after it has committed.
     */
    async ingest(device: DeviceDoc, report: DeviceLocationBody): Promise<void> {
      const at = now();
      const reading = { lat: report.lat, lng: report.lng };

      const applied = await location.apply(device.elderId, (elder) => {
        const prev: LocationState = toElderResponse(elder).locationState;
        const next = nextLocationState(prev, reading, at, elder.safeZone);
        const draft =
          next.transition === 'exit'
            ? ({
                type: 'geofenceExit',
                payload: { ...reading, distanceM: Math.round(next.distanceM ?? 0), resolvedAt: null, resolvedNote: null },
              } as const)
            : next.transition === 'return'
              ? ({ type: 'geofenceReturn', payload: reading } as const)
              : null;
        return { state: next.state, event: draft ? events.record(elder, draft, at) : null };
      });
      if (!applied) throw notFound('Idoso não encontrado.');

      await devices.touch(device.elderId, device.id, at, report);

      if (applied.eventId) {
        const { elder, eventId } = applied;
        const event = await eventsRepo.get(elder.id, eventId);
        if (event?.type === 'geofenceExit') await notifier.geofenceExit(elder, eventId, event.payload.distanceM);
        else if (event?.type === 'geofenceReturn') await notifier.geofenceReturn(elder, eventId);
      }
    },

    async current(elder: ElderDoc): Promise<LocationResponse> {
      const state = toElderResponse(elder).locationState;
      const seen = (await devices.summaries(elder.id)).flatMap((d) => (d.lastSeenAt ? [d.lastSeenAt] : []));
      const latest = seen.length > 0 ? new Date(Math.max(...seen.map((d) => d.getTime()))) : null;
      return {
        status: state.status,
        since: state.since,
        lat: state.lastLat,
        lng: state.lastLng,
        at: state.lastAt,
        safeZone: elder.safeZone,
        deviceLastSeenAt: latest?.toISOString() ?? null,
      };
    },

    /**
     * A caregiver confirms the elder is safe. Only annotates the exit event; whether the elder is
     * inside or outside stays the tracker's call.
     */
    async resolve(elder: ElderDoc, body: ResolveGeofenceBody): Promise<Event> {
      let eventId = body.eventId;
      if (!eventId) {
        const latest = (await eventsRepo.query(elder.id, { limit: 1, types: ['geofenceExit'] }))?.items[0];
        if (!latest || (latest.type === 'geofenceExit' && latest.payload.resolvedAt)) {
          throw notFound('Nenhuma saída da área segura pendente.');
        }
        eventId = latest.id;
      }

      const result = await eventsRepo.resolveExit(elder.id, eventId, { at: now(), note: body.note ?? null });
      if (result === 'notFound') throw notFound('Saída da área segura não encontrada.');
      if (result === 'alreadyResolved') throw conflict('Esta saída já foi confirmada.');
      return (await eventsRepo.get(elder.id, eventId)) as Event;
    },
  };
}

export type LocationService = ReturnType<typeof createLocationService>;
