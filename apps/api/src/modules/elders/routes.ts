import { CreateElderBodySchema, PatchElderBodySchema, type CreateElderBody, type PatchElderBody } from '@aurelia/shared';
import { Router } from 'express';

import { loadedElder } from '../../auth/requireElderAccess';
import { requireRole } from '../../auth/requireRole';
import { validate } from '../../http/validate';
import type { EldersService } from './service';

/** Mounted at /elders, behind authenticate. */
export function eldersRoutes(service: EldersService): Router {
  const router = Router();

  router.post('/', requireRole('caregiver'), validate({ body: CreateElderBodySchema }), async (req, res) => {
    res.status(201).json(await service.create(req.auth!.uid, req.body as CreateElderBody));
  });

  return router;
}

/** Mounted at /elders/:elderId, behind authenticate + requireElderAccess. */
export function elderRoutes(service: EldersService): Router {
  const router = Router({ mergeParams: true });

  router.get('/', async (_req, res) => {
    res.json(await service.detail(loadedElder(res)));
  });

  router.patch('/', requireRole('caregiver'), validate({ body: PatchElderBodySchema }), async (req, res) => {
    res.json(await service.patch(loadedElder(res).id, req.body as PatchElderBody));
  });

  return router;
}
