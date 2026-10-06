import {
  CaregiverInviteQuerySchema,
  CaregiverParamsSchema,
  JoinElderBodySchema,
  type CaregiverInviteQuery,
  type CaregiverParams,
  type JoinElderBody,
} from '@aurelia/shared';
import { Router } from 'express';

import { loadedElder } from '../../auth/requireElderAccess';
import { requireRole } from '../../auth/requireRole';
import { createRateLimiter } from '../../http/rateLimit';
import { validate } from '../../http/validate';
import type { CaregiversService } from './service';

/** POST /me/elders, behind authenticate. Rate limited per IP so an invite cannot be brute-forced. */
export function joinElderRoutes(service: CaregiversService, joinPer15Min: number): Router {
  const router = Router();
  const limiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    limit: joinPer15Min,
    message: 'Muitas tentativas com convites. Tente novamente em alguns minutos.',
  });

  router.post('/', requireRole('caregiver'), limiter, validate({ body: JoinElderBodySchema }), async (req, res) => {
    res.status(201).json(await service.join(req.auth!.uid, (req.body as JoinElderBody).code));
  });

  return router;
}

/** Caregiver-only, mounted at /elders/:elderId. */
export function caregiversRoutes(service: CaregiversService): Router {
  const router = Router({ mergeParams: true });
  const caregiverOnly = requireRole('caregiver');

  router.post('/caregiver-invites', caregiverOnly, validate({ query: CaregiverInviteQuerySchema }), async (req, res) => {
    const { renew } = req.query as unknown as CaregiverInviteQuery;
    const { created, ...invite } = await service.issueInvite(loadedElder(res), req.auth!.uid, renew);
    res.status(created ? 201 : 200).json(invite);
  });

  router.get('/caregivers', caregiverOnly, async (_req, res) => {
    res.json(await service.list(loadedElder(res)));
  });

  router.delete('/caregivers/:caregiverId', caregiverOnly, validate({ params: CaregiverParamsSchema }), async (req, res) => {
    await service.remove(loadedElder(res), (req.params as unknown as CaregiverParams).caregiverId);
    res.status(204).end();
  });

  return router;
}
