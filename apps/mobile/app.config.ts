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
 * `app.json` holds the static config; this adds what comes from the environment. The EAS project id
 * is what `eas build` and push tokens are tied to, and it is not committed.
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const projectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
  const servicesFile = googleServicesFile();
  return {
    ...config,
    name: config.name ?? 'Aurelia',
    slug: config.slug ?? 'Aurelia',
    android: {
      ...config.android,
      ...(servicesFile ? { googleServicesFile: servicesFile } : {}),
    },
    extra: {
      ...config.extra,
      ...(projectId ? { eas: { projectId } } : {}),
    },
  };
};
