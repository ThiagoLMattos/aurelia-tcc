import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

import type { Config } from './config';

export interface Firebase {
  db: Firestore;
  auth: Auth;
}

/**
 * Initializes firebase-admin once per process. With USE_EMULATORS=true it talks to the local
 * Auth/Firestore emulators and needs no credentials; otherwise it uses Application Default
 * Credentials (GOOGLE_APPLICATION_CREDENTIALS).
 */
export function initFirebase(config: Config): Firebase {
  if (config.USE_EMULATORS) {
    process.env.FIRESTORE_EMULATOR_HOST = config.FIRESTORE_EMULATOR_HOST;
    process.env.FIREBASE_AUTH_EMULATOR_HOST = config.FIREBASE_AUTH_EMULATOR_HOST;
  }

  const app =
    getApps()[0] ??
    initializeApp({
      projectId: config.FIREBASE_PROJECT_ID,
      ...(config.USE_EMULATORS ? {} : { credential: applicationDefault() }),
    });

  return { db: getFirestore(app), auth: getAuth(app) };
}
