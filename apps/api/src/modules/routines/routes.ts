import {
  CreateRoutineBodySchema,
  PatchRoutineBodySchema,
  RoutineParamsSchema,
  type RoutineParams,
  type CreateRoutineBody,
  type PatchRoutineBody,
} from '@aurelia/shared';
import { Router } from 'express';

import { loadedElder } from '../../auth/requireElderAccess';
import { requireRole } from '../../auth/requireRole';
import { validate } from '../../http/validate';
import type { RoutinesService } from './service';

/** Mounted at /elders/:elderId/routines, behind authenticate + requireElderAccess. */
export function routinesRoutes(service: RoutinesService): Router {
  const router = Router({ mergeParams: true });
  const caregiverOnly = requireRole('caregiver');

  router.get('/', async (_req, res) => {
    res.json(await service.list(loadedElder(res).id));
  });

  router.post('/', caregiverOnly, validate({ body: CreateRoutineBodySchema }), async (req, res) => {
    res.status(201).json(await service.create(loadedElder(res).id, req.body as CreateRoutineBody));
  });

  router.patch(
    '/:routineId',
    caregiverOnly,
    validate({ params: RoutineParamsSchema, body: PatchRoutineBodySchema }),
    async (req, res) => {
      res.json(await service.patch(loadedElder(res).id, (req.params as unknown as RoutineParams).routineId, req.body as PatchRoutineBody));
    },
  );

  router.delete('/:routineId', caregiverOnly, validate({ params: RoutineParamsSchema }), async (req, res) => {
    await service.remove(loadedElder(res).id, (req.params as unknown as RoutineParams).routineId);
    res.status(204).end();
  });

  return router;
}
