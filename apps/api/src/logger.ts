import { pino, type DestinationStream, type Logger } from 'pino';

import type { Config } from './config';

export const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-device-secret"]',
  'req.body.password',
  'res.headers["set-cookie"]',
  'password',
  '*.password',
  'authorization',
  '*.authorization',
];

export function createLogger(config: Pick<Config, 'LOG_LEVEL'>, destination?: DestinationStream): Logger {
  return pino({ level: config.LOG_LEVEL, redact: { paths: REDACT_PATHS, censor: '[Redacted]' } }, destination);
}
