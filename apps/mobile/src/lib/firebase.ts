import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, getReactNativePersistence, initializeAuth, type Auth } from 'firebase/auth';
import { Platform } from 'react-native';

import { env } from '@/config/env';

let auth: Auth | null = null;

/**
 * Firebase Auth only: the app never talks to Firestore, everything goes through the API. On native
 * the session is persisted in AsyncStorage so it survives closing the app; on web the SDK's own
 * browser persistence is used.
 */
export function getFirebaseAuth(): Auth {
  if (auth) return auth;
  const app = getApps().length > 0 ? getApp() : initializeApp(env.firebase);
  if (Platform.OS === 'web') {
    auth = getAuth(app);
  } else {
    try {
      auth = initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
    } catch {
      // Fast refresh runs this module again after Auth was already initialised.
      auth = getAuth(app);
    }
  }
  // Local development against `npm run emulators` (the API then runs with USE_EMULATORS=true).
  if (env.authEmulatorHost && !auth.emulatorConfig) {
    connectAuthEmulator(auth, `http://${env.authEmulatorHost}`, { disableWarnings: true });
  }
  return auth;
}
