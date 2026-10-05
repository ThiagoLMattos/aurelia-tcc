import { occurrenceId, type DoneBy, type LocalDate, type LocalTime } from '@aurelia/shared';
import { Timestamp, type Firestore } from 'firebase-admin/firestore';

import { isAlreadyExistsError, toDateOrNull } from './convert';
import { eventData, type EventRecord, type EventsRepo } from './events';

export interface OccurrenceDoc {
  routineId: string;
  date: LocalDate;
  scheduledTime: LocalTime;
  status: 'done' | 'missed';
  doneAt: Date | null;
  doneBy: DoneBy | null;
  markedMissedAt: Date | null;
}

interface OccurrenceData {
  routineId: string;
  date: LocalDate;
  scheduledTime: LocalTime;
  status: 'done' | 'missed';
  doneAt: Timestamp | null;
  doneBy: DoneBy | null;
  markedMissedAt: Timestamp | null;
  /** The taskDone event written with this occurrence, so an undo can mark it. */
  doneEventId: string | null;
}

export interface NewDoneOccurrence {
  routineId: string;
  date: LocalDate;
  scheduledTime: LocalTime;
  doneAt: Date;
  doneBy: DoneBy;
}

export interface NewMissedOccurrence {
  routineId: string;
  date: LocalDate;
  scheduledTime: LocalTime;
  markedMissedAt: Date;
}

export type UndoResult = 'undone' | 'notFound' | 'notDone';

function fromSnapshot(snap: FirebaseFirestore.QueryDocumentSnapshot): OccurrenceDoc {
  const data = snap.data() as OccurrenceData;
  return {
    routineId: data.routineId,
    date: data.date,
    scheduledTime: data.scheduledTime,
    status: data.status,
    doneAt: toDateOrNull(data.doneAt),
    doneBy: data.doneBy ?? null,
    markedMissedAt: toDateOrNull(data.markedMissedAt),
  };
}

export function createOccurrencesRepo(db: Firestore, events: EventsRepo) {
  const col = (elderId: string) => db.collection('elders').doc(elderId).collection('occurrences');

  /** Writes the occurrence and its event together; `create()` makes a second writer fail, not overwrite. */
  async function createWithEvent(
    elderId: string,
    occurrence: OccurrenceData,
    event: EventRecord,
  ): Promise<string | null> {
    const batch = db.batch();
    const eventRef = events.newRef(elderId);
    batch.create(col(elderId).doc(occurrenceId(occurrence.date, occurrence.routineId)), {
      ...occurrence,
      doneEventId: occurrence.status === 'done' ? eventRef.id : null,
    });
    batch.create(eventRef, eventData(event));
    try {
      await batch.commit();
      return eventRef.id;
    } catch (error) {
      if (isAlreadyExistsError(error)) return null;
      throw error;
    }
  }

  return {
    async forDate(elderId: string, date: LocalDate): Promise<OccurrenceDoc[]> {
      const snaps = await col(elderId).where('date', '==', date).get();
      return snaps.docs.map(fromSnapshot);
    },

    async between(elderId: string, from: LocalDate, to: LocalDate): Promise<OccurrenceDoc[]> {
      const snaps = await col(elderId).where('date', '>=', from).where('date', '<=', to).get();
      return snaps.docs.map(fromSnapshot);
    },

    /** Returns the new event id, or null when the task already has an occurrence (done or missed). */
    createDone(elderId: string, input: NewDoneOccurrence, event: EventRecord): Promise<string | null> {
      return createWithEvent(
        elderId,
        {
          routineId: input.routineId,
          date: input.date,
          scheduledTime: input.scheduledTime,
          status: 'done',
          doneAt: Timestamp.fromDate(input.doneAt),
          doneBy: input.doneBy,
          markedMissedAt: null,
          doneEventId: null,
        },
        event,
      );
    },

    /** Returns the new event id, or null when the task already has an occurrence. */
    createMissed(elderId: string, input: NewMissedOccurrence, event: EventRecord): Promise<string | null> {
      return createWithEvent(
        elderId,
        {
          routineId: input.routineId,
          date: input.date,
          scheduledTime: input.scheduledTime,
          status: 'missed',
          doneAt: null,
          doneBy: null,
          markedMissedAt: Timestamp.fromDate(input.markedMissedAt),
          doneEventId: null,
        },
        event,
      );
    },

    /** Deletes a done occurrence and flags its taskDone event, in one transaction. */
    undoDone(elderId: string, date: LocalDate, routineId: string, at: Date): Promise<UndoResult> {
      const ref = col(elderId).doc(occurrenceId(date, routineId));
      return db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists) return 'notFound';
        const data = snap.data() as OccurrenceData;
        if (data.status !== 'done') return 'notDone';
        // Firestore transactions need every read before the first write.
        const eventRef = data.doneEventId
          ? db.collection('elders').doc(elderId).collection('events').doc(data.doneEventId)
          : null;
        const eventSnap = eventRef ? await tx.get(eventRef) : null;
        tx.delete(ref);
        if (eventRef && eventSnap?.exists) tx.update(eventRef, { 'payload.undoneAt': at.toISOString() });
        return 'undone';
      });
    },
  };
}

export type OccurrencesRepo = ReturnType<typeof createOccurrencesRepo>;
