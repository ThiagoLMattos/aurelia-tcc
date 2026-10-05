import { timingSafeEqual } from 'node:crypto';

import { Router } from 'express';

import { conflict, unauthenticated } from '../../http/errors';
import type { JobsService } from './service';

function tokenMatches(given: string | undefined, expected: string): boolean {
  if (!given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Mounted at /internal/jobs only when JOBS_TOKEN is configured. */
export function jobsRoutes(service: JobsService, token: string): Router {
  const router = Router();

  router.post('/run', async (req, res) => {
    if (!tokenMatches(req.header('x-jobs-token'), token)) throw unauthenticated('Token de jobs inválido.');
    const summary = await service.runAll();
    if (!summary) throw conflict('Os jobs já estão em execução.');
    res.json(summary);
  });

  return router;
}
