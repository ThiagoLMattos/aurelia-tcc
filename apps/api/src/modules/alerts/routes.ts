import { EventParamsSchema, type EventParams } from '@aurelia/shared';
import { Router } from 'express';

import { loadedElder } from '../../auth/requireElderAccess';
import { requireRole } from '../../auth/requireRole';
import { validate } from '../../http/validate';
import type { AlertsService } from './service';

/** Mounted at /elders/:elderId/events, next to the timeline. */
export function alertsRoutes(service: AlertsService): Router {
  const router = Router({ mergeParams: true });

  router.post('/:eventId/acknowledge', requireRole('caregiver'), validate({ params: EventParamsSchema }), async (req, res) => {
    res.json(await service.acknowledge(loadedElder(res), (req.params as unknown as EventParams).eventId, req.auth!.uid));
  });

  return router;
}
