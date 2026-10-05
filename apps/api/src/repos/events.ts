import { EventSchema, type Event, type EventType, type LocalDate } from '@aurelia/shared';
import { FieldPath, Timestamp, type DocumentReference, type Firestore } from 'firebase-admin/firestore';

/** What a caller says happened: the event without the id and the moment it is stored with. */
export type EventDraft = Event extends infer E ? (E extends Event ? Omit<E, 'id' | 'at' | 'date'> : never) : never;

/** An event ready to store: `at` is the instant, `date` the local date in the elder's timezone. */
export type EventRecord = EventDraft & { at: Date; date: LocalDate };

export interface EventsQueryParams {
  /** Inclusive start / exclusive end of the window, as instants. */
  from?: Date;
  to?: Date;
  types?: EventType[];
  limit: number;
  cursor?: string;
}

export interface EventsPageResult {
  items: Event[];
  nextCursor: string | null;
}

interface EventData {
  type: EventType;
  at: Timestamp;
  date: LocalDate;
  payload: Record<string, unknown>;
}

export const eventData = (record: EventRecord): EventData => ({
  type: record.type,
  at: Timestamp.fromDate(record.at),
  date: record.date,
  payload: { ...record.payload },
});

function toEvent(snap: FirebaseFirestore.QueryDocumentSnapshot): Event {
  const data = snap.data() as EventData;
  return EventSchema.parse({
    id: snap.id,
    type: data.type,
    at: data.at.toDate().toISOString(),
    date: data.date,
    payload: data.payload,
  });
}

export const encodeCursor = (at: Timestamp, id: string): string =>
  Buffer.from(JSON.stringify([at.toMillis(), id])).toString('base64url');

export function decodeCursor(cursor: string): { at: Timestamp; id: string } | null {
  try {
    const [millis, id] = JSON.parse(Buffer.from(cursor, 'base64url').toString()) as [unknown, unknown];
    if (typeof millis !== 'number' || typeof id !== 'string' || !id) return null;
    return { at: Timestamp.fromMillis(millis), id };
  } catch {
    return null;
  }
}

export function createEventsRepo(db: Firestore) {
  const col = (elderId: string) => db.collection('elders').doc(elderId).collection('events');

  return {
    /** A reference for an event that will be written together with other documents. */
    newRef: (elderId: string): DocumentReference => col(elderId).doc(),

    async append(elderId: string, record: EventRecord): Promise<string> {
      const ref = col(elderId).doc();
      await ref.create(eventData(record));
      return ref.id;
    },

    /** Newest first. Returns null when the cursor is not one this repo issued. */
    async query(elderId: string, params: EventsQueryParams): Promise<EventsPageResult | null> {
      let query: FirebaseFirestore.Query = col(elderId);
      if (params.types) query = query.where('type', 'in', params.types);
      if (params.from) query = query.where('at', '>=', Timestamp.fromDate(params.from));
      if (params.to) query = query.where('at', '<', Timestamp.fromDate(params.to));
      query = query.orderBy('at', 'desc').orderBy(FieldPath.documentId(), 'desc');
      if (params.cursor) {
        const decoded = decodeCursor(params.cursor);
        if (!decoded) return null;
        query = query.startAfter(decoded.at, decoded.id);
      }

      const snaps = (await query.limit(params.limit + 1).get()).docs;
      const page = snaps.slice(0, params.limit);
      const last = page.at(-1);
      const lastData = last?.data() as EventData | undefined;
      return {
        items: page.map(toEvent),
        nextCursor: snaps.length > params.limit && last && lastData ? encodeCursor(lastData.at, last.id) : null,
      };
    },

    /** Every event in the window, oldest first (reports). */
    async between(elderId: string, from: Date, to: Date): Promise<Event[]> {
      const snaps = await col(elderId)
        .where('at', '>=', Timestamp.fromDate(from))
        .where('at', '<', Timestamp.fromDate(to))
        .orderBy('at', 'asc')
        .get();
      return snaps.docs.map(toEvent);
    },
  };
}

export type EventsRepo = ReturnType<typeof createEventsRepo>;
