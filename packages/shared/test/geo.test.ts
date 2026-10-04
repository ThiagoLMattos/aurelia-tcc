import { describe, expect, it } from 'vitest';

import { haversineMeters, INITIAL_LOCATION_STATE, nextLocationState } from '../src';
import type { LocationState, SafeZone } from '../src';

const ZONE: SafeZone = { lat: -23.55, lng: -46.63, radiusM: 100 };
/** Roughly `m` metres north of the zone centre (1° lat ≈ 111 195 m). */
const north = (m: number) => ({ lat: ZONE.lat + m / 111_195, lng: ZONE.lng });
const T = (n: number) => new Date(Date.UTC(2024, 0, 3, 12, n));

function feed(readings: number[], start: LocationState = INITIAL_LOCATION_STATE) {
  let state = start;
  const transitions: (string | null)[] = [];
  readings.forEach((m, i) => {
    const result = nextLocationState(state, north(m), T(i), ZONE);
    state = result.state;
    transitions.push(result.transition);
  });
  return { state, transitions };
}

describe('haversineMeters', () => {
  it('is 0 for identical points and ~111 km per degree of latitude', () => {
    expect(haversineMeters({ lat: 1, lng: 2 }, { lat: 1, lng: 2 })).toBe(0);
    expect(haversineMeters({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })).toBeCloseTo(111_195, -2);
  });
  it('is symmetric', () => {
    const a = { lat: -23.55, lng: -46.63 };
    const b = { lat: -22.9, lng: -43.17 };
    expect(haversineMeters(a, b)).toBeCloseTo(haversineMeters(b, a), 6);
    expect(haversineMeters(a, b)).toBeGreaterThan(350_000);
  });
});

describe('nextLocationState', () => {
  it('needs 2 consecutive readings to leave unknown', () => {
    const first = nextLocationState(INITIAL_LOCATION_STATE, north(10), T(0), ZONE);
    expect(first.state.status).toBe('unknown');
    expect(first.state.consecutiveInside).toBe(1);
    const second = nextLocationState(first.state, north(10), T(1), ZONE);
    expect(second.state.status).toBe('inside');
    expect(second.transition).toBeNull(); // unknown → inside is silent
    expect(second.state.since).toBe(T(1).toISOString());
  });

  it('unknown → outside emits an exit after 2 readings', () => {
    expect(feed([300, 300]).transitions).toEqual([null, 'exit']);
  });

  it('inside → outside emits exactly one exit, outside → inside one return', () => {
    const inside = feed([10, 10]).state;
    const out = feed([200, 200, 200, 200], inside);
    expect(out.transitions).toEqual([null, 'exit', null, null]);
    expect(out.state.status).toBe('outside');
    const back = feed([10, 10, 10], out.state);
    expect(back.transitions).toEqual([null, 'return', null]);
    expect(back.state.status).toBe('inside');
  });

  it('a single outlier does not flip the status and resets the counter', () => {
    const inside = feed([10, 10]).state;
    const { state, transitions } = feed([200, 10, 200], inside);
    expect(transitions).toEqual([null, null, null]);
    expect(state.status).toBe('inside');
    expect(state.consecutiveOutside).toBe(1);
  });

  it('hysteresis band: 85–115 m from centre (radius 100) counts for neither side', () => {
    const inside = feed([10, 10]).state;
    const band = feed([116, 116, 116, 90, 90], inside); // 116 > 115 → outside; 90 is in the band
    expect(band.transitions).toEqual([null, 'exit', null, null, null]);
    const stillInside = feed([114, 114, 114, 114], inside); // 114 ≤ 115 → ambiguous
    expect(stillInside.transitions).toEqual([null, null, null, null]);
    expect(stillInside.state.status).toBe('inside');
    expect(stillInside.state.consecutiveOutside).toBe(0);
    const outside = feed([200, 200]).state;
    const noReturn = feed([90, 90, 90], outside); // 90 > 85 → ambiguous
    expect(noReturn.state.status).toBe('outside');
  });

  it('ambiguous readings keep the counters but update the last position', () => {
    const one = nextLocationState(INITIAL_LOCATION_STATE, north(300), T(0), ZONE);
    const mid = nextLocationState(one.state, north(100), T(1), ZONE);
    expect(mid.state.consecutiveOutside).toBe(1);
    expect(mid.state.lastAt).toBe(T(1).toISOString());
    expect(mid.distanceM).toBeCloseTo(100, 0);
    const confirm = nextLocationState(mid.state, north(300), T(2), ZONE);
    expect(confirm.transition).toBe('exit');
  });

  it('without a safe zone only the last position is stored', () => {
    const result = nextLocationState(INITIAL_LOCATION_STATE, { lat: 1, lng: 2 }, T(0), null);
    expect(result).toMatchObject({ transition: null, distanceM: null });
    expect(result.state).toMatchObject({ status: 'unknown', lastLat: 1, lastLng: 2 });
  });

  it('does not mutate the previous state', () => {
    const prev = { ...INITIAL_LOCATION_STATE };
    nextLocationState(prev, north(300), T(0), ZONE);
    expect(prev).toEqual(INITIAL_LOCATION_STATE);
  });
});
