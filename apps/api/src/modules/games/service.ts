import type { Event, GamePlayedPayload } from '@aurelia/shared';

import type { ElderDoc } from '../../repos';
import type { EventsService } from '../events/service';

interface Deps {
  events: EventsService;
}

export function createGamesService({ events }: Deps) {
  return {
    /** A finished game goes into the timeline, where the history and the weekly report find it. No push: it is not an alert. */
    async record(elder: ElderDoc, result: GamePlayedPayload): Promise<Event> {
      return events.append(elder, { type: 'gamePlayed', payload: result });
    },
  };
}

export type GamesService = ReturnType<typeof createGamesService>;
