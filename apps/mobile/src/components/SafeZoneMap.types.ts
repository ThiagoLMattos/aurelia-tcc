import type { LocationStatus, SafeZone } from '@aurelia/shared';
import type { StyleProp, ViewStyle } from 'react-native';

import type { LatLng } from '@/lib/mapRegion';

export interface SafeZoneMapProps {
  /** The safe-zone circle, when one is set. */
  zone: SafeZone | null;
  /** The elder's last known position, when the tracker has reported one. */
  position: LatLng | null;
  /** Colours the elder's pin: green inside, red outside, grey when unknown. */
  status: LocationStatus;
  /** Name on the elder's pin. */
  elderName: string;
  height?: number;
  /** When set, tapping the map reports the tapped point (used to move the zone's centre). */
  onPressCoordinate?: (point: LatLng) => void;
  style?: StyleProp<ViewStyle>;
}
