import { EventsQuerySchema, type EventsQuery } from '@aurelia/shared';
import { Router } from 'express';

import { loadedElder } from '../../auth/requireElderAccess';
import { requireRole } from '../../auth/requireRole';
import { validate } from '../../http/validate';
import type { EventsService } from './service';

/** Mounted at /elders/:elderId/events. */
export function eventsRoutes(service: EventsService): Router {
  const router = Router({ mergeParams: true });

  router.get('/', requireRole('caregiver'), validate({ query: EventsQuerySchema }), async (req, res) => {
    res.json(await service.list(loadedElder(res), req.query as unknown as EventsQuery));
  });

  return router;
}
