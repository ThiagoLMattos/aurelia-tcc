import type { SafeZone } from '@aurelia/shared';

export interface LatLng {
  lat: number;
  lng: number;
}

/** What a map shows: its centre and how many degrees of latitude/longitude fit on screen. */
export interface MapRegion {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

const METERS_PER_DEGREE_LAT = 111_320;
/** Room around what must be visible, so the circle and the pins don't touch the edges. */
const PADDING = 1.6;
/**
 * Pins stand above their coordinate, so the view is moved north by this share of its height: a pin at
 * the top of the box still shows whole.
 */
const PIN_HEADROOM = 0.08;
/** Closest zoom: about 250 m across, enough to read the streets around one point. */
const MIN_SPAN_M = 250;

function metersToLatDegrees(m: number): number {
  return m / METERS_PER_DEGREE_LAT;
}

function metersToLngDegrees(m: number, atLat: number): number {
  return m / (METERS_PER_DEGREE_LAT * Math.max(Math.cos((atLat * Math.PI) / 180), 0.01));
}

/**
 * The region that shows the whole safe-zone circle and the elder's last position together. With only
 * one of them, it is centred on that one; with neither there is nothing to show (null).
 */
export function regionFor(zone: SafeZone | null, position: LatLng | null): MapRegion | null {
  const points: LatLng[] = [];
  if (zone) {
    const dLat = metersToLatDegrees(zone.radiusM);
    const dLng = metersToLngDegrees(zone.radiusM, zone.lat);
    points.push({ lat: zone.lat - dLat, lng: zone.lng - dLng }, { lat: zone.lat + dLat, lng: zone.lng + dLng });
  }
  if (position) points.push(position);
  if (points.length === 0) return null;

  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const latitude = (minLat + maxLat) / 2;
  const longitude = (minLng + maxLng) / 2;

  const latitudeDelta = Math.max((maxLat - minLat) * PADDING, metersToLatDegrees(MIN_SPAN_M));
  return {
    latitude: latitude + latitudeDelta * PIN_HEADROOM,
    longitude,
    latitudeDelta,
    longitudeDelta: Math.max((maxLng - minLng) * PADDING, metersToLngDegrees(MIN_SPAN_M, latitude)),
  };
}
