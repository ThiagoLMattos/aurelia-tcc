import { describe, expect, it } from 'vitest';

import { loadConfig } from '../src/config';

describe('loadConfig', () => {
  it('applies defaults and parses lists and booleans', () => {
    const config = loadConfig({ FIREBASE_PROJECT_ID: 'p', LLM_PROVIDER: 'fake', USE_EMULATORS: 'true', CORS_ORIGINS: 'http://a.test, http://b.test' });
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

  it('needs a key and a model for Groq, and a long enough jobs token', () => {
    const base = { FIREBASE_PROJECT_ID: 'p' };
    expect(() => loadConfig(base)).toThrow(/GROQ_API_KEY[\s\S]*LLM_MODEL/);
    expect(loadConfig({ ...base, GROQ_API_KEY: 'k', LLM_MODEL: 'm' }).LLM_PROVIDER).toBe('groq');
    expect(() => loadConfig({ ...base, LLM_PROVIDER: 'fake', JOBS_TOKEN: 'short' })).toThrow(/JOBS_TOKEN/);
    expect(loadConfig({ ...base, LLM_PROVIDER: 'fake' }).JOBS_TOKEN).toBeUndefined();
  });
});
