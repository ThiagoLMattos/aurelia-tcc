import * as Location from 'expo-location';
import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';

import { api } from '@/lib/backend';

import { createSosSender, type SosStatus } from './sos';

/** How long we wait for a position before sending the SOS without one. */
const LOCATION_BUDGET_MS = 4_000;

/** Best-effort position: the last known fix first (instant), a fresh one if it arrives in time, else null. */
async function findPosition(): Promise<{ lat: number; lng: number } | null> {
  if (Platform.OS === 'web') return null;
  const lookup = (async () => {
    const permission = await Location.getForegroundPermissionsAsync();
    const granted = permission.granted || (permission.canAskAgain && (await Location.requestForegroundPermissionsAsync()).granted);
    if (!granted) return null;
    const last = await Location.getLastKnownPositionAsync();
    if (last) return { lat: last.coords.latitude, lng: last.coords.longitude };
    const fresh = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return { lat: fresh.coords.latitude, lng: fresh.coords.longitude };
  })().catch(() => null);
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), LOCATION_BUDGET_MS));
  return Promise.race([lookup, timeout]);
}

let status: SosStatus = 'idle';
let elderIdInUse = '';
const listeners = new Set<() => void>();
const setStatus = (next: SosStatus) => {
  status = next;
  listeners.forEach((listener) => listener());
};

const sender = createSosSender({ send: (body) => api.sendSos(elderIdInUse, body) });
sender.subscribe(() => {
  if (sender.getStatus() !== 'idle') setStatus(sender.getStatus());
});

/**
 * Raises the alarm: looks for a position for a few seconds, then POST /sos, retried until it gets
 * through. Returns at once, so the screen can offer the phone call without waiting for any of it.
 */
export function raiseSos(elderId: string): void {
  elderIdInUse = elderId;
  setStatus('sending');
  void findPosition().then((position) => sender.start(position ?? {}));
}

export function useSosStatus(): SosStatus {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => status,
  );
}
