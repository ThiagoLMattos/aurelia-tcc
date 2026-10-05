import type { EventsParams } from '@/lib/api/types';
import { focusManager, QueryClient } from '@tanstack/react-query';
import { AppState, Platform } from 'react-native';

import { ApiError } from '@/lib/api/client';

/** Client errors (4xx) will not fix themselves on a retry; network trouble and 5xx might. */
function shouldRetry(failureCount: number, error: unknown): boolean {
  if (failureCount >= 2) return false;
  if (error instanceof ApiError && error.status !== null && error.status < 500) return false;
  return true;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: shouldRetry },
  },
});

/**
 * TanStack Query learns about "the app came back to the foreground" from `AppState`; on web it keeps
 * its own visibilitychange listener. Call once at start-up.
 */
export function setupFocusManager(): () => void {
  if (Platform.OS === 'web') return () => {};
  const subscription = AppState.addEventListener('change', (state) => focusManager.setFocused(state === 'active'));
  return () => subscription.remove();
}

/** Query keys in one place, so invalidating "everything about this elder" is one prefix. */
export const queryKeys = {
  me: ['me'] as const,
  elder: (elderId: string) => ['elder', elderId] as const,
  routines: (elderId: string) => ['elder', elderId, 'routines'] as const,
  agenda: (elderId: string, date: string) => ['elder', elderId, 'agenda', date] as const,
  contacts: (elderId: string) => ['elder', elderId, 'contacts'] as const,
  events: (elderId: string, params?: Omit<EventsParams, 'cursor'>) => ['elder', elderId, 'events', params ?? {}] as const,
  weeklyReport: (elderId: string, weekStart: string) => ['elder', elderId, 'weeklyReport', weekStart] as const,
  location: (elderId: string) => ['elder', elderId, 'location'] as const,
};
