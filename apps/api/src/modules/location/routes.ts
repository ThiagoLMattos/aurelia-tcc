import { DeviceLocationBodySchema, ResolveGeofenceBodySchema, type DeviceLocationBody, type DeviceLocationResponse, type ResolveGeofenceBody } from '@aurelia/shared';
import { Router, type RequestHandler } from 'express';

import { loadedElder } from '../../auth/requireElderAccess';
import { requireRole } from '../../auth/requireRole';
import { unauthenticated } from '../../http/errors';
import { createRateLimiter } from '../../http/rateLimit';
import { validate } from '../../http/validate';
import type { DeviceDoc } from '../../repos/devices';
import type { DevicesService } from '../devices/service';
import type { LocationService } from './service';

const header = (value: string | string[] | undefined) => (typeof value === 'string' ? value : undefined);

/** Authenticates a tracker with X-Device-Id + X-Device-Secret and exposes it as res.locals.device. */
function deviceAuth(devices: DevicesService): RequestHandler {
  return async (req, res, next) => {
    try {
      const id = header(req.headers['x-device-id']);
      const secret = header(req.headers['x-device-secret']);
      if (!id || !secret) throw unauthenticated('Credenciais do rastreador ausentes.');
      res.locals.device = await devices.authenticate(id, secret);
      next();
    } catch (error) {
      next(error);
    }
  };
}

interface DeviceRouteOptions {
  windowMs: number;
  perWindow: number;
}

/** Mounted at /device. Unauthenticated callers are capped per IP first, then each tracker per id. */
export function deviceRoutes(devices: DevicesService, service: LocationService, { windowMs, perWindow }: DeviceRouteOptions): Router {
  const router = Router();
  const perIp = createRateLimiter({ windowMs: 60_000, limit: 120 });
  const perDevice = createRateLimiter({
    windowMs,
    limit: perWindow,
    message: 'Envie a localização com menos frequência.',
    key: (req) => String((req.res?.locals.device as DeviceDoc | undefined)?.id),
  });

  router.post('/location', perIp, deviceAuth(devices), perDevice, validate({ body: DeviceLocationBodySchema }), async (req, res) => {
    await service.ingest(res.locals.device as DeviceDoc, req.body as DeviceLocationBody);
    const body: DeviceLocationResponse = { ok: true };
    res.json(body);
  });

  return router;
}

/** Mounted at /elders/:elderId (caregiver only). */
export function elderLocationRoutes(service: LocationService): Router {
  const router = Router({ mergeParams: true });

  router.get('/location', requireRole('caregiver'), async (_req, res) => {
    res.json(await service.current(loadedElder(res)));
  });

  router.post('/geofence/resolve', requireRole('caregiver'), validate({ body: ResolveGeofenceBodySchema }), async (req, res) => {
    res.json(await service.resolve(loadedElder(res), req.body as ResolveGeofenceBody));
  });

  return router;
}
