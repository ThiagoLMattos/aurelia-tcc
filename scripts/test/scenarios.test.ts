import { GEOFENCE_HYSTERESIS_M, haversineMeters, nextLocationState, type LocationState, type SafeZone } from '@aurelia/shared';
import { describe, expect, it } from 'vitest';

import { offset, scenario, type ScenarioName } from '../scenarios';

const zone: SafeZone = { lat: -22.9056, lng: -47.0608, radiusM: 100 };
const unknown: LocationState = {
  status: 'unknown',
  since: null,
  lastLat: null,
  lastLng: null,
  lastAt: null,
  consecutiveOutside: 0,
  consecutiveInside: 0,
};

/** Runs the API's own state machine over the readings and returns the transitions it would emit. */
function transitionsOf(name: ScenarioName, take: number, seed = 1): string[] {
  const out: string[] = [];
  let state = unknown;
  let i = 0;
  for (const reading of scenario(name, { center: zone, radiusM: zone.radiusM, seed })) {
    if (i++ >= take) break;
    const next = nextLocationState(state, reading, new Date(Date.UTC(2026, 0, 1, 12, 0, i * 12)), zone);
    if (next.transition) out.push(next.transition);
    state = next.state;
  }
  return out;
}

describe('offset', () => {
  it('lands the requested distance away', () => {
    expect(haversineMeters(zone, offset(zone, 100, 0))).toBeCloseTo(100, 1);
    expect(haversineMeters(zone, offset(zone, 30, 40))).toBeCloseTo(50, 1);
  });
});

describe('scenarios', () => {
  it('walk-out-and-back emits exactly one exit then one return, then ends', () => {
    expect(transitionsOf('walk-out-and-back', 1000)).toEqual(['exit', 'return']);
    expect([...scenario('walk-out-and-back', { center: zone, radiusM: zone.radiusM })].length).toBeLessThan(100);
  });

  it('walk-out-and-back is repeatable for other radii', () => {
    for (const radiusM of [30, 50, 250, 1000]) {
      const z = { ...zone, radiusM };
      let state = unknown;
      const out: string[] = [];
      for (const reading of scenario('walk-out-and-back', { center: z, radiusM })) {
        const next = nextLocationState(state, reading, new Date(), z);
        if (next.transition) out.push(next.transition);
        state = next.state;
      }
      expect(out, `radius ${radiusM}`).toEqual(['exit', 'return']);
    }
  });

  it('stay-inside never leaves the fence', () => {
    expect(transitionsOf('stay-inside', 200)).toEqual([]);
    let i = 0;
    for (const p of scenario('stay-inside', { center: zone, radiusM: zone.radiusM })) {
      if (i++ >= 200) break;
      expect(haversineMeters(zone, p)).toBeLessThan(zone.radiusM - GEOFENCE_HYSTERESIS_M);
    }
  });

  it('wander is repeatable for a seed and differs between seeds', () => {
    const take = (seed: number) => {
      const out = [];
      for (const p of scenario('wander', { center: zone, radiusM: zone.radiusM, seed })) {
        if (out.length >= 20) break;
        out.push(p);
      }
      return out;
    };
    expect(take(7)).toEqual(take(7));
    expect(take(7)).not.toEqual(take(8));
  });
});
