import { onIdTokenChanged, signInWithCustomToken, signInWithEmailAndPassword, signOut, type IdTokenResult } from 'firebase/auth';

import { getFirebaseAuth } from '@/lib/firebase';

import type { AuthAdapter, AuthIdentity, AuthRole } from './adapter';

function toRole(value: unknown): AuthRole | null {
  return value === 'caregiver' || value === 'elder' ? value : null;
}

function toIdentity(user: { uid: string; email: string | null; displayName: string | null }, token: IdTokenResult): AuthIdentity {
  const role = toRole(token.claims.role);
  const elderId = typeof token.claims.elderId === 'string' ? token.claims.elderId : null;
  return { user: { uid: user.uid, email: user.email, name: user.displayName }, role, elderId };
}

export function createFirebaseAuthAdapter(): AuthAdapter {
  return {
    subscribe(listener) {
      return onIdTokenChanged(getFirebaseAuth(), async (user) => {
        if (!user) return listener(null);
        try {
          listener(toIdentity(user, await user.getIdTokenResult()));
        } catch {
          listener(null);
        }
      });
    },
    async signInWithPassword(email, password) {
      await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
    },
    async signInWithCustomToken(token) {
      await signInWithCustomToken(getFirebaseAuth(), token);
    },
    signOut: () => signOut(getFirebaseAuth()),
    async getIdToken(forceRefresh = false) {
      const user = getFirebaseAuth().currentUser;
      return user ? user.getIdToken(forceRefresh) : null;
    },
  };
}
