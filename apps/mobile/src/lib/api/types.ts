import type {
  AgendaItem,
  AgendaResponse,
  AssistantMessageBody,
  AssistantReply,
  Contact,
  ContactsResponse,
  CreateContactBody,
  CreateDeviceBody,
  CreateDeviceResponse,
  CreateElderBody,
  CreateRoutineBody,
  Elder,
  ElderDetailResponse,
  Event,
  EventsPage,
  EventType,
  LocalDate,
  LocationResponse,
  MeResponse,
  PairBody,
  PairingCodeResponse,
  PairResponse,
  PatchContactBody,
  PatchElderBody,
  PatchMeBody,
  PatchRoutineBody,
  ResolveGeofenceBody,
  Routine,
  RoutinesResponse,
  SignupBody,
  SignupResponse,
  SosBody,
  SosResponse,
  WeeklyReport,
} from '@aurelia/shared';

export interface EventsParams {
  from?: LocalDate;
  to?: LocalDate;
  types?: EventType[];
  limit?: number;
  cursor?: string;
}

/**
 * One function per row of the API table. `endpoints.ts` implements it over HTTP and `mock.ts` over
 * an in-memory store, so screens never know which one they are talking to.
 */
export interface Api {
  // Public
  signup(body: SignupBody): Promise<SignupResponse>;
  pair(body: PairBody): Promise<PairResponse>;

  // Me
  getMe(): Promise<MeResponse>;
  patchMe(body: PatchMeBody): Promise<MeResponse>;
  registerPushToken(token: string): Promise<void>;
  unregisterPushToken(token: string): Promise<void>;

  // Elders
  createElder(body: CreateElderBody): Promise<Elder>;
  getElder(elderId: string): Promise<ElderDetailResponse>;
  patchElder(elderId: string, body: PatchElderBody): Promise<Elder>;
  issuePairingCode(elderId: string): Promise<PairingCodeResponse>;
  unpairElderPhone(elderId: string): Promise<void>;

  // Routines
  listRoutines(elderId: string): Promise<RoutinesResponse>;
  createRoutine(elderId: string, body: CreateRoutineBody): Promise<Routine>;
  patchRoutine(elderId: string, routineId: string, body: PatchRoutineBody): Promise<Routine>;
  deleteRoutine(elderId: string, routineId: string): Promise<void>;

  // Agenda
  getAgenda(elderId: string, date?: LocalDate): Promise<AgendaResponse>;
  markDone(elderId: string, date: LocalDate, routineId: string): Promise<AgendaItem>;
  undoDone(elderId: string, date: LocalDate, routineId: string): Promise<void>;

  // Contacts
  listContacts(elderId: string): Promise<ContactsResponse>;
  createContact(elderId: string, body: CreateContactBody): Promise<Contact>;
  patchContact(elderId: string, contactId: string, body: PatchContactBody): Promise<Contact>;
  deleteContact(elderId: string, contactId: string): Promise<void>;

  // History, reports, alerts
  listEvents(elderId: string, params?: EventsParams): Promise<EventsPage>;
  getWeeklyReport(elderId: string, weekStart?: LocalDate): Promise<WeeklyReport>;
  sendSos(elderId: string, body?: SosBody): Promise<SosResponse>;
  resolveGeofence(elderId: string, body?: ResolveGeofenceBody): Promise<Event>;

  // Trackers and location
  createDevice(elderId: string, body: CreateDeviceBody): Promise<CreateDeviceResponse>;
  deleteDevice(elderId: string, deviceId: string): Promise<void>;
  getLocation(elderId: string): Promise<LocationResponse>;

  // Assistant
  sendAssistantMessage(elderId: string, body: AssistantMessageBody): Promise<AssistantReply>;
}
