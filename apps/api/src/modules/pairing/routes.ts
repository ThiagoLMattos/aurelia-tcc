import { PairBodySchema, type PairBody } from '@aurelia/shared';
import { Router } from 'express';

import { loadedElder } from '../../auth/requireElderAccess';
import { requireRole } from '../../auth/requireRole';
import { createRateLimiter } from '../../http/rateLimit';
import { validate } from '../../http/validate';
import type { PairingService } from './service';

/** Public: POST /auth/pair. Rate limited per IP so a code cannot be brute-forced. */
export function pairRoutes(service: PairingService, pairPer15Min: number): Router {
  const router = Router();
  const limiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    limit: pairPer15Min,
    message: 'Muitas tentativas de pareamento. Tente novamente em alguns minutos.',
  });

  router.post('/pair', limiter, validate({ body: PairBodySchema }), async (req, res) => {
    res.json(await service.pair((req.body as PairBody).code));
  });

  return router;
}

/** Caregiver-only, mounted at /elders/:elderId. */
export function pairingManagementRoutes(service: PairingService): Router {
  const router = Router({ mergeParams: true });
  const caregiverOnly = requireRole('caregiver');

  router.post('/pairing-codes', caregiverOnly, async (req, res) => {
    res.status(201).json(await service.issueCode(loadedElder(res), req.auth!.uid));
  });

  router.delete('/session', caregiverOnly, async (_req, res) => {
    await service.revokeSession(loadedElder(res));
    res.status(204).end();
  });

  return router;
}
