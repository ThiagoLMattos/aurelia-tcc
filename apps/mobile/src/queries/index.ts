import {
  ESCALATION_WINDOW_MIN,
  localDateOf,
  type AgendaResponse,
  type AlertEvent,
  type AssistantTurn,
  type CreateContactBody,
  type CreateElderBody,
  type CreateRoutineBody,
  type DoneBy,
  type Elder,
  type EventType,
  type LocalDate,
  type PatchContactBody,
  type PatchElderBody,
  type PatchMeBody,
  type PatchRoutineBody,
  type ResolveGeofenceBody,
} from '@aurelia/shared';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { useMe } from '@/auth/useMe';
import { api } from '@/lib/backend';
import { queryKeys } from '@/lib/query';

/** How often the caregiver's live views (agenda status, location) check the server while open. */
const LIVE_REFETCH_MS = 30_000;

/** Re-renders once a minute, so "today" and "in 5 min" stay right without anyone touching the screen. */
export function useNow(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

/**
 * The elder the caregiver screens are about. The caregiver layout only mounts these screens once
 * `GET /me` has returned at least one elder, so this is never null below it.
 */
export function useCurrentElder(): Elder {
  const { data } = useMe();
  const elder = data?.role === 'caregiver' ? data.elders[0] : undefined;
  if (!elder) throw new Error('useCurrentElder used before the caregiver has an elder');
  return elder;
}

/** The elder on an elder phone: `GET /me` for a paired phone returns exactly one. The elder layout mounts screens only once it has loaded. */
export function useElderSelf(): Elder {
  const { data } = useMe();
  if (data?.role !== 'elder') throw new Error('useElderSelf used outside a paired elder phone');
  return data.elder;
}

/** The elder's local calendar date, which moves on at the elder's midnight, not the phone's. */
export function useToday(elder: Elder): LocalDate {
  const now = useNow();
  return localDateOf(now, elder.timezone);
}

// ─── Reads ───────────────────────────────────────────────────────────────────

export function useElderDetail(elderId: string) {
  return useQuery({ queryKey: [...queryKeys.elder(elderId), 'detail'], queryFn: () => api.getElder(elderId) });
}

export function useRoutines(elderId: string) {
  return useQuery({ queryKey: queryKeys.routines(elderId), queryFn: () => api.listRoutines(elderId) });
}

export function useAgenda(elderId: string, date: LocalDate) {
  return useQuery({
    queryKey: queryKeys.agenda(elderId, date),
    queryFn: () => api.getAgenda(elderId, date),
    refetchInterval: LIVE_REFETCH_MS,
  });
}

export function useContacts(elderId: string) {
  return useQuery({ queryKey: queryKeys.contacts(elderId), queryFn: () => api.listContacts(elderId) });
}

export function useLocation(elderId: string) {
  return useQuery({
    queryKey: queryKeys.location(elderId),
    queryFn: () => api.getLocation(elderId),
    refetchInterval: LIVE_REFETCH_MS,
  });
}

export function useWeeklyReport(elderId: string, weekStart: LocalDate) {
  return useQuery({ queryKey: queryKeys.weeklyReport(elderId, weekStart), queryFn: () => api.getWeeklyReport(elderId, weekStart) });
}

/**
 * The most recent geofence exit, fetched only while the elder is outside. A caregiver confirming "she
 * is safe" resolves that event but cannot move the device's state, so the exit being resolved is what
 * tells the screens to stop shouting while the elder is still, correctly, reported as outside.
 */
export function useLatestExit(elderId: string, enabled: boolean) {
  return useQuery({
    queryKey: [...queryKeys.elder(elderId), 'latestExit'],
    queryFn: async () => {
      const page = await api.listEvents(elderId, { types: ['geofenceExit'], limit: 1 });
      const event = page.items[0];
      return event?.type === 'geofenceExit' ? event : null;
    },
    enabled,
    refetchInterval: LIVE_REFETCH_MS,
  });
}

/**
 * Whether an alert nobody answers will be texted to the emergency contacts, as far as this caregiver
 * can tell: they chose "me, then the contacts" and the elder has an emergency contact.
 */
export function useEscalatesToContacts(elderId: string): boolean {
  const { data } = useMe();
  const contacts = useContacts(elderId);
  const chosen = data?.role === 'caregiver' && data.caregiver.settings.escalation === 'meThenContacts';
  return chosen && (contacts.data?.items.some((contact) => contact.isEmergency) ?? false);
}

/**
 * The latest SOS from the last ESCALATION_WINDOW_MIN that no caregiver has answered yet, so Início
 * can lead back to it when the push was missed.
 */
export function useOpenSos(elderId: string): AlertEvent | null {
  const events = useEvents(elderId, { types: ['sos'] }, { live: true });
  const now = useNow();
  const latest = events.data?.pages[0]?.items[0];
  if (latest?.type !== 'sos' || latest.payload.acknowledgedAt) return null;
  return now.getTime() - Date.parse(latest.at) <= ESCALATION_WINDOW_MIN * 60_000 ? latest : null;
}

export interface EventsFilter {
  from?: LocalDate;
  to?: LocalDate;
  types?: EventType[];
}

/** `live` refetches every 30 s, for screens watching an alert someone else may answer meanwhile. */
export function useEvents(elderId: string, filter: EventsFilter, { live = false }: { live?: boolean } = {}) {
  return useInfiniteQuery({
    queryKey: queryKeys.events(elderId, filter),
    queryFn: ({ pageParam }) => api.listEvents(elderId, { ...filter, limit: 50, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    ...(live ? { refetchInterval: LIVE_REFETCH_MS } : {}),
  });
}

// ─── Writes ──────────────────────────────────────────────────────────────────

/** Everything the elder's screens show may have changed (routines → agenda → report), so refresh the lot. */
function refreshElder(client: QueryClient, elderId: string) {
  return client.invalidateQueries({ queryKey: queryKeys.elder(elderId) });
}

export function useCreateElder() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateElderBody) => api.createElder(body),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.me }),
  });
}

