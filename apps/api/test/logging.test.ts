import { Writable } from 'node:stream';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { bearer, buildApp, createCaregiver } from './helpers';

function captureLogs() {
  const lines: string[] = [];
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      lines.push(String(chunk));
      callback();
    },
  });
  return { stream, output: () => lines.join('') };
}

describe('logging', () => {
  it('never writes tokens, device secrets or passwords to the log', async () => {
    const caregiver = await createCaregiver();
    const logs = captureLogs();
    const app = buildApp({ logStream: logs.stream });

    await request(app).get('/api/v1/me').set(bearer(caregiver.token)).set('X-Device-Secret', 'device-secret-value');
    await request(app)
      .post('/api/v1/auth/signup')
      .send({ name: 'Log Teste', email: 'log@example.com', password: 'super-secret-password', extra: true });
    await request(app).get('/api/v1/me').set(bearer('leaked.token.value'));
    await request(app).post('/api/v1/internal/jobs/escalate').set('X-Jobs-Token', 'jobs-token-that-must-not-leak');

    const output = logs.output();
    expect(output).toContain('"/api/v1/me"');
    expect(output).toContain('[Redacted]');
    for (const secret of [caregiver.token, 'device-secret-value', 'super-secret-password', 'leaked.token.value', 'jobs-token-that-must-not-leak']) {
      expect(output).not.toContain(secret);
    }
  });
});
