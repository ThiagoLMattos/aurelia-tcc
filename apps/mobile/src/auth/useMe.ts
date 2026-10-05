import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/backend';
import { queryKeys } from '@/lib/query';

import { useSession } from './SessionProvider';

/** GET /me for whoever is signed in. Only runs while there is a session. */
export function useMe() {
  const { status } = useSession();
  return useQuery({ queryKey: queryKeys.me, queryFn: () => api.getMe(), enabled: status === 'signedIn' });
}

/**
 * The elder the current screens are about: an elder phone's own, or a caregiver's first elder.
 * (Switching between several elders is a caregiver-screen concern.)
 */
export function useCurrentElderId(): string | null {
  const { elderId } = useSession();
  const { data } = useMe();
  if (elderId) return elderId;
  return data?.role === 'caregiver' ? (data.elders[0]?.id ?? null) : null;
}
