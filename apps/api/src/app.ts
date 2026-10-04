import { type HealthResponse } from '@aurelia/shared';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import type { Logger } from 'pino';

import { authenticate } from './auth/authenticate';
import type { Config } from './config';
import type { Firebase } from './firebase';
import { errorHandler, notFoundHandler } from './http/errorHandler';
import { authRoutes } from './modules/auth/routes';
import { createAuthService } from './modules/auth/service';
import { meRoutes } from './modules/me/routes';
import { createMeService } from './modules/me/service';
import { createRepos } from './repos';

export interface AppDeps {
  config: Config;
  firebase: Firebase;
  logger: Logger;
  limits?: { signupPerHour?: number };
}

/** Builds the Express app without listening, so tests can drive it with supertest. */
export function createApp({ config, firebase, logger, limits }: AppDeps): Express {
  const repos = createRepos(firebase.db);
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

  api.use(
    '/auth',
    authRoutes({
      service: createAuthService({ auth: firebase.auth, users: repos.users, logger }),
      signupPerHour: limits?.signupPerHour ?? 10,
    }),
  );
  api.use('/me', requireAuth, meRoutes(createMeService(repos)));

  app.use('/api/v1', api);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
