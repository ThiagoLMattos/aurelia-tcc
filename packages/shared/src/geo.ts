import { GEOFENCE_CONFIRM_READINGS, GEOFENCE_HYSTERESIS_M } from './constants';
import type { LocationState, SafeZone } from './elder';
import type { LatLng } from './primitives';

const EARTH_RADIUS_M = 6_371_008.8;

const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance between two points, in metres. */
export function haversineMeters(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export type LocationTransition = 'exit' | 'return' | null;

export interface NextLocationStateResult {
  state: LocationState;
  /** `exit` → event `geofenceExit`; `return` → event `geofenceReturn`. */
  transition: LocationTransition;
  distanceM: number | null;
}

/**
 * Geofence state machine (spec §4).
 *
 * A reading is *outside* if distance > radius + 15 m, *inside* if distance < radius − 15 m, and
 * *ambiguous* in between. Ambiguous readings update the last position but leave both counters
 * untouched. The status only changes after 2 consecutive agreeing readings; a reading on the
 * other side resets the opposite counter. unknown → outside counts as an `exit`, unknown → inside
 * emits no transition.
 */
export function nextLocationState(
  prev: LocationState,
  reading: LatLng,
  at: Date,
  safeZone: SafeZone | null,
): NextLocationStateResult {
  const atIso = at.toISOString();
  const withPosition: LocationState = { ...prev, lastLat: reading.lat, lastLng: reading.lng, lastAt: atIso };
  if (!safeZone) return { state: withPosition, transition: null, distanceM: null };

  const distanceM = haversineMeters(reading, safeZone);
  const state = { ...withPosition };

  if (distanceM > safeZone.radiusM + GEOFENCE_HYSTERESIS_M) {
    state.consecutiveOutside = prev.consecutiveOutside + 1;
    state.consecutiveInside = 0;
  } else if (distanceM < safeZone.radiusM - GEOFENCE_HYSTERESIS_M) {
    state.consecutiveInside = prev.consecutiveInside + 1;
    state.consecutiveOutside = 0;
  } else {
    return { state, transition: null, distanceM };
  }

  if (state.consecutiveOutside >= GEOFENCE_CONFIRM_READINGS && prev.status !== 'outside') {
    state.status = 'outside';
    state.since = atIso;
    return { state, transition: 'exit', distanceM };
  }
  if (state.consecutiveInside >= GEOFENCE_CONFIRM_READINGS && prev.status !== 'inside') {
    state.status = 'inside';
    state.since = atIso;
    return { state, transition: prev.status === 'outside' ? 'return' : null, distanceM };
  }
  return { state, transition: null, distanceM };
}
