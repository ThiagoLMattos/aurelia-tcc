export type AuthRole = 'caregiver' | 'elder';

export interface AuthUser {
  uid: string;
  email: string | null;
  name: string | null;
}

/** Who is signed in, as read from the ID token's custom claims. */
export interface AuthIdentity {
  user: AuthUser;
  /** Null when the token carries no (known) role: the session treats it as signed out. */
  role: AuthRole | null;
  elderId: string | null;
}

/**
 * What the app needs from an identity provider. Firebase Auth implements it in `api` mode and the
 * in-memory mock in `mock` mode, so the session code is the same in both.
 */
export interface AuthAdapter {
  /** Calls back once with the restored identity (or null), then on every sign-in/out. */
  subscribe(listener: (identity: AuthIdentity | null) => void): () => void;
  signInWithPassword(email: string, password: string): Promise<void>;
  signInWithCustomToken(token: string): Promise<void>;
  signOut(): Promise<void>;
  /** A valid ID token, refreshed when it is about to expire; null when signed out. */
  getIdToken(forceRefresh?: boolean): Promise<string | null>;
}
