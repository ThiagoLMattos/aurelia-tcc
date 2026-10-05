import type { LocationState } from '@aurelia/shared';
import { Timestamp, type Firestore } from 'firebase-admin/firestore';

import { elderFromSnapshot, type ElderDoc } from './elders';
import { eventData, type EventRecord, type EventsRepo } from './events';

export interface LocationUpdate {
  state: LocationState;
  /** Written in the same transaction as the new state, so a transition is never lost or doubled. */
  event: EventRecord | null;
}

const toTimestamp = (iso: string | null) => (iso ? Timestamp.fromDate(new Date(iso)) : null);

/** The server-maintained `locationState` of an elder (spec §3). */
export function createLocationRepo(db: Firestore, events: EventsRepo) {
  return {
    /**
     * Reads the elder, lets `compute` decide the next state from it, and stores state (and event) atomically.
     * `compute` may run more than once if the transaction retries, so it must be pure.
     * Returns null when the elder does not exist.
     */
    async apply(
      elderId: string,
      compute: (elder: ElderDoc) => LocationUpdate,
    ): Promise<{ elder: ElderDoc; eventId: string | null } | null> {
      const ref = db.collection('elders').doc(elderId);
      const eventRef = events.newRef(elderId);
      return db.runTransaction(async (tx) => {
        const elder = elderFromSnapshot(await tx.get(ref));
        if (!elder) return null;

        const { state, event } = compute(elder);
        tx.update(ref, {
          locationState: {
            status: state.status,
            since: toTimestamp(state.since),
            lastLat: state.lastLat,
            lastLng: state.lastLng,
            lastAt: toTimestamp(state.lastAt),
            consecutiveOutside: state.consecutiveOutside,
            consecutiveInside: state.consecutiveInside,
          },
        });
        if (event) tx.create(eventRef, eventData(event));
        return { elder, eventId: event ? eventRef.id : null };
      });
    },
  };
}

export type LocationRepo = ReturnType<typeof createLocationRepo>;
