import { WeeklyReportQuerySchema, type WeeklyReportQuery } from '@aurelia/shared';
import { Router } from 'express';

import { loadedElder } from '../../auth/requireElderAccess';
import { requireRole } from '../../auth/requireRole';
import { validate } from '../../http/validate';
import type { ReportsService } from './service';

/** Mounted at /elders/:elderId/reports. */
export function reportsRoutes(service: ReportsService): Router {
  const router = Router({ mergeParams: true });

  router.get('/weekly', requireRole('caregiver'), validate({ query: WeeklyReportQuerySchema }), async (req, res) => {
    res.json(await service.weekly(loadedElder(res), req.query as unknown as WeeklyReportQuery));
  });

  return router;
}
