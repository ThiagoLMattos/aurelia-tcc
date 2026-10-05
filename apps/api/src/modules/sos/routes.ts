import { SosBodySchema, type SosBody, type SosResponse } from '@aurelia/shared';
import { Router } from 'express';

import { loadedElder } from '../../auth/requireElderAccess';
import { requireRole } from '../../auth/requireRole';
import { validate } from '../../http/validate';
import type { SosService } from './service';

/** Mounted at /elders/:elderId/sos. */
export function sosRoutes(service: SosService): Router {
  const router = Router({ mergeParams: true });

  router.post('/', requireRole('elder'), validate({ body: SosBodySchema }), async (req, res) => {
    const event = await service.trigger(loadedElder(res), req.body as SosBody);
    const body: SosResponse = { eventId: event.id };
    res.status(201).json(body);
  });

  return router;
}
