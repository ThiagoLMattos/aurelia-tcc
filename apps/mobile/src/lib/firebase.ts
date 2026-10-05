import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, getReactNativePersistence, initializeAuth, type Auth } from 'firebase/auth';
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
  return auth;
}
