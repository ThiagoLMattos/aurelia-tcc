import { GameResultBodySchema, type GamePlayedPayload, type GameResultResponse } from '@aurelia/shared';
import { Router } from 'express';

import { loadedElder } from '../../auth/requireElderAccess';
import { requireRole } from '../../auth/requireRole';
import { validate } from '../../http/validate';
import type { GamesService } from './service';

/** Mounted at /elders/:elderId/games. */
export function gamesRoutes(service: GamesService): Router {
  const router = Router({ mergeParams: true });

  router.post('/', requireRole('elder'), validate({ body: GameResultBodySchema }), async (req, res) => {
    const event = await service.record(loadedElder(res), req.body as GamePlayedPayload);
    const body: GameResultResponse = { eventId: event.id };
    res.status(201).json(body);
  });

  return router;
}
