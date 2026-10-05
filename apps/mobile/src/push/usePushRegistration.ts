import { useEffect } from 'react';

import { useSession } from '@/auth/SessionProvider';
import { api } from '@/lib/backend';

import { registerPush } from './registerPush';

/** Registers this phone for push as soon as someone is signed in (and again for the next person). */
export function usePushRegistration(): void {
  const { status, user } = useSession();
  const uid = user?.uid ?? null;

  useEffect(() => {
    if (status !== 'signedIn') return;
    void registerPush(api);
  }, [status, uid]);
}
