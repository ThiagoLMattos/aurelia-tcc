import { resolve } from 'node:path';

import dotenv from 'dotenv';

// The single .env lives at the repository root (see .env.example).
dotenv.config({ path: resolve(import.meta.dirname, '../../../.env'), quiet: true });

const { createApp } = await import('./app');
const { loadConfig } = await import('./config');
const { initFirebase } = await import('./firebase');
const { createLogger } = await import('./logger');

let config;
try {
  config = loadConfig();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

const logger = createLogger(config);
const app = createApp({ config, firebase: initFirebase(config), logger });

app.listen(config.PORT, () => {
  logger.info({ port: config.PORT, emulators: config.USE_EMULATORS }, 'Aurélia API listening');
});
