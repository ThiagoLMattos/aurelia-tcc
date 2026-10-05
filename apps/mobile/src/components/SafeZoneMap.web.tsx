import { MapFallback } from './MapFallback';
import type { SafeZoneMapProps } from './SafeZoneMap.types';

export type { SafeZoneMapProps } from './SafeZoneMap.types';

/** react-native-maps has no web version: the browser preview (mock mode) gets the text fallback. */
export function SafeZoneMap(props: SafeZoneMapProps) {
  return <MapFallback {...props} />;
}
