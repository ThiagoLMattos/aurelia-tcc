import { env } from '@/config/env';

import { createApiClient } from './api/client';
import { createEndpoints } from './api/endpoints';
import { createMockBackend, type MockControls } from './api/mock';
import type { Api } from './api/types';
import type { AuthAdapter } from './auth/adapter';
import { createFirebaseAuthAdapter } from './auth/firebaseAdapter';

interface Backend {
  api: Api;
  auth: AuthAdapter;
  mockControls: MockControls | null;
}

function createBackend(): Backend {
  if (env.apiMode === 'mock') {
    const { api, auth, controls } = createMockBackend();
    return { api, auth, mockControls: controls };
  }
  const auth = createFirebaseAuthAdapter();
  const client = createApiClient({ baseUrl: env.apiUrl, getToken: (forceRefresh) => auth.getIdToken(forceRefresh) });
  return { api: createEndpoints(client), auth, mockControls: null };
}

/** The one place that decides between the real API + Firebase Auth and the in-memory mock. */
const backend = createBackend();

export const api: Api = backend.api;
export const authAdapter: AuthAdapter = backend.auth;

/** Buttons to trigger an exit / a missed task by hand; only exists in mock mode. */
export const mockControls: MockControls | null = backend.mockControls;
