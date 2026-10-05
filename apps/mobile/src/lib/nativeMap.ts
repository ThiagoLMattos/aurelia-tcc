import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { canShowNativeMap } from './mapAvailability';

/** Whether this device and build can draw the native map (see `canShowNativeMap`). */
export const nativeMapAvailable = canShowNativeMap({
  os: Platform.OS,
  executionEnvironment: Constants.executionEnvironment,
  androidMapsKey: (Constants.expoConfig?.android?.config as { googleMaps?: { apiKey?: string } } | undefined)?.googleMaps?.apiKey,
});