export function usePatchElder(elderId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: PatchElderBody) => api.patchElder(elderId, body),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: queryKeys.me });
      await refreshElder(client, elderId);
    },
  });
}

export function usePatchMe() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: PatchMeBody) => api.patchMe(body),
    onSuccess: (me) => client.setQueryData(queryKeys.me, me),
  });
}

export function useCreateRoutine(elderId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateRoutineBody) => api.createRoutine(elderId, body),
    onSuccess: () => refreshElder(client, elderId),
  });
}

export function usePatchRoutine(elderId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ routineId, body }: { routineId: string; body: PatchRoutineBody }) => api.patchRoutine(elderId, routineId, body),
    onSuccess: () => refreshElder(client, elderId),
  });
}

export function useDeleteRoutine(elderId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (routineId: string) => api.deleteRoutine(elderId, routineId),
    onSuccess: () => refreshElder(client, elderId),
  });
}

/**
 * Confirming or undoing a task is a cheap toggle, so the agenda updates at once and rolls back if the
 * server says no. The server's answer (and the events it adds) is fetched afterwards either way.
 */
function useAgendaToggle(
  elderId: string,
  date: LocalDate,
  request: (routineId: string) => Promise<unknown>,
  next: 'done' | 'undo',
  doneBy: DoneBy = 'caregiver',
) {
  const client = useQueryClient();
  const key = queryKeys.agenda(elderId, date);
  return useMutation({
    mutationFn: request,
    onMutate: async (routineId: string) => {
      await client.cancelQueries({ queryKey: key });
      const previous = client.getQueryData<AgendaResponse>(key);
      if (previous) {
        client.setQueryData<AgendaResponse>(key, {
          ...previous,
          items: previous.items.map((item) =>
            item.routineId !== routineId
              ? item
              : next === 'done'
                ? { ...item, status: 'done', doneAt: new Date().toISOString(), doneBy }
                : { ...item, status: 'pending', doneAt: null, doneBy: null },
          ),
        });
      }
      return { previous };
    },
    onError: (_error, _routineId, context) => {
      if (context?.previous) client.setQueryData(key, context.previous);
    },
    onSettled: () => refreshElder(client, elderId),
  });
}

export function useMarkDone(elderId: string, date: LocalDate, doneBy: DoneBy = 'caregiver') {
  return useAgendaToggle(elderId, date, (routineId) => api.markDone(elderId, date, routineId), 'done', doneBy);
}

export function useUndoDone(elderId: string, date: LocalDate) {
  return useAgendaToggle(elderId, date, (routineId) => api.undoDone(elderId, date, routineId), 'undo');
}

export function useCreateContact(elderId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateContactBody) => api.createContact(elderId, body),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.contacts(elderId) }),
  });
}

export function usePatchContact(elderId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ contactId, body }: { contactId: string; body: PatchContactBody }) => api.patchContact(elderId, contactId, body),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.contacts(elderId) }),
  });
}

export function useDeleteContact(elderId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (contactId: string) => api.deleteContact(elderId, contactId),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.contacts(elderId) }),
  });
}

export function useResolveGeofence(elderId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: ResolveGeofenceBody) => api.resolveGeofence(elderId, body),
    onSuccess: () => refreshElder(client, elderId),
  });
}

export function useAcknowledgeAlert(elderId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (eventId: string) => api.acknowledgeAlert(elderId, eventId),
    onSuccess: () => refreshElder(client, elderId),
  });
}

export function useIssuePairingCode(elderId: string) {
  return useMutation({ mutationFn: () => api.issuePairingCode(elderId) });
}

export function useUnpairElderPhone(elderId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => api.unpairElderPhone(elderId),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: queryKeys.me });
      await refreshElder(client, elderId);
    },
  });
}

export function useCreateDevice(elderId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (label: string) => api.createDevice(elderId, { label }),
    onSuccess: () => refreshElder(client, elderId),
  });
}

export function useDeleteDevice(elderId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (deviceId: string) => api.deleteDevice(elderId, deviceId),
    onSuccess: () => refreshElder(client, elderId),
  });
}

export function useAssistantMessage(elderId: string) {
  return useMutation({
    mutationFn: ({ message, history }: { message: string; history: AssistantTurn[] }) =>
      api.sendAssistantMessage(elderId, { message, history }),
  });
}
