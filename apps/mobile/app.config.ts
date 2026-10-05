import { existsSync } from 'node:fs';
import { join } from 'node:path';

import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Android push (FCM) needs the Firebase Android app's `google-services.json` in the build. It is not
 * committed: EAS builds get it from the `GOOGLE_SERVICES_JSON` file variable (EAS sets it to the
 * file's path), and a local build uses `apps/mobile/google-services.json` when that file exists.
 * Without either the app still builds; only Android push is missing.
 */
function googleServicesFile(): string | undefined {
  if (process.env.GOOGLE_SERVICES_JSON) return process.env.GOOGLE_SERVICES_JSON;
  const local = './google-services.json';
  return existsSync(join(__dirname, local)) ? local : undefined;
}

/**
 * The caregiver's map uses Google Maps on Android. Expo Go brings its own key; a build needs
 * `GOOGLE_MAPS_API_KEY` (an EAS environment variable), or the map stays blank on Android.
 * iOS uses Apple Maps and needs no key.
 */
function googleMapsConfig(): { googleMaps: { apiKey: string } } | undefined {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  return apiKey ? { googleMaps: { apiKey } } : undefined;
}

/**
 * `app.json` holds the static config; this adds what comes from the environment. The EAS project id
 * is what `eas build` and push tokens are tied to, and it is not committed.
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const projectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
  const servicesFile = googleServicesFile();
  const maps = googleMapsConfig();
  return {
    ...config,
    name: config.name ?? 'Aurelia',
    slug: config.slug ?? 'Aurelia',
    android: {
      ...config.android,
      ...(servicesFile ? { googleServicesFile: servicesFile } : {}),
      ...(maps ? { config: { ...config.android?.config, ...maps } } : {}),
    },
    extra: {
      ...config.extra,
      ...(projectId ? { eas: { projectId } } : {}),
    },
  };
};
