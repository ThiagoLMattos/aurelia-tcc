import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

import { parseServiceAccount, type Config } from './config';

export interface Firebase {
  db: Firestore;
  auth: Auth;
}

/**
 * Initializes firebase-admin once per process. With USE_EMULATORS=true it talks to the local
 * Auth/Firestore emulators and needs no credentials; otherwise it uses the key in
 * FIREBASE_SERVICE_ACCOUNT (Render), or Application Default Credentials (Cloud Run,
 * GOOGLE_APPLICATION_CREDENTIALS).
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
      ...(config.USE_EMULATORS ? {} : { credential: credentialFor(config) }),
    });

  return { db: getFirestore(app), auth: getAuth(app) };
}

/** loadConfig has already checked FIREBASE_SERVICE_ACCOUNT, so a key that fails to parse here is a bug. */
function credentialFor(config: Config) {
  if (!config.FIREBASE_SERVICE_ACCOUNT) return applicationDefault();
  const key = parseServiceAccount(config.FIREBASE_SERVICE_ACCOUNT);
  if (!key) throw new Error('FIREBASE_SERVICE_ACCOUNT is not a service account key');
  return cert(key);
}
