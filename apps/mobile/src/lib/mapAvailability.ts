export interface MapEnvironment {
  os: string;
  /** `Constants.executionEnvironment`: 'storeClient' in Expo Go, 'standalone' or 'bare' in a build. */
  executionEnvironment: string | undefined;
  /** The build's Google Maps key (`android.config.googleMaps.apiKey`), when it has one. */
  androidMapsKey: string | undefined;
}

/**
 * Whether react-native-maps can draw a map here. iOS uses Apple Maps (no key); on Android Google Maps
 * needs a key, which needs a billed Google Cloud project. Expo Go brings its own key; a build only has
 * one when GOOGLE_MAPS_API_KEY was set. Without it the screens show `MapFallback` instead of a blank map.
 */
export function canShowNativeMap({ os, executionEnvironment, androidMapsKey }: MapEnvironment): boolean {
  if (os !== 'android') return true;
  return executionEnvironment === 'storeClient' || Boolean(androidMapsKey);
}
