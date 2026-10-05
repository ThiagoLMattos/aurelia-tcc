import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { api, authAdapter } from '@/lib/backend';
import type { AuthIdentity, AuthRole, AuthUser } from '@/lib/auth/adapter';
import { queryClient } from '@/lib/query';
import { unregisterPush } from '@/push/registerPush';

export type SessionStatus = 'loading' | 'signedOut' | 'signedIn';

export interface SessionValue {
  status: SessionStatus;
  role: AuthRole | null;
  /** The elder an elder phone belongs to; null for caregivers (they pick one from `me.elders`). */
  elderId: string | null;
  user: AuthUser | null;
  signInWithPassword(email: string, password: string): Promise<void>;
  signInWithCustomToken(token: string): Promise<void>;
  signOut(): Promise<void>;
  /** Emails a reset link; resolves whether or not the e-mail has an account. */
  sendPasswordReset(email: string): Promise<void>;
  /** Checks the password again, deletes the caregiver's account (DELETE /me), then signs out. */
  deleteAccount(password: string): Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

interface SessionState {
  status: SessionStatus;
  identity: AuthIdentity | null;
}

const sameIdentity = (a: AuthIdentity | null, b: AuthIdentity | null) =>
  a?.user.uid === b?.user.uid && a?.role === b?.role && a?.elderId === b?.elderId;

/**
 * Who is signed in, from the identity provider's token claims. The server decides the role; the app
 * only reads it. Whenever the identity goes away or changes hands, cached server data is dropped so
 * the next person never sees the previous one's data.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({ status: 'loading', identity: null });
  const identityRef = useRef<AuthIdentity | null>(null);

  useEffect(() => {
    return authAdapter.subscribe((incoming) => {
      // A signed-in user whose token has no known role cannot use either side of the app.
      const identity = incoming?.role ? incoming : null;
      const changed = !sameIdentity(identityRef.current, identity);
      if (changed) queryClient.clear();
      identityRef.current = identity;
      // Token refreshes re-emit the same identity; keep the state object (and its consumers) as is.
      setState((previous) =>
        previous.status !== 'loading' && !changed ? previous : { status: identity ? 'signedIn' : 'signedOut', identity },
      );
      if (incoming && !incoming.role) void authAdapter.signOut();
    });
  }, []);

  const signOut = useCallback(async () => {
    // The push token has to be removed while we can still authenticate the request.
    await unregisterPush(api).catch(() => {});
    await authAdapter.signOut();
    queryClient.clear();
  }, []);

  const deleteAccount = useCallback(async (password: string) => {
    await authAdapter.confirmPassword(password);
    // The push tokens go with the account, so there is nothing to unregister first.
    await api.deleteAccount();
    await authAdapter.signOut().catch(() => {});
    queryClient.clear();
  }, []);

  const value = useMemo<SessionValue>(
    () => ({
      status: state.status,
      role: state.identity?.role ?? null,
      elderId: state.identity?.elderId ?? null,
      user: state.identity?.user ?? null,
      signInWithPassword: (email, password) => authAdapter.signInWithPassword(email, password),
      signInWithCustomToken: (token) => authAdapter.signInWithCustomToken(token),
      signOut,
      sendPasswordReset: (email) => authAdapter.sendPasswordReset(email),
      deleteAccount,
    }),
    [state, signOut, deleteAccount],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside <SessionProvider>');
  return value;
}
