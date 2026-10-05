import { haversineMeters } from '@aurelia/shared';
import { describe, expect, it } from 'vitest';

import { regionFor } from '@/lib/mapRegion';

const zone = { lat: -22.9068, lng: -43.1729, radiusM: 150 };

function contains(region: NonNullable<ReturnType<typeof regionFor>>, p: { lat: number; lng: number }): boolean {
  return (
    Math.abs(p.lat - region.latitude) <= region.latitudeDelta / 2 &&
    Math.abs(p.lng - region.longitude) <= region.longitudeDelta / 2
  );
}

describe('regionFor', () => {
  it('has nothing to show without a zone or a position', () => {
    expect(regionFor(null, null)).toBeNull();
  });

  it('centres on the zone and fits its whole circle', () => {
    const region = regionFor(zone, null)!;
    expect(region.latitude).toBeCloseTo(zone.lat, 6);
    expect(region.longitude).toBeCloseTo(zone.lng, 6);
    const north = { lat: zone.lat + 150 / 111_320, lng: zone.lng };
    const east = { lat: zone.lat, lng: zone.lng + 150 / (111_320 * Math.cos((zone.lat * Math.PI) / 180)) };
    expect(haversineMeters(north, zone)).toBeCloseTo(150, 0);
    expect(contains(region, north)).toBe(true);
    expect(contains(region, east)).toBe(true);
  });

  it('keeps a position far outside the zone on screen together with the circle', () => {
    const away = { lat: zone.lat + 0.01, lng: zone.lng - 0.01 };
    const region = regionFor(zone, away)!;
    expect(contains(region, away)).toBe(true);
    expect(contains(region, zone)).toBe(true);
  });

  it('does not zoom in further than a few streets on a lone position', () => {
    const region = regionFor(null, { lat: zone.lat, lng: zone.lng })!;
    expect(region.latitudeDelta * 111_320).toBeGreaterThanOrEqual(249);
  });
});
