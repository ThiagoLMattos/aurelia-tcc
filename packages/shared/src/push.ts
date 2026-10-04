import { z } from 'zod';

import { IdSchema } from './primitives';

const base = { elderId: IdSchema, eventId: IdSchema.optional() };

/** `data` of every push the API sends; the app routes on `type` when the notification is tapped. */
export const PushDataSchema = z.discriminatedUnion('type', [
  z.object({ ...base, type: z.literal('geofenceExit') }),
  z.object({ ...base, type: z.literal('geofenceReturn') }),
  z.object({ ...base, type: z.literal('sos') }),
  z.object({ ...base, type: z.literal('taskMissed') }),
  z.object({ ...base, type: z.literal('taskDone') }),
]);
export type PushData = z.infer<typeof PushDataSchema>;

export const PUSH_CHANNELS = { alerts: 'alerts', reminders: 'reminders' } as const;
