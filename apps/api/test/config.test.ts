import { describe, expect, it } from 'vitest';

import { loadConfig } from '../src/config';

describe('loadConfig', () => {
  it('applies defaults and parses lists and booleans', () => {
    const config = loadConfig({ FIREBASE_PROJECT_ID: 'p', USE_EMULATORS: 'true', CORS_ORIGINS: 'http://a.test, http://b.test' });
    expect(config).toMatchObject({ PORT: 3000, USE_EMULATORS: true, CORS_ORIGINS: ['http://a.test', 'http://b.test'] });
  });

  it('fails fast with a readable message listing the problems', () => {
    const message = (() => {
      try {
        loadConfig({ PORT: 'abc', USE_EMULATORS: 'yes' });
      } catch (error) {
        return (error as Error).message;
      }
      return '';
    })();
    for (const name of ['FIREBASE_PROJECT_ID', 'PORT', 'USE_EMULATORS']) expect(message).toContain(name);
  });
});
