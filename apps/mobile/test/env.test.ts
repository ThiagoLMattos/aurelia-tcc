import { describe, expect, it } from 'vitest';

import { parseEnv } from '@/config/env';

const firebase = {
  EXPO_PUBLIC_FIREBASE_API_KEY: 'key',
  EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: 'demo.firebaseapp.com',
  EXPO_PUBLIC_FIREBASE_PROJECT_ID: 'demo',
  EXPO_PUBLIC_FIREBASE_APP_ID: 'app',
};

describe('parseEnv', () => {
  it('defaults to api mode and then requires the API URL and the Firebase config', () => {
    expect(() => parseEnv({})).toThrowError(/EXPO_PUBLIC_API_URL/);
    expect(() => parseEnv({})).toThrowError(/EXPO_PUBLIC_FIREBASE_API_KEY/);
    expect(() => parseEnv({})).toThrowError(/EXPO_PUBLIC_API_MODE=mock/);
  });

  it('treats empty values as missing', () => {
    expect(() => parseEnv({ EXPO_PUBLIC_API_URL: '', ...firebase })).toThrowError(/EXPO_PUBLIC_API_URL/);
  });

  it('reads a complete api configuration and trims the trailing slash from the URL', () => {
    const env = parseEnv({ EXPO_PUBLIC_API_URL: 'http://192.168.0.10:3000/api/v1/', EXPO_PUBLIC_EAS_PROJECT_ID: 'eas-id', ...firebase });
    expect(env.apiMode).toBe('api');
    expect(env.apiUrl).toBe('http://192.168.0.10:3000/api/v1');
    expect(env.firebase).toEqual({ apiKey: 'key', authDomain: 'demo.firebaseapp.com', projectId: 'demo', appId: 'app' });
    expect(env.easProjectId).toBe('eas-id');
  });

  it('needs nothing in mock mode', () => {
    const env = parseEnv({ EXPO_PUBLIC_API_MODE: 'mock' });
    expect(env.apiMode).toBe('mock');
    expect(env.easProjectId).toBeNull();
  });

  it('rejects an unknown mode', () => {
    expect(() => parseEnv({ EXPO_PUBLIC_API_MODE: 'prod' })).toThrowError(/EXPO_PUBLIC_API_MODE/);
  });
});
