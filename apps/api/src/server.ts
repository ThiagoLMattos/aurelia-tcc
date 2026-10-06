import { resolve } from 'node:path';

import dotenv from 'dotenv';

// The single .env lives at the repository root (see .env.example).
dotenv.config({ path: resolve(import.meta.dirname, '../../../.env'), quiet: true });

const { createApp } = await import('./app');
const { loadConfig } = await import('./config');
const { initFirebase } = await import('./firebase');
const { createLogger } = await import('./logger');
const { createServices } = await import('./services');
const { createExpoPushSender } = await import('./push/sender');
const { createSmsSender } = await import('./sms/sender');
const { createLlmProvider } = await import('./modules/assistant/provider');
const { startScheduler } = await import('./jobs/scheduler');

let config;
try {
  config = loadConfig();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

const logger = createLogger(config);
const firebase = initFirebase(config);
const services = createServices({
  firebase,
  logger,
  push: createExpoPushSender(logger),
  sms: createSmsSender(config, logger),
  llm: createLlmProvider(config),
});
const app = createApp({ config, firebase, logger, services });

const server = app.listen(config.PORT, () => {
  logger.info({ port: config.PORT, emulators: config.USE_EMULATORS, sms: config.SMS_PROVIDER }, 'Aurélia API listening');
});

const scheduler = config.SCHEDULER_ENABLED ? startScheduler(services.jobs, logger) : null;

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    scheduler?.stop();
    server.close(() => process.exit(0));
  });
}
