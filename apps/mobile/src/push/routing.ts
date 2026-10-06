import { PushDataSchema, type PushData } from '@aurelia/shared';

import type { AuthRole } from '@/lib/auth/adapter';

export interface PushRoute {
  pathname: string;
  params?: Record<string, string>;
}

/** Reads a notification's `data`, ignoring anything that is not one of our pushes. */
export function parsePushData(data: unknown): PushData | null {
  const parsed = PushDataSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}

/**
 * Where tapping a push leads (spec §6): a geofence exit opens the breach screen, an SOS the SOS alert,
 * a missed task the agenda. Elders get no pushes from the API (their reminders are local), so any
 * tap on an elder phone just lands on its home.
 */
export function routeForPush(data: PushData, role: AuthRole): PushRoute {
  if (role === 'elder') return { pathname: '/(elder)' };
  const params = { elderId: data.elderId, ...(data.eventId ? { eventId: data.eventId } : {}) };
  switch (data.type) {
    case 'geofenceExit':
      return { pathname: '/(caregiver)/geo-fence-breach', params };
    case 'sos':
      return { pathname: '/(caregiver)/sos-alert', params };
    case 'taskMissed':
    case 'taskDone':
      return { pathname: '/(caregiver)/(tabs)' };
    case 'geofenceReturn':
    case 'contactsAlerted':
    case 'dailySummary':
      return { pathname: '/(caregiver)/(tabs)/history' };
    case 'deviceOffline':
      return { pathname: '/(caregiver)/(tabs)/profile' };
  }
}

/** Local reminders carry `{ kind: 'reminder' }`; tapping one on the elder phone opens the task list. */
export function isReminderData(data: unknown): boolean {
  return typeof data === 'object' && data !== null && (data as { kind?: unknown }).kind === 'reminder';
}
