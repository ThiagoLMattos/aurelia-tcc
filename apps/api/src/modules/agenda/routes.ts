import { AgendaDoneParamsSchema, AgendaQuerySchema, type AgendaDoneParams, type AgendaQuery } from '@aurelia/shared';
import { Router } from 'express';

import { loadedElder } from '../../auth/requireElderAccess';
import { requireRole } from '../../auth/requireRole';
import { validate } from '../../http/validate';
import type { AgendaService } from './service';

/** Mounted at /elders/:elderId/agenda. */
export function agendaRoutes(service: AgendaService): Router {
  const router = Router({ mergeParams: true });

  router.get('/', validate({ query: AgendaQuerySchema }), async (req, res) => {
    res.json(await service.get(loadedElder(res), req.query as AgendaQuery));
  });

  router.post('/:date/:routineId/done', validate({ params: AgendaDoneParamsSchema }), async (req, res) => {
    const { date, routineId } = req.params as unknown as AgendaDoneParams;
    res.json(await service.markDone(loadedElder(res), req.auth!, date, routineId));
  });

  router.delete(
    '/:date/:routineId/done',
    requireRole('caregiver'),
    validate({ params: AgendaDoneParamsSchema }),
    async (req, res) => {
      const { date, routineId } = req.params as unknown as AgendaDoneParams;
      await service.undoDone(loadedElder(res), date, routineId);
      res.status(204).end();
    },
  );

  return router;
}
