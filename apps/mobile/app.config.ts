import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * `app.json` holds the static config; this adds what comes from the environment. The EAS project id
 * is what `eas build` and push tokens are tied to, and it is not committed.
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const projectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
  return {
    ...config,
    name: config.name ?? 'Aurelia',
    slug: config.slug ?? 'Aurelia',
    extra: {
      ...config.extra,
      ...(projectId ? { eas: { projectId } } : {}),
    },
  };
};
