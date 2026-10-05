import { env } from '@/config/env';

import { createApiClient } from './api/client';
import { createEndpoints } from './api/endpoints';
import { createMockBackend } from './api/mock';
import type { Api } from './api/types';
import type { AuthAdapter } from './auth/adapter';
import { createFirebaseAuthAdapter } from './auth/firebaseAdapter';

interface Backend {
  api: Api;
  auth: AuthAdapter;
}

function createBackend(): Backend {
  if (env.apiMode === 'mock') return createMockBackend();
  const auth = createFirebaseAuthAdapter();
  const client = createApiClient({ baseUrl: env.apiUrl, getToken: (forceRefresh) => auth.getIdToken(forceRefresh) });
  return { api: createEndpoints(client), auth };
}

/** The one place that decides between the real API + Firebase Auth and the in-memory mock. */
const backend = createBackend();

export const api: Api = backend.api;
export const authAdapter: AuthAdapter = backend.auth;
