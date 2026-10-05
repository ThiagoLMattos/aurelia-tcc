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

  it('only logs SMS by default, and needs the three Twilio keys to send them', () => {
    const base = { FIREBASE_PROJECT_ID: 'p', LLM_PROVIDER: 'fake' };
    expect(loadConfig(base).SMS_PROVIDER).toBe('log');
    expect(() => loadConfig({ ...base, SMS_PROVIDER: 'twilio', TWILIO_ACCOUNT_SID: 'AC1' })).toThrow(/TWILIO_AUTH_TOKEN[\s\S]*TWILIO_FROM/);
    const twilio = { TWILIO_ACCOUNT_SID: 'AC1', TWILIO_AUTH_TOKEN: 't', TWILIO_FROM: '+15550001111' };
    expect(loadConfig({ ...base, SMS_PROVIDER: 'twilio', ...twilio }).SMS_PROVIDER).toBe('twilio');
  });

  it('accepts the Firebase service account key as JSON, without ever printing it', () => {
    const base = { FIREBASE_PROJECT_ID: 'p', LLM_PROVIDER: 'fake' };
    const key = JSON.stringify({ type: 'service_account', project_id: 'p', client_email: 'sa@p.iam.gserviceaccount.com', private_key: 'SECRET-KEY' });
    expect(loadConfig({ ...base, FIREBASE_SERVICE_ACCOUNT: key }).FIREBASE_SERVICE_ACCOUNT).toBe(key);
    expect(loadConfig(base).FIREBASE_SERVICE_ACCOUNT).toBeUndefined();

    const failure = (value: string) => {
      try {
        loadConfig({ ...base, FIREBASE_SERVICE_ACCOUNT: value });
      } catch (error) {
        return (error as Error).message;
      }
      return '';
    };
    expect(failure('{"private_key":"SECRET-KEY"}')).toMatch(/FIREBASE_SERVICE_ACCOUNT: must be the service account key JSON/);
    expect(failure(key.replace('"project_id":"p"', '"project_id":"other"'))).toMatch(/another project/);
    expect(failure('not json SECRET-KEY')).not.toContain('SECRET-KEY');
  });

  it('trusts no proxy unless told how many sit in front of the API', () => {
    const base = { FIREBASE_PROJECT_ID: 'p', LLM_PROVIDER: 'fake' };
    expect(loadConfig(base).TRUST_PROXY).toBe(0);
    expect(loadConfig({ ...base, TRUST_PROXY: '1' }).TRUST_PROXY).toBe(1);
    expect(() => loadConfig({ ...base, TRUST_PROXY: 'true' })).toThrow(/TRUST_PROXY/);
  });
});
