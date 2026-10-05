import { ElderParamsSchema, type HealthResponse } from '@aurelia/shared';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import type { Logger } from 'pino';

import { authenticate } from './auth/authenticate';
import { requireElderAccess } from './auth/requireElderAccess';
import type { Clock } from './clock';
import type { Config } from './config';
import type { Firebase } from './firebase';
import { errorHandler, notFoundHandler } from './http/errorHandler';
import { validate } from './http/validate';
import { agendaRoutes } from './modules/agenda/routes';
import { authRoutes } from './modules/auth/routes';
import { contactsRoutes } from './modules/contacts/routes';
import { elderRoutes, eldersRoutes } from './modules/elders/routes';
import { eventsRoutes } from './modules/events/routes';
import { meRoutes } from './modules/me/routes';
import { pairRoutes, pairingManagementRoutes } from './modules/pairing/routes';
import { reportsRoutes } from './modules/reports/routes';
import { routinesRoutes } from './modules/routines/routes';
import { sosRoutes } from './modules/sos/routes';
import { createServices } from './services';

export interface AppDeps {
  config: Config;
  firebase: Firebase;
  logger: Logger;
  /** Defaults to the system clock; tests pass a fixed one. */
  now?: Clock;
  limits?: { signupPerHour?: number; pairPer15Min?: number };
}

/** Builds the Express app without listening, so tests can drive it with supertest. */
export function createApp({ config, firebase, logger, now, limits }: AppDeps): Express {
  const services = createServices({ firebase, logger, ...(now ? { now } : {}) });
  const app = express();

  app.disable('x-powered-by');
  app.use(pinoHttp({ logger }));
  app.use(helmet());
  app.use(cors({ origin: config.CORS_ORIGINS.length > 0 ? config.CORS_ORIGINS : false }));
  app.use(express.json({ limit: '100kb' }));

  const api = express.Router();
  const requireAuth = authenticate(firebase.auth);

  api.get('/health', (_req, res) => {
    const body: HealthResponse = { status: 'ok' };
    res.json(body);
  });

  api.use('/auth', authRoutes({ service: services.auth, signupPerHour: limits?.signupPerHour ?? 10 }));
  api.use('/auth', pairRoutes(services.pairing, limits?.pairPer15Min ?? 10));
  api.use('/me', requireAuth, meRoutes(services.me));
  api.use('/elders', requireAuth, eldersRoutes(services.elders));

  // Everything under /elders/:elderId passes the access rule of spec §5 first.
  const elderScope = express.Router({ mergeParams: true });
  elderScope.use('/', elderRoutes(services.elders));
  elderScope.use('/', pairingManagementRoutes(services.pairing));
  elderScope.use('/routines', routinesRoutes(services.routines));
  elderScope.use('/agenda', agendaRoutes(services.agenda));
  elderScope.use('/contacts', contactsRoutes(services.contacts));
  elderScope.use('/events', eventsRoutes(services.events));
  elderScope.use('/reports', reportsRoutes(services.reports));
  elderScope.use('/sos', sosRoutes(services.sos));
  api.use(
    '/elders/:elderId',
    requireAuth,
    validate({ params: ElderParamsSchema }),
    requireElderAccess(services.repos.elders),
    elderScope,
  );

  app.use('/api/v1', api);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
