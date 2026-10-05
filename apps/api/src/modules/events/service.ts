import { addDays, instantOf, localDateOf, type Event, type EventsPage, type EventsQuery } from '@aurelia/shared';

import type { Clock } from '../../clock';
import { validationError } from '../../http/errors';
import type { ElderDoc, EventDraft, EventRecord } from '../../repos';
import type { EventsRepo } from '../../repos/events';

interface Deps {
  events: EventsRepo;
  now: Clock;
}

type ElderTimezone = Pick<ElderDoc, 'id' | 'timezone'>;

export function createEventsService({ events, now }: Deps) {
  /** Stamps a draft with the instant and the elder's local date. */
  function record(elder: Pick<ElderDoc, 'timezone'>, draft: EventDraft, at: Date): EventRecord {
    return { ...draft, at, date: localDateOf(at, elder.timezone) } as EventRecord;
  }

  return {
    record,

    /** The one way other modules add to the timeline (append-only). Returns the stored event. */
    async append(elder: ElderTimezone, draft: EventDraft, at: Date = now()): Promise<Event> {
      const stamped = record(elder, draft, at);
      const id = await events.append(elder.id, stamped);
      return { ...stamped, id, at: at.toISOString() } as Event;
    },

    async list(elder: ElderTimezone, query: EventsQuery): Promise<EventsPage> {
      if (query.from && query.to && query.from > query.to) {
        throw validationError('A data inicial deve ser anterior à final.');
      }
      const page = await events.query(elder.id, {
        limit: query.limit,
        ...(query.from ? { from: instantOf(query.from, '00:00', elder.timezone) } : {}),
        ...(query.to ? { to: instantOf(addDays(query.to, 1), '00:00', elder.timezone) } : {}),
        ...(query.types ? { types: query.types } : {}),
        ...(query.cursor ? { cursor: query.cursor } : {}),
      });
      if (!page) throw validationError('Cursor inválido.');
      return page;
    },
  };
}

export type EventsService = ReturnType<typeof createEventsService>;
