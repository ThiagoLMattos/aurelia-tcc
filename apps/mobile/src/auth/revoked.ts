import { useSyncExternalStore } from 'react';

import { ApiError } from '@/lib/api/client';

/**
 * Set when the API says the signed-in phone is no longer allowed in (the caregiver unpaired it, or the
 * token was revoked). The elder screens then ask for a new pairing code instead of showing errors.
 */
let revoked = false;
const listeners = new Set<() => void>();

function set(value: boolean) {
  if (revoked === value) return;
  revoked = value;
  listeners.forEach((listener) => listener());
}

export function noteIfRevoked(error: unknown): void {
  if (error instanceof ApiError && error.code === 'UNAUTHENTICATED') set(true);
}

export function clearRevoked(): void {
  set(false);
}

export function useRevoked(): boolean {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => revoked,
  );
}
