import { GEOFENCE_HYSTERESIS_M, type LatLng } from '@aurelia/shared';

export type ScenarioName = 'stay-inside' | 'walk-out-and-back' | 'wander';
export const SCENARIOS: readonly ScenarioName[] = ['stay-inside', 'walk-out-and-back', 'wander'];

/** Metres per degree of latitude on the sphere the API's haversine uses. */
const M_PER_DEG_LAT = (Math.PI / 180) * 6_371_008.8;

/** The point `northM` metres north and `eastM` metres east of `from` (good to centimetres at these distances). */
export function offset(from: LatLng, northM: number, eastM: number): LatLng {
  return {
    lat: from.lat + northM / M_PER_DEG_LAT,
    lng: from.lng + eastM / (M_PER_DEG_LAT * Math.cos((from.lat * Math.PI) / 180)),
  };
}

/** Small, seedable PRNG so a run can be repeated exactly. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface ScenarioOptions {
  center: LatLng;
  radiusM: number;
  seed?: number;
}

/**
 * The positions a tracker reports, one per interval. `stay-inside` and `wander` never end;
 * `walk-out-and-back` ends once the walker is home again.
 */
export function* scenario(name: ScenarioName, { center, radiusM, seed = 1 }: ScenarioOptions): Generator<LatLng> {
  const rand = mulberry32(seed);
  // A fix is never exact: a few metres of noise sideways, which never changes which side of the fence it is on.
  const jitter = () => (rand() - 0.5) * 6;

  if (name === 'stay-inside') {
    while (true) yield offset(center, (rand() - 0.5) * radiusM * 0.8 + jitter(), (rand() - 0.5) * radiusM * 0.8 + jitter());
  }

  if (name === 'wander') {
    let north = 0;
    let east = 0;
    // Slow random walk that is pulled back once it strays past 1.5× the radius, so it keeps crossing the fence.
    while (true) {
      north += (rand() - 0.5) * 24;
      east += (rand() - 0.5) * 24;
      const dist = Math.hypot(north, east);
      if (dist > radiusM * 1.5) {
        north *= 0.9;
        east *= 0.9;
      }
      yield offset(center, north, east);
    }
  }

  // walk-out-and-back: straight north line, so the distance only ever rises and then falls and the
  // readings cannot flap across the hysteresis band. Ends well beyond radius + hysteresis, and back well inside.
  const home = radiusM * 0.3;
  const far = radiusM + GEOFENCE_HYSTERESIS_M + 45;
  const step = Math.max(10, radiusM / 8);
  const along = (northM: number) => offset(center, northM, jitter());
  for (let i = 0; i < 3; i++) yield along(home);
  for (let d = home + step; d < far; d += step) yield along(d);
  for (let i = 0; i < 3; i++) yield along(far);
  for (let d = far - step; d > home; d -= step) yield along(d);
  for (let i = 0; i < 3; i++) yield along(home);
}
