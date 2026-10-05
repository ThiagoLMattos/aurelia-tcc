import {
  AgendaItemSchema,
  AgendaResponseSchema,
  AssistantReplySchema,
  ContactSchema,
  ContactsResponseSchema,
  CreateDeviceResponseSchema,
  ElderDetailResponseSchema,
  ElderSchema,
  EventSchema,
  EventsPageSchema,
  GameResultResponseSchema,
  LocationResponseSchema,
  MeResponseSchema,
  PairingCodeResponseSchema,
  PairResponseSchema,
  RoutineSchema,
  RoutinesResponseSchema,
  SignupResponseSchema,
  SosResponseSchema,
  WeeklyReportSchema,
} from '@aurelia/shared';

import type { ApiClient } from './client';
import type { Api } from './types';

const elderPath = (elderId: string) => `/elders/${encodeURIComponent(elderId)}`;

/** The HTTP implementation of `Api`: every response is validated with the shared zod schema. */
export function createEndpoints(client: ApiClient): Api {
  const { request } = client;

  return {
    signup: (body) => request('POST', '/auth/signup', { body, schema: SignupResponseSchema, auth: false }),
    pair: (body) => request('POST', '/auth/pair', { body, schema: PairResponseSchema, auth: false }),

    getMe: () => request('GET', '/me', { schema: MeResponseSchema }),
    patchMe: (body) => request('PATCH', '/me', { body, schema: MeResponseSchema }),
    registerPushToken: (token) => request('POST', '/me/push-tokens', { body: { token } }),
    unregisterPushToken: (token) => request('DELETE', `/me/push-tokens/${encodeURIComponent(token)}`),

    createElder: (body) => request('POST', '/elders', { body, schema: ElderSchema }),
    getElder: (elderId) => request('GET', elderPath(elderId), { schema: ElderDetailResponseSchema }),
    patchElder: (elderId, body) => request('PATCH', elderPath(elderId), { body, schema: ElderSchema }),
    issuePairingCode: (elderId) => request('POST', `${elderPath(elderId)}/pairing-codes`, { schema: PairingCodeResponseSchema }),
    unpairElderPhone: (elderId) => request('DELETE', `${elderPath(elderId)}/session`),

    listRoutines: (elderId) => request('GET', `${elderPath(elderId)}/routines`, { schema: RoutinesResponseSchema }),
    createRoutine: (elderId, body) => request('POST', `${elderPath(elderId)}/routines`, { body, schema: RoutineSchema }),
    patchRoutine: (elderId, routineId, body) =>
      request('PATCH', `${elderPath(elderId)}/routines/${encodeURIComponent(routineId)}`, { body, schema: RoutineSchema }),
    deleteRoutine: (elderId, routineId) => request('DELETE', `${elderPath(elderId)}/routines/${encodeURIComponent(routineId)}`),

    getAgenda: (elderId, date) => request('GET', `${elderPath(elderId)}/agenda`, { query: { date }, schema: AgendaResponseSchema }),
    markDone: (elderId, date, routineId) =>
      request('POST', `${elderPath(elderId)}/agenda/${date}/${encodeURIComponent(routineId)}/done`, { schema: AgendaItemSchema }),
    undoDone: (elderId, date, routineId) =>
      request('DELETE', `${elderPath(elderId)}/agenda/${date}/${encodeURIComponent(routineId)}/done`),

    listContacts: (elderId) => request('GET', `${elderPath(elderId)}/contacts`, { schema: ContactsResponseSchema }),
    createContact: (elderId, body) => request('POST', `${elderPath(elderId)}/contacts`, { body, schema: ContactSchema }),
    patchContact: (elderId, contactId, body) =>
      request('PATCH', `${elderPath(elderId)}/contacts/${encodeURIComponent(contactId)}`, { body, schema: ContactSchema }),
    deleteContact: (elderId, contactId) => request('DELETE', `${elderPath(elderId)}/contacts/${encodeURIComponent(contactId)}`),

    listEvents: (elderId, params = {}) =>
      request('GET', `${elderPath(elderId)}/events`, {
        query: { from: params.from, to: params.to, types: params.types?.join(','), limit: params.limit, cursor: params.cursor },
        schema: EventsPageSchema,
      }),
    getWeeklyReport: (elderId, weekStart) =>
      request('GET', `${elderPath(elderId)}/reports/weekly`, { query: { weekStart }, schema: WeeklyReportSchema }),
    sendSos: (elderId, body = {}) => request('POST', `${elderPath(elderId)}/sos`, { body, schema: SosResponseSchema }),
    resolveGeofence: (elderId, body = {}) => request('POST', `${elderPath(elderId)}/geofence/resolve`, { body, schema: EventSchema }),

    sendGameResult: (elderId, body) => request('POST', `${elderPath(elderId)}/games`, { body, schema: GameResultResponseSchema }),

    createDevice: (elderId, body) => request('POST', `${elderPath(elderId)}/devices`, { body, schema: CreateDeviceResponseSchema }),
    deleteDevice: (elderId, deviceId) => request('DELETE', `${elderPath(elderId)}/devices/${encodeURIComponent(deviceId)}`),
    getLocation: (elderId) => request('GET', `${elderPath(elderId)}/location`, { schema: LocationResponseSchema }),

    sendAssistantMessage: (elderId, body) =>
      request('POST', `${elderPath(elderId)}/assistant/messages`, { body, schema: AssistantReplySchema }),
  };
}
