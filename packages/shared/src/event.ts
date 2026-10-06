import { z } from 'zod';

import { DoneBySchema } from './agenda';
import { GamePlayedPayloadSchema } from './game';
import { IdSchema, IsoDateTimeSchema, LatSchema, LngSchema, LocalDateSchema, LocalTimeSchema } from './primitives';

export const EventTypeSchema = z.enum([
  'taskDone',
  'taskMissed',
  'sos',
  'geofenceExit',
  'geofenceReturn',
  'deviceOffline',
  'devicePaired',
  'gamePlayed',
  'contactsAlerted',
  'dailySummary',
]);
export type EventType = z.infer<typeof EventTypeSchema>;

const base = { id: IdSchema, at: IsoDateTimeSchema, date: LocalDateSchema };

const taskPayload = {
  routineId: IdSchema,
  routineName: z.string(),
  date: LocalDateSchema,
  scheduledTime: LocalTimeSchema,
};

export const TaskDonePayloadSchema = z.object({
  ...taskPayload,
  doneBy: DoneBySchema,
  /** Set when a caregiver undid the confirmation; the event stays in the timeline as a record. */
  undoneAt: IsoDateTimeSchema.nullable().default(null),
});
export const TaskMissedPayloadSchema = z.object(taskPayload);
/** What an alert (SOS, safe-zone exit) records about who answered it and whether the contacts were texted. */
const alertPayload = {
  /** Set when a caregiver said they are handling it (POST …/events/:eventId/acknowledge). */
  acknowledgedAt: IsoDateTimeSchema.nullable().default(null),
  /** The name of that caregiver, so the others see who is on it. */
  acknowledgedBy: z.string().nullable().default(null),
  /** Set when nobody answered in time and the emergency contacts were texted (see `contactsAlerted`). */
  escalatedAt: IsoDateTimeSchema.nullable().default(null),
};

export const AlertTypeSchema = z.enum(['sos', 'geofenceExit']);
export type AlertType = z.infer<typeof AlertTypeSchema>;

export const SosPayloadSchema = z.object({ lat: LatSchema.nullable(), lng: LngSchema.nullable(), ...alertPayload });
export const GeofenceExitPayloadSchema = z.object({
  lat: LatSchema,
  lng: LngSchema,
  distanceM: z.number().min(0),
  /** Set when a caregiver confirmed the elder is safe (POST …/geofence/resolve). */
  resolvedAt: IsoDateTimeSchema.nullable().default(null),
  resolvedNote: z.string().nullable().default(null),
  ...alertPayload,
});
export const GeofenceReturnPayloadSchema = z.object({ lat: LatSchema, lng: LngSchema });
export const DeviceOfflinePayloadSchema = z.object({ deviceId: IdSchema, lastSeenAt: IsoDateTimeSchema.nullable() });
export const DevicePairedPayloadSchema = z.object({ deviceId: IdSchema, label: z.string() });
/** The emergency contacts were texted because nobody acknowledged an alert in time. */
export const ContactsAlertedPayloadSchema = z.object({
  alertEventId: IdSchema,
  alertType: AlertTypeSchema,
  /** Names of the contacts the SMS reached the provider for. */
  sent: z.array(z.string()),
  /** Names of the contacts whose SMS could not be sent. */
  failed: z.array(z.string()),
});

/** Aurélia's summary of the elder's day, for the caregivers who turned on "Insights da Aurélia". */
export const DailySummaryPayloadSchema = z.object({ text: z.string().min(1) });

export const EventSchema = z.discriminatedUnion('type', [
  z.object({ ...base, type: z.literal('taskDone'), payload: TaskDonePayloadSchema }),
  z.object({ ...base, type: z.literal('taskMissed'), payload: TaskMissedPayloadSchema }),
  z.object({ ...base, type: z.literal('sos'), payload: SosPayloadSchema }),
  z.object({ ...base, type: z.literal('geofenceExit'), payload: GeofenceExitPayloadSchema }),
  z.object({ ...base, type: z.literal('geofenceReturn'), payload: GeofenceReturnPayloadSchema }),
  z.object({ ...base, type: z.literal('deviceOffline'), payload: DeviceOfflinePayloadSchema }),
  z.object({ ...base, type: z.literal('devicePaired'), payload: DevicePairedPayloadSchema }),
  z.object({ ...base, type: z.literal('gamePlayed'), payload: GamePlayedPayloadSchema }),
  z.object({ ...base, type: z.literal('contactsAlerted'), payload: ContactsAlertedPayloadSchema }),
  z.object({ ...base, type: z.literal('dailySummary'), payload: DailySummaryPayloadSchema }),
]);
export type Event = z.infer<typeof EventSchema>;
/** An SOS or safe-zone exit: the events a caregiver acknowledges and that may escalate to the contacts. */
export type AlertEvent = Extract<Event, { type: AlertType }>;
export type AlertPayload = AlertEvent['payload'];
/** An event as written, before the payload defaults are applied. */
export type EventInput = z.input<typeof EventSchema>;

export const EventsQuerySchema = z.object({
  from: LocalDateSchema.optional(),
  to: LocalDateSchema.optional(),
  /** Comma-separated list, e.g. `sos,geofenceExit`. */
  types: z
    .string()
    .transform((value) => value.split(',').filter(Boolean))
    .pipe(z.array(EventTypeSchema).min(1))
    .optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().min(1).optional(),
});
export type EventsQuery = z.infer<typeof EventsQuerySchema>;

export const EventsPageSchema = z.object({
  items: z.array(EventSchema),
  nextCursor: z.string().nullable(),
});
export type EventsPage = z.infer<typeof EventsPageSchema>;

export const SosBodySchema = z
  .strictObject({ lat: LatSchema.optional(), lng: LngSchema.optional() })
  .refine((body) => (body.lat === undefined) === (body.lng === undefined), 'Envie latitude e longitude juntas.');
export type SosBody = z.infer<typeof SosBodySchema>;

export const SosResponseSchema = z.object({ eventId: IdSchema });
export type SosResponse = z.infer<typeof SosResponseSchema>;

export const ResolveGeofenceBodySchema = z.strictObject({
  eventId: IdSchema.optional(),
  note: z.string().trim().max(500).optional(),
});
export type ResolveGeofenceBody = z.infer<typeof ResolveGeofenceBodySchema>;

export const EventParamsSchema = z.object({ elderId: IdSchema, eventId: IdSchema });
export type EventParams = z.infer<typeof EventParamsSchema>;
