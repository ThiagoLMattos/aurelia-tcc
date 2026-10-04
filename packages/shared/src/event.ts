import { z } from 'zod';

import { DoneBySchema } from './agenda';
import { IdSchema, IsoDateTimeSchema, LatSchema, LngSchema, LocalDateSchema, LocalTimeSchema } from './primitives';

export const EventTypeSchema = z.enum([
  'taskDone',
  'taskMissed',
  'sos',
  'geofenceExit',
  'geofenceReturn',
  'deviceOffline',
  'devicePaired',
]);
export type EventType = z.infer<typeof EventTypeSchema>;

const base = { id: IdSchema, at: IsoDateTimeSchema, date: LocalDateSchema };

const taskPayload = {
  routineId: IdSchema,
  routineName: z.string(),
  date: LocalDateSchema,
  scheduledTime: LocalTimeSchema,
};

export const TaskDonePayloadSchema = z.object({ ...taskPayload, doneBy: DoneBySchema });
export const TaskMissedPayloadSchema = z.object(taskPayload);
export const SosPayloadSchema = z.object({ lat: LatSchema.nullable(), lng: LngSchema.nullable() });
export const GeofenceExitPayloadSchema = z.object({
  lat: LatSchema,
  lng: LngSchema,
  distanceM: z.number().min(0),
  /** Set when a caregiver confirmed the elder is safe (POST …/geofence/resolve). */
  resolvedAt: IsoDateTimeSchema.nullable().default(null),
  resolvedNote: z.string().nullable().default(null),
});
export const GeofenceReturnPayloadSchema = z.object({ lat: LatSchema, lng: LngSchema });
export const DeviceOfflinePayloadSchema = z.object({ deviceId: IdSchema, lastSeenAt: IsoDateTimeSchema.nullable() });
export const DevicePairedPayloadSchema = z.object({ deviceId: IdSchema, label: z.string() });

export const EventSchema = z.discriminatedUnion('type', [
  z.object({ ...base, type: z.literal('taskDone'), payload: TaskDonePayloadSchema }),
  z.object({ ...base, type: z.literal('taskMissed'), payload: TaskMissedPayloadSchema }),
  z.object({ ...base, type: z.literal('sos'), payload: SosPayloadSchema }),
  z.object({ ...base, type: z.literal('geofenceExit'), payload: GeofenceExitPayloadSchema }),
  z.object({ ...base, type: z.literal('geofenceReturn'), payload: GeofenceReturnPayloadSchema }),
  z.object({ ...base, type: z.literal('deviceOffline'), payload: DeviceOfflinePayloadSchema }),
  z.object({ ...base, type: z.literal('devicePaired'), payload: DevicePairedPayloadSchema }),
]);
export type Event = z.infer<typeof EventSchema>;

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

export const SosBodySchema = z.strictObject({ lat: LatSchema.optional(), lng: LngSchema.optional() });
export type SosBody = z.infer<typeof SosBodySchema>;

export const SosResponseSchema = z.object({ eventId: IdSchema });
export type SosResponse = z.infer<typeof SosResponseSchema>;

export const ResolveGeofenceBodySchema = z.strictObject({
  eventId: IdSchema.optional(),
  note: z.string().trim().max(500).optional(),
});
export type ResolveGeofenceBody = z.infer<typeof ResolveGeofenceBodySchema>;
