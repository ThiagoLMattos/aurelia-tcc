import {
  PatchMeBodySchema,
  PushTokenBodySchema,
  PushTokenParamsSchema,
  type PatchMeBody,
  type PushTokenBody,
  type PushTokenParams,
} from '@aurelia/shared';
import { Router } from 'express';

import { requireRole } from '../../auth/requireRole';
import { validate } from '../../http/validate';
import type { AccountService } from '../account/service';
import type { MeService } from './service';

/** Mounted behind `authenticate`, so req.auth is always set here. */
export function meRoutes(service: MeService, account: AccountService): Router {
  const router = Router();

  router.get('/', async (req, res) => {
    res.json(await service.getMe(req.auth!));
  });

  router.patch('/', requireRole('caregiver'), validate({ body: PatchMeBodySchema }), async (req, res) => {
    res.json(await service.patchMe(req.auth!, req.body as PatchMeBody));
  });

  /** Deletes the caregiver's account and the elders only they follow. The app asks for the password first. */
  router.delete('/', requireRole('caregiver'), async (req, res) => {
    await account.deleteCaregiver(req.auth!.uid);
    res.status(204).end();
  });

  router.post('/push-tokens', validate({ body: PushTokenBodySchema }), async (req, res) => {
    await service.addPushToken(req.auth!, (req.body as PushTokenBody).token);
    res.status(204).end();
  });

  router.delete('/push-tokens/:token', validate({ params: PushTokenParamsSchema }), async (req, res) => {
    await service.removePushToken(req.auth!, (req.params as unknown as PushTokenParams).token);
    res.status(204).end();
  });

  return router;
}
