import { CreateDeviceBodySchema, DeviceParamsSchema, type CreateDeviceBody, type DeviceParams } from '@aurelia/shared';
import { Router } from 'express';

import { loadedElder } from '../../auth/requireElderAccess';
import { requireRole } from '../../auth/requireRole';
import { validate } from '../../http/validate';
import type { DevicesService } from './service';

/** Mounted at /elders/:elderId/devices. */
export function devicesRoutes(service: DevicesService): Router {
  const router = Router({ mergeParams: true });

  router.post('/', requireRole('caregiver'), validate({ body: CreateDeviceBodySchema }), async (req, res) => {
    res.status(201).json(await service.create(loadedElder(res), req.body as CreateDeviceBody));
  });

  router.delete('/:deviceId', requireRole('caregiver'), validate({ params: DeviceParamsSchema }), async (req, res) => {
    const { deviceId } = req.params as unknown as DeviceParams;
    await service.remove(loadedElder(res), deviceId);
    res.status(204).end();
  });

  return router;
}
